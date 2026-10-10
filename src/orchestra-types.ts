export type AgentRole =
  | "Coordinator"
  | "Website"
  | "CRM"
  | "Growth"
  | "Events"
  | "Billing"
  | "Review";
export type RunStatus =
  | "queued"
  | "planning"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "blocked"
  | "failed"
  | "canceled"
  | "interrupted";
export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  kind: "delegation" | "message" | "tool" | "system";
  createdAt: string;
}
export interface AgentTask {
  id: string;
  agent: AgentRole;
  instruction: string;
  status: string;
  summary?: string;
  model?: string;
}
export interface ToolReceipt {
  id: string;
  taskId: string;
  agent: AgentRole;
  tool: string;
  status: string;
  message: string;
  recordId?: string;
  url?: string;
  approvalId?: string;
  data?: unknown;
  createdAt: string;
}
export interface AgentRun {
  id: string;
  prompt: string;
  model: string;
  providerId?: string;
  agentModels?: Record<string, string>;
  title: string;
  status: RunStatus;
  tasks: AgentTask[];
  messages: AgentMessage[];
  receipts: ToolReceipt[];
  createdAt: string;
  updatedAt: string;
  summary?: string;
  error?: string;
}
export interface OrchestraState {
  runs: AgentRun[];
  activeRunId: string | null;
  defaultEmployeeModels?: Record<string, string>;
}
