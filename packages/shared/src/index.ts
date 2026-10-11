/**
 * Antilink Shared Protocol Specification
 * Palenight Theme Compliant, Type-Safe Event Definitions
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
  decision: 'allow' | 'deny';
  reason?: string;
}

export type AntilinkClientMessage =
  | { type: 'AUTH'; token: string }
  | { type: 'GET_STATE' }
  | { type: 'SEND_PROMPT'; prompt: string }
  | { type: 'TOOL_CONFIRM'; payload: ToolConfirmationResponse }
  | { type: 'TOGGLE_CAFFEINATE'; enable: boolean }
  | { type: 'SCAN_PORTS' }
  | { type: 'EXEC_COMMAND'; command: string };

export type AntilinkServerMessage =
  | { type: 'AUTH_SUCCESS'; session: { paired: boolean; machineName: string } }
  | { type: 'AUTH_FAILED'; error: string }
  | { type: 'INITIAL_STATE'; data: AntilinkInitialState }
  | { type: 'AGENT_STEP_ADDED'; step: AgentStep }
  | { type: 'AGENT_STEP_UPDATED'; step: AgentStep }
  | { type: 'TOOL_CONFIRM_REQUEST'; payload: ToolConfirmationPayload }
  | { type: 'PORTS_UPDATED'; ports: DiscoveredPort[] }
  | { type: 'TELEMETRY_UPDATED'; telemetry: SystemTelemetry }
  | { type: 'TUNNEL_UPDATED'; tunnelUrl: string | null }
  | { type: 'COMMAND_OUTPUT'; output: string; exitCode?: number };

export interface AntilinkInitialState {
  machineName: string;
  tunnelUrl: string | null;
  localUrl: string;
  ports: DiscoveredPort[];
  telemetry: SystemTelemetry;
  activeConversationId: string | null;
  recentSteps: AgentStep[];
}
