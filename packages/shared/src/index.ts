/**
 * Antilink Shared Protocol Specification
 * Full Antigravity Remote Control Parity + SQLite Authoritative Metadata
 */

export interface SystemTelemetry {
  platform: string;
  hostname: string;
  batteryPercent: number | null;
  isCharging: boolean | null;
  caffeinateActive: boolean;
  cpuLoad: number;
  uptimeSeconds: number;
}

export interface DiscoveredPort {
  port: number;
  name: string;
  isOpen: boolean;
  serviceType: 'frontend' | 'api' | 'database' | 'custom';
  url: string;
  previewPath: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  preview?: string;
  updatedAt: string;
  isActive: boolean;
  stepCount: number;
}

export interface SubagentInfo {
  id: string;
  role: string;
  typeName: string;
  state: 'running' | 'idle' | 'waiting_for_input' | 'canceled' | 'errored';
  createdAt: string;
}

export interface BackgroundTaskInfo {
  id: string;
  command: string;
  status: 'RUNNING' | 'DONE' | 'ERROR' | 'CANCELED';
  logPath: string;
  createdAt: string;
}

export interface ArtifactInfo {
  stepIndex: number;
  title: string;
  summary: string;
  targetFile?: string;
  content: string;
  createdAt: string;
}

export interface AgentStep {
  stepIndex: number;
  type: string;
  source: string;
  status: 'PENDING' | 'DONE' | 'ERROR' | 'WAITING_CONFIRMATION';
  createdAt: string;
  content?: string;
  thinking?: string;
  toolCalls?: AgentToolCall[];
}

export interface AgentToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
  output?: string;
  isConfirmationRequired?: boolean;
}

export interface ToolConfirmationPayload {
  conversationId: string;
  stepIdx: number;
  toolName: string;
  commandLine?: string;
  targetFile?: string;
  args: Record<string, unknown>;
}

export interface ToolConfirmationResponse {
  conversationId: string;
  stepIdx: number;
  approved: boolean;
  decision?: 'allow' | 'deny';
  optionNumber?: number; // 1, 2, 3, or 4
  commandLine?: string;
  reason?: string;
}

export interface QueuedPrompt {
  id: string;
  text: string;
  timestamp: string;
  conversationId: string;
}

export type AntilinkClientMessage =
  | { type: 'AUTH'; token: string }
  | { type: 'DEVICE_HANDSHAKE'; deviceId: string; deviceName: string; token: string; pin?: string }
  | { type: 'PAIR_VERIFY'; deviceId: string; code: string }
  | { type: 'PIN_VERIFY'; pin: string }
  | { type: 'GET_STATE' }
  | { type: 'SWITCH_CONVERSATION'; conversationId: string }
  | { type: 'SEND_PROMPT'; prompt: string }
  | { type: 'CANCEL_QUEUED_PROMPT'; promptId: string }
  | { type: 'TOOL_CONFIRM'; payload: ToolConfirmationResponse }
  | { type: 'TOGGLE_CAFFEINATE'; enable: boolean }
  | { type: 'SCAN_PORTS' }
  | { type: 'EXEC_COMMAND'; command: string }
  | { type: 'KILL_TASK'; taskId: string };

export type AntilinkServerMessage =
  | { type: 'AUTH_SUCCESS'; session: { paired: boolean; machineName: string } }
  | { type: 'AUTH_FAILED'; error: string }
  | { type: 'PAIR_CHALLENGE'; deviceId: string; deviceName: string; message: string }
  | { type: 'PIN_REQUIRED'; error?: string }
  | { type: 'SECURITY_ALERT'; message: string }
  | { type: 'INITIAL_STATE'; data: AntilinkInitialState }
  | { type: 'CONVERSATIONS_UPDATED'; conversations: ConversationSummary[] }
  | { type: 'SUBAGENTS_UPDATED'; subagents: SubagentInfo[] }
  | { type: 'TASKS_UPDATED'; tasks: BackgroundTaskInfo[] }
  | { type: 'ARTIFACTS_UPDATED'; artifacts: ArtifactInfo[] }
  | { type: 'AGENT_STEP_ADDED'; step: AgentStep }
  | { type: 'AGENT_STEP_UPDATED'; step: AgentStep }
  | { type: 'TOOL_CONFIRM_REQUEST'; payload: ToolConfirmationPayload }
  | { type: 'PORTS_UPDATED'; ports: DiscoveredPort[] }
  | { type: 'TELEMETRY_UPDATED'; telemetry: SystemTelemetry }
  | { type: 'TUNNEL_UPDATED'; tunnelUrl: string | null }
  | { type: 'PROMPT_QUEUE_UPDATED'; queue: QueuedPrompt[] }
  | { type: 'AGENT_STATUS_CHANGED'; isWorking: boolean }
  | { type: 'TOOL_CONFIRM_RESOLVED'; stepIdx: number }
  | { type: 'COMMAND_OUTPUT'; output: string; exitCode?: number };

export interface AntilinkInitialState {
  machineName: string;
  activeConversationTitle?: string;
  tunnelUrl: string | null;
  localUrl: string;
  ports: DiscoveredPort[];
  telemetry: SystemTelemetry;
  activeConversationId: string | null;
  conversations: ConversationSummary[];
  subagents: SubagentInfo[];
  tasks: BackgroundTaskInfo[];
  artifacts: ArtifactInfo[];
  recentSteps: AgentStep[];
  isAgentWorking?: boolean;
  promptQueue?: QueuedPrompt[];
  activeConfirmation?: ToolConfirmationPayload | null;
}
