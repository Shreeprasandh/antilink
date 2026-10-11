import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { EventEmitter } from 'node:events';
import type { AgentStep, AgentToolCall, ToolConfirmationPayload } from '@antilink/shared';

export class AgentBridge extends EventEmitter {
  private brainDir: string;
  private activeConversationId: string | null = null;
  private transcriptPath: string | null = null;
  private lastReadBytes: number = 0;
  private fileWatcher: fs.FSWatcher | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private recentSteps: AgentStep[] = [];

  constructor() {
    super();
    this.brainDir = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'brain');
  }

  public init(): void {
    this.discoverActiveConversation();
    // Poll every 1.5s to ensure no dropped events
    this.pollInterval = setInterval(() => {
      this.checkAndReadTranscript();
    }, 1500);
  }

  public stop(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  public getActiveConversationId(): string | null {
    return this.activeConversationId;
  }

  public getRecentSteps(): AgentStep[] {
    return this.recentSteps;
  }

  private discoverActiveConversation(): void {
    if (!fs.existsSync(this.brainDir)) return;

    try {
      const entries = fs.readdirSync(this.brainDir, { withFileTypes: true });
      const dirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => {
          const dirPath = path.join(this.brainDir, e.name);
          const stat = fs.statSync(dirPath);
          return { id: e.name, path: dirPath, mtime: stat.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);

      if (dirs.length > 0) {
        const latest = dirs[0];
        const transcript = path.join(latest.path, '.system_generated', 'logs', 'transcript.jsonl');
        if (fs.existsSync(transcript)) {
          this.activeConversationId = latest.id;
          this.transcriptPath = transcript;
          this.setupWatcher(transcript);
          this.readFullTranscript(transcript);
        }
      }
    } catch {
      // ignore discovery failures
    }
  }

  private setupWatcher(filePath: string): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
    }
    try {
      this.fileWatcher = fs.watch(filePath, () => {
        this.checkAndReadTranscript();
      });
    } catch {
      // fallback to poll
    }
  }

  private readFullTranscript(filePath: string): void {
    try {
      if (!fs.existsSync(filePath)) return;
      const stat = fs.statSync(filePath);
      this.lastReadBytes = stat.size;

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim().length > 0);
      const steps: AgentStep[] = [];

      for (const line of lines) {
        try {
          const raw = JSON.parse(line);
          const step = this.transformRawStep(raw);
          if (step) steps.push(step);
        } catch {
          // ignore malformed line
        }
      }

      this.recentSteps = steps.slice(-50); // Keep last 50 steps
      this.emit('initial_steps', this.recentSteps);
    } catch {
      // ignore
    }
  }

  private checkAndReadTranscript(): void {
    if (!this.transcriptPath || !fs.existsSync(this.transcriptPath)) {
      this.discoverActiveConversation();
      return;
    }

    try {
      const stat = fs.statSync(this.transcriptPath);
      if (stat.size < this.lastReadBytes) {
        // File was truncated / rewritten
        this.lastReadBytes = 0;
        this.readFullTranscript(this.transcriptPath);
        return;
      }

      if (stat.size > this.lastReadBytes) {
        const stream = fs.createReadStream(this.transcriptPath, {
          start: this.lastReadBytes,
          end: stat.size,
          encoding: 'utf-8',
        });

        let chunk = '';
        stream.on('data', (d) => {
          chunk += d;
        });

        stream.on('end', () => {
          this.lastReadBytes = stat.size;
          const lines = chunk.split('\n').filter((l) => l.trim().length > 0);
          for (const line of lines) {
            try {
              const raw = JSON.parse(line);
              const step = this.transformRawStep(raw);
              if (step) {
                this.recentSteps.push(step);
                if (this.recentSteps.length > 50) this.recentSteps.shift();
                this.emit('step_added', step);

                // Check for confirmation requirement
                if (step.toolCalls && step.toolCalls.length > 0) {
                  for (const tool of step.toolCalls) {
                    if (tool.isConfirmationRequired) {
                      const payload: ToolConfirmationPayload = {
                        conversationId: this.activeConversationId || '',
                        stepIdx: step.stepIndex,
                        toolName: tool.name,
                        commandLine: (tool.args.CommandLine as string) || undefined,
                        targetFile: (tool.args.TargetFile as string) || undefined,
                        args: tool.args,
                      };
                      this.emit('tool_confirmation', payload);
                    }
                  }
                }
              }
            } catch {
              // ignore parse errors
            }
          }
        });
      }
    } catch {
      // ignore read errors
    }
  }

  private transformRawStep(raw: Record<string, unknown>): AgentStep | null {
    if (typeof raw.step_index !== 'number') return null;

    const toolCalls: AgentToolCall[] = [];
    if (Array.isArray(raw.tool_calls)) {
      for (const t of raw.tool_calls) {
        if (t && typeof t === 'object') {
          toolCalls.push({
            name: (t.name as string) || (t.tool_name as string) || 'tool',
            args: (t.arguments as Record<string, unknown>) || (t.args as Record<string, unknown>) || {},
            output: typeof t.output === 'string' ? t.output : undefined,
            isConfirmationRequired: Boolean(t.is_confirmation_required),
          });
        }
      }
    }

    return {
      stepIndex: raw.step_index,
      type: (raw.type as string) || 'UNKNOWN',
      source: (raw.source as string) || 'MODEL',
      status: (raw.status as 'PENDING' | 'DONE' | 'ERROR' | 'WAITING_CONFIRMATION') || 'DONE',
      createdAt: (raw.created_at as string) || new Date().toISOString(),
      content: typeof raw.content === 'string' ? raw.content : undefined,
      thinking: typeof raw.thinking === 'string' ? raw.thinking : undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}
