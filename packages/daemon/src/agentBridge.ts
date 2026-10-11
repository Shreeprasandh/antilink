import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type {
  AgentStep,
  AgentToolCall,
  ToolConfirmationPayload,
  ConversationSummary,
  SubagentInfo,
  BackgroundTaskInfo,
  ArtifactInfo,
} from '@antilink/shared';

export class AgentBridge extends EventEmitter {
  private brainDir: string;
  private dbPath: string;
  private activeConversationId: string | null = null;
  private transcriptPath: string | null = null;
  private lastReadBytes: number = 0;
  private fileWatcher: fs.FSWatcher | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private recentSteps: AgentStep[] = [];

  constructor() {
    super();
    this.brainDir = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'brain');
    this.dbPath = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'conversation_summaries.db');
  }

  public init(): void {
    this.discoverActiveConversation();
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

  public getActiveConversationTitle(): string {
    if (!this.activeConversationId) return 'Antilink';

    try {
      if (fs.existsSync(this.dbPath)) {
        const stdout = execSync(
          `/usr/bin/sqlite3 "${this.dbPath}" -json "SELECT title, preview FROM conversation_summaries WHERE conversation_id = '${this.activeConversationId}';"`,
          { encoding: 'utf-8', timeout: 1000 }
        );
        const rows = JSON.parse(stdout || '[]');
        if (rows.length > 0 && (rows[0].title || rows[0].preview)) {
          const raw = rows[0].title || rows[0].preview;
          const cleaned = raw.replace(/<USER_REQUEST>|<\/USER_REQUEST>/g, '').trim();
          if (cleaned) return cleaned;
        }
      }
    } catch {
      // fallback
    }

    // Fallback: check transcript
    if (this.transcriptPath && fs.existsSync(this.transcriptPath)) {
      try {
        const head = fs.readFileSync(this.transcriptPath, 'utf-8');
        const lines = head.split('\n').filter((l) => l.trim().length > 0);
        for (const l of lines) {
          const parsed = JSON.parse(l);
          if (parsed.type === 'USER_INPUT' && parsed.content) {
            const cleaned = parsed.content.replace(/<USER_REQUEST>|<\/USER_REQUEST>/g, '').trim();
            if (cleaned) return cleaned.slice(0, 36);
          }
        }
      } catch {
        // ignore
      }
    }

    return 'Antilink';
  }

  public getRecentSteps(): AgentStep[] {
    return this.recentSteps;
  }

  public switchConversation(id: string): boolean {
    const targetDir = path.join(this.brainDir, id);
    const transcript = path.join(targetDir, '.system_generated', 'logs', 'transcript.jsonl');
    if (!fs.existsSync(transcript)) return false;

    this.activeConversationId = id;
    this.transcriptPath = transcript;
    this.lastReadBytes = 0;
    this.setupWatcher(transcript);
    this.readFullTranscript(transcript);
    return true;
  }

  public getConversations(): ConversationSummary[] {
    // 1. Authoritative SQLite database check
    if (fs.existsSync(this.dbPath)) {
      try {
        const stdout = execSync(
          `/usr/bin/sqlite3 "${this.dbPath}" -json "SELECT conversation_id, title, preview, step_count, last_modified_time FROM conversation_summaries ORDER BY last_modified_time DESC LIMIT 30;"`,
          { encoding: 'utf-8', timeout: 1500 }
        );
        const rows = JSON.parse(stdout || '[]');
        if (Array.isArray(rows) && rows.length > 0) {
          return rows.map((r: { conversation_id: string; title?: string; preview?: string; step_count?: number; last_modified_time?: string }) => {
            const cleanTitle = (r.title || r.preview || r.conversation_id.slice(0, 8))
              .replace(/<USER_REQUEST>|<\/USER_REQUEST>/g, '')
              .trim();
            const cleanPreview = r.preview
              ? r.preview.replace(/<USER_REQUEST>|<\/USER_REQUEST>/g, '').trim()
              : undefined;

            return {
              id: r.conversation_id,
              title: cleanTitle || r.conversation_id.slice(0, 8),
              preview: cleanPreview,
              updatedAt: r.last_modified_time || new Date().toISOString(),
              isActive: r.conversation_id === this.activeConversationId,
              stepCount: r.step_count || 0,
            };
          });
        }
      } catch {
        // fallback to filesystem scan
      }
    }

    // 2. Filesystem scan fallback
    if (!fs.existsSync(this.brainDir)) return [];

    try {
      const entries = fs.readdirSync(this.brainDir, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => {
          const dirPath = path.join(this.brainDir, e.name);
          const stat = fs.statSync(dirPath);
          const transcript = path.join(dirPath, '.system_generated', 'logs', 'transcript.jsonl');

          let title = e.name.slice(0, 8);
          let preview: string | undefined = undefined;
          let stepCount = 0;

          if (fs.existsSync(transcript)) {
            try {
              const head = fs.readFileSync(transcript, 'utf-8');
              const lines = head.split('\n').filter((l) => l.trim().length > 0);
              stepCount = lines.length;

              for (const l of lines) {
                const parsed = JSON.parse(l);
                if (parsed.type === 'USER_INPUT' && parsed.content) {
                  const cleaned = parsed.content.replace(/<USER_REQUEST>|<\/USER_REQUEST>/g, '').trim();
                  title = cleaned.slice(0, 36);
                  preview = cleaned.slice(0, 60);
                  break;
                }
              }
            } catch {
              // fallback
            }
          }

          return {
            id: e.name,
            title,
            preview,
            updatedAt: new Date(stat.mtimeMs).toISOString(),
            isActive: e.name === this.activeConversationId,
            stepCount,
          };
        })
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 20);
    } catch {
      return [];
    }
  }

  public getSubagents(): SubagentInfo[] {
    if (!this.activeConversationId) return [];
    const subagentsDir = path.join(this.brainDir, this.activeConversationId, '.system_generated', 'subagents');
    const result: SubagentInfo[] = [];

    if (fs.existsSync(subagentsDir)) {
      try {
        const entries = fs.readdirSync(subagentsDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) {
            result.push({
              id: e.name,
              role: 'Subagent Worker',
              typeName: 'research',
              state: 'idle',
              createdAt: new Date().toISOString(),
            });
          }
        }
      } catch {
        // ignore
      }
    }

    for (const step of this.recentSteps) {
      if (step.toolCalls) {
        for (const tool of step.toolCalls) {
          if (tool.name === 'invoke_subagent' && Array.isArray(tool.args.Subagents)) {
            for (const s of tool.args.Subagents as Array<{ TypeName?: string; Role?: string }>) {
              result.push({
                id: `subagent-${step.stepIndex}`,
                role: s.Role || 'Assistant',
                typeName: s.TypeName || 'self',
                state: 'idle',
                createdAt: step.createdAt,
              });
            }
          }
        }
      }
    }

    return result.slice(0, 10);
  }

  public getTasks(): BackgroundTaskInfo[] {
    if (!this.activeConversationId) return [];
    const tasksDir = path.join(this.brainDir, this.activeConversationId, '.system_generated', 'tasks');
    const result: BackgroundTaskInfo[] = [];

    if (fs.existsSync(tasksDir)) {
      try {
        const files = fs.readdirSync(tasksDir).filter((f) => f.endsWith('.log'));
        for (const file of files) {
          const taskId = file.replace('.log', '');
          const logPath = path.join(tasksDir, file);
          const stat = fs.statSync(logPath);
          result.push({
            id: taskId,
            command: 'Background Task',
            status: 'DONE',
            logPath,
            createdAt: new Date(stat.mtimeMs).toISOString(),
          });
        }
      } catch {
        // ignore
      }
    }

    return result.slice(0, 10);
  }

  public getArtifacts(): ArtifactInfo[] {
    const result: ArtifactInfo[] = [];

    for (const step of this.recentSteps) {
      if (step.toolCalls) {
        for (const tool of step.toolCalls) {
          if (tool.name === 'write_to_file' && tool.args.ArtifactMetadata) {
            const meta = tool.args.ArtifactMetadata as { Summary?: string };
            result.push({
              stepIndex: step.stepIndex,
              title: path.basename((tool.args.TargetFile as string) || 'Artifact'),
              summary: meta.Summary || 'Generated artifact',
              targetFile: (tool.args.TargetFile as string) || undefined,
              content: (tool.args.CodeContent as string) || '',
              createdAt: step.createdAt,
            });
          }
        }
      }
    }

    return result.slice(0, 10);
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
      // ignore
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
      // fallback
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
          // ignore
        }
      }

      this.recentSteps = steps.slice(-60);
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
                if (this.recentSteps.length > 60) this.recentSteps.shift();
                this.emit('step_added', step);

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
              // ignore
            }
          }
        });
      }
    } catch {
      // ignore
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
