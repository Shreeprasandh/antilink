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
  AgentActivityState,
} from '@antilink/shared';

export class AgentBridge extends EventEmitter {
  private brainDir: string;
  private dbPath: string;
  private cliLogPath: string;
  private lastCliLogBytes: number = 0;
  private activeConfirmation: ToolConfirmationPayload | null = null;
  private activeConversationId: string | null = null;
  private transcriptPath: string | null = null;
  private lastReadBytes: number = 0;
  private fileWatcher: fs.FSWatcher | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private recentSteps: AgentStep[] = [];
  private wasWorking: boolean = false;
  private lastStepTimestamp: number = Date.now();

  constructor() {
    super();
    this.brainDir = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'brain');
    this.dbPath = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'conversation_summaries.db');
    this.cliLogPath = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'cli.log');
  }

  public init(): void {
    this.discoverActiveConversation();
    this.initCliLogState();
    this.wasWorking = this.isAgentWorking();
    this.emitActivityUpdated();
    this.pollInterval = setInterval(() => {
      this.checkAndReadTranscript();
      this.checkCliLog();
      this.checkPendingToolConfirmation();
      this.checkWorkingState();
    }, 300);
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

  public getActiveConfirmation(): ToolConfirmationPayload | null {
    return this.activeConfirmation;
  }

  public notifyAgentStarted(): void {
    this.wasWorking = true;
    this.lastStepTimestamp = Date.now();
    this.emit('agent_status_changed', true);
    this.emit('agent_busy');
    this.emitActivityUpdated();
  }

  public isAgentWorking(): boolean {
    if (this.activeConfirmation) return true;
    if (!this.activeConversationId) return false;

    // 1. Authoritative SQLite database check (read-only, sub-millisecond)
    if (fs.existsSync(this.dbPath)) {
      try {
        const stdout = execSync(
          `/usr/bin/sqlite3 -readonly "${this.dbPath}" "SELECT status, not_fully_idle FROM conversation_summaries WHERE conversation_id = '${this.activeConversationId}';" 2>/dev/null`,
          { encoding: 'utf-8', timeout: 800 }
        );
        const line = stdout.trim();
        if (line) {
          const [status, notFullyIdle] = line.split('|');
          if (status === 'CASCADE_RUN_STATUS_RUNNING' || notFullyIdle === '1') {
            return true;
          }
          if (status === 'CASCADE_RUN_STATUS_IDLE' || notFullyIdle === '0') {
            return false;
          }
        }
      } catch {
        // fallback to transcript / memory analysis
      }
    }

    // 2. Transcript & step analysis fallback
    if (this.recentSteps.length > 0) {
      const lastStep = this.recentSteps[this.recentSteps.length - 1];
      if (lastStep.source === 'USER_EXPLICIT' || lastStep.type === 'USER_INPUT') {
        return true;
      }
      if (lastStep.status === 'PENDING' || lastStep.status === 'WAITING_CONFIRMATION') {
        return true;
      }
      if (lastStep.toolCalls && lastStep.toolCalls.some((t) => !t.output)) {
        return true;
      }
      if (lastStep.type === 'GENERIC') {
        return true;
      }
      if (lastStep.type === 'PLANNER_RESPONSE' && lastStep.toolCalls && lastStep.toolCalls.length > 0) {
        return true;
      }
      if (lastStep.type === 'PLANNER_RESPONSE' && (!lastStep.toolCalls || lastStep.toolCalls.length === 0)) {
        return false;
      }
    }

    return false;
  }

  public checkWorkingState(): void {
    const currentlyWorking = this.isAgentWorking();
    if (this.wasWorking !== currentlyWorking) {
      this.wasWorking = currentlyWorking;
      this.emit('agent_status_changed', currentlyWorking);
      if (!currentlyWorking) {
        this.emit('agent_idle');
      } else {
        this.emit('agent_busy');
      }
      this.emitActivityUpdated();
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
          `/usr/bin/sqlite3 "${this.dbPath}" -json "SELECT title, preview FROM conversation_summaries WHERE conversation_id = '${this.activeConversationId}';" 2>/dev/null`,
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
          `/usr/bin/sqlite3 "${this.dbPath}" -json "SELECT conversation_id, title, preview, step_count, last_modified_time FROM conversation_summaries ORDER BY last_modified_time DESC LIMIT 30;" 2>/dev/null`,
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
    const envConv = process.env.CONVERSATION_ID || process.env.ACTIVE_CONVERSATION_ID;
    if (envConv) {
      const directTranscript = path.join(this.brainDir, envConv, '.system_generated', 'logs', 'transcript.jsonl');
      if (fs.existsSync(directTranscript)) {
        this.activeConversationId = envConv;
        this.transcriptPath = directTranscript;
        this.setupWatcher(directTranscript);
        this.readFullTranscript(directTranscript);
        return;
      }
    }

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

      for (const candidate of dirs) {
        const transcript = path.join(candidate.path, '.system_generated', 'logs', 'transcript.jsonl');
        if (fs.existsSync(transcript)) {
          this.activeConversationId = candidate.id;
          this.transcriptPath = transcript;
          this.setupWatcher(transcript);
          this.readFullTranscript(transcript);
          break;
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
                this.lastStepTimestamp = Date.now();
                this.emit('step_added', step);
                this.emitActivityUpdated();
              }
            } catch {
              // ignore
            }
          }
          this.checkPendingToolConfirmation();
          this.checkWorkingState();
        });
      }
    } catch {
      // ignore
    }
  }

  private isCommandAllowed(cmd: string): boolean {
    if (!cmd) return false;
    try {
      const settingsPath = path.join(os.homedir(), '.gemini', 'antigravity-cli', 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const raw = fs.readFileSync(settingsPath, 'utf8');
        const data = JSON.parse(raw);
        const allows: string[] = data?.permissions?.allow || [];
        for (const rule of allows) {
          const match = rule.match(/^command\((.*)\)$/);
          if (match && match[1]) {
            const prefix = match[1].trim();
            if (cmd.startsWith(prefix) || cmd.includes(prefix)) {
              return true;
            }
          }
        }
      }
    } catch {
      // fallback
    }
    return false;
  }

  private checkPendingToolConfirmation(): void {
    if (!this.activeConversationId || this.recentSteps.length === 0) return;
    const lastStep = this.recentSteps[this.recentSteps.length - 1];

    // If latest step is a PLANNER_RESPONSE with tool calls and agent is currently running
    if (
      lastStep.type === 'PLANNER_RESPONSE' &&
      lastStep.toolCalls &&
      lastStep.toolCalls.length > 0 &&
      this.isAgentWorking()
    ) {
      const tool = lastStep.toolCalls[0];
      const isSensitiveTool =
        tool.isConfirmationRequired ||
        tool.name === 'run_command' ||
        tool.name === 'ask_question';

      let isAllowed = false;
      if (tool.name === 'run_command') {
        const rawCmd = (tool.args.CommandLine as string) || (tool.args.command as string) || '';
        isAllowed = this.isCommandAllowed(rawCmd);
      }

      if (isSensitiveTool && !isAllowed) {
        if (!this.activeConfirmation || this.activeConfirmation.stepIdx !== lastStep.stepIndex) {
          const payload = this.buildConfirmationPayload(tool.name, lastStep.stepIndex);
          this.activeConfirmation = payload;
          this.emit('tool_confirmation', payload);
          this.emitActivityUpdated();
        }
        return;
      }
    }

    // Auto-resolve when a GENERIC step or higher step index arrives
    if (this.activeConfirmation) {
      if (lastStep.stepIndex > this.activeConfirmation.stepIdx || !this.isAgentWorking()) {
        const stepIdx = this.activeConfirmation.stepIdx;
        this.activeConfirmation = null;
        this.emit('tool_confirmation_resolved', { stepIdx });
        this.emitActivityUpdated();
      }
    }
  }

  public resolveConfirmation(stepIdx?: number): void {
    if (this.activeConfirmation && (!stepIdx || this.activeConfirmation.stepIdx === stepIdx)) {
      const idx = this.activeConfirmation.stepIdx;
      this.activeConfirmation = null;
      this.emit('tool_confirmation_resolved', { stepIdx: idx });
      this.emitActivityUpdated();
    }
  }

  private initCliLogState(): void {
    try {
      if (!fs.existsSync(this.cliLogPath)) return;
      const stat = fs.statSync(this.cliLogPath);
      this.lastCliLogBytes = stat.size;
    } catch {
      // ignore
    }
  }

  private checkCliLog(): void {
    try {
      if (!fs.existsSync(this.cliLogPath)) return;
      const stat = fs.statSync(this.cliLogPath);
      if (stat.size < this.lastCliLogBytes) {
        this.lastCliLogBytes = 0;
      }
      if (stat.size === this.lastCliLogBytes) return;

      const bytesToRead = stat.size - this.lastCliLogBytes;
      const buffer = Buffer.alloc(bytesToRead);
      const fd = fs.openSync(this.cliLogPath, 'r');
      fs.readSync(fd, buffer, 0, bytesToRead, this.lastCliLogBytes);
      fs.closeSync(fd);
      this.lastCliLogBytes = stat.size;

      const chunk = buffer.toString('utf-8');
      const lines = chunk.split('\n');

      for (const line of lines) {
        const confirmMatch =
          line.match(/Tool confirmation for conversation [^\s]+ step (\d+)/i) ||
          line.match(/auto-approving [^\s]+ at step (\d+)/i) ||
          line.match(/Responding to tool confirmation:\s*convID=[^,]+,\s*stepIdx=(\d+)/i);

        if (confirmMatch) {
          const stepIdx = parseInt(confirmMatch[1], 10);
          if (
            this.activeConfirmation &&
            (this.activeConfirmation.stepIdx === stepIdx || this.activeConfirmation.stepIdx <= stepIdx)
          ) {
            this.activeConfirmation = null;
            this.emit('tool_confirmation_resolved', { stepIdx });
            this.emitActivityUpdated();
          }
        }
      }
    } catch {
      // ignore
    }
  }

  public getLiveActivity(): AgentActivityState {
    const isWorking = this.isAgentWorking();
    let currentAction = isWorking ? 'Working...' : 'Ready for instructions';
    let currentThought: string | undefined = undefined;
    let currentTool: string | undefined = undefined;
    let toolSummary: string | undefined = undefined;
    let toolAction: string | undefined = undefined;
    let stepIndex: number | undefined = undefined;

    if (this.recentSteps.length > 0) {
      const lastStep = this.recentSteps[this.recentSteps.length - 1];
      stepIndex = lastStep.stepIndex;

      if (lastStep.thinking) {
        const cleaned = lastStep.thinking.replace(/[\r\n]+/g, ' ').trim();
        currentThought = cleaned.length > 200 ? cleaned.slice(-200) : cleaned;
      }

      if (lastStep.toolCalls && lastStep.toolCalls.length > 0) {
        const tool = lastStep.toolCalls[0];
        currentTool = tool.name;
        const args = tool.args || {};
        if (typeof args.toolSummary === 'string' && args.toolSummary.trim()) {
          toolSummary = args.toolSummary.trim();
          currentAction = toolSummary;
        } else if (typeof args.toolAction === 'string' && args.toolAction.trim()) {
          toolAction = args.toolAction.trim();
          currentAction = toolAction;
        } else if (tool.name === 'view_file') {
          const f = (args.AbsolutePath as string) || (args.path as string) || '';
          const base = f ? path.basename(f) : 'file';
          currentAction = `Reading ${base}`;
        } else if (tool.name === 'replace_file_content' || tool.name === 'write_to_file') {
          const f = (args.TargetFile as string) || (args.path as string) || '';
          const base = f ? path.basename(f) : 'file';
          currentAction = `Editing ${base}`;
        } else if (tool.name === 'run_command') {
          const cmd = ((args.CommandLine as string) || (args.command as string) || '').replace(/^["']|["']$/g, '').trim();
          const tokens = cmd.split(/\s+/).slice(0, 3).join(' ');
          currentAction = tokens ? `Running ${tokens}` : 'Running command';
        } else if (tool.name === 'manage_task') {
          currentAction = 'Managing task';
        } else if (tool.name === 'invoke_subagent') {
          currentAction = 'Invoking subagent';
        } else {
          currentAction = `Executing ${tool.name}`;
        }
      } else if (lastStep.thinking && isWorking) {
        currentAction = 'Reasoning & planning';
      } else if (lastStep.type === 'GENERIC' && isWorking) {
        currentAction = 'Processing output';
      }
    }

    if (!isWorking) {
      currentAction = 'Ready for instructions';
    }

    return {
      isWorking,
      currentAction,
      currentThought,
      currentTool,
      toolSummary,
      toolAction,
      stepIndex,
    };
  }

  public emitActivityUpdated(): void {
    const activity = this.getLiveActivity();
    this.emit('activity_updated', activity);
  }

  private buildConfirmationPayload(toolName: string, stepIdx: number): ToolConfirmationPayload {
    let commandLine: string | undefined;
    let targetFile: string | undefined;
    let args: Record<string, unknown> = {};

    // 1. Search recentSteps for stepIdx or stepIdx - 1
    const candidateSteps = this.recentSteps.filter(
      (s) => s.stepIndex === stepIdx || s.stepIndex === stepIdx - 1
    );

    for (const step of candidateSteps) {
      if (step.toolCalls && step.toolCalls.length > 0) {
        const tc = step.toolCalls[0];
        if (tc.args) {
          args = tc.args;
          commandLine = (tc.args.CommandLine as string) || (tc.args.command as string) || undefined;
          targetFile = (tc.args.TargetFile as string) || (tc.args.path as string) || undefined;
        }
        break;
      }
    }

    // 2. Fallback to transcript file if not yet cached in recentSteps
    if (!commandLine && !targetFile && this.transcriptPath && fs.existsSync(this.transcriptPath)) {
      try {
        const content = fs.readFileSync(this.transcriptPath, 'utf-8');
        const lines = content.split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (!line) continue;
          try {
            const parsed = JSON.parse(line);
            if (
              (parsed.step_index === stepIdx || parsed.step_index === stepIdx - 1) &&
              Array.isArray(parsed.tool_calls) &&
              parsed.tool_calls.length > 0
            ) {
              const tc = parsed.tool_calls[0];
              const tcArgs = (tc.arguments || tc.args || {}) as Record<string, unknown>;
              args = tcArgs;
              commandLine = (tcArgs.CommandLine as string) || (tcArgs.command as string) || undefined;
              targetFile = (tcArgs.TargetFile as string) || (tcArgs.path as string) || undefined;
              break;
            }
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    }

    return {
      conversationId: this.activeConversationId || '',
      stepIdx,
      toolName,
      commandLine,
      targetFile,
      args,
    };
  }

  private transformRawStep(raw: Record<string, unknown>): AgentStep | null {
    if (typeof raw.step_index !== 'number') return null;

    // Detect messages dispatched via agy agentapi send-message (remote control typing)
    if (raw.type === 'SYSTEM_MESSAGE' && typeof raw.content === 'string') {
      const match = raw.content.match(/\[Message\][\s\S]*?content=([\s\S]*?)(?:\n<\/SYSTEM_MESSAGE>|$)/);
      if (match && match[1]) {
        return {
          stepIndex: raw.step_index,
          type: 'USER_INPUT',
          source: 'USER_EXPLICIT',
          status: 'DONE',
          createdAt: (raw.created_at as string) || new Date().toISOString(),
          content: match[1].trim(),
        };
      }
    }

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
