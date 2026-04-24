export type AgentType = "discovery" | "briefing" | "proposal" | "admin"

export interface JobPayload {
  intent: string
  context?: Record<string, unknown>
  agentType: AgentType
  priority?: number
}

export interface ProgressEvent {
  type: "tool_call" | "tool_result" | "thinking" | "completed" | "error"
  tool?: string
  input?: unknown
  output?: unknown
  success?: boolean
  error?: string
  message?: string
  timestamp: string
}

export interface AgentResult {
  success: boolean
  result?: string
  iterations?: number
  error?: string
}

export interface JobStatus {
  jobId: string
  status: "queued" | "running" | "done" | "failed"
  agentType: AgentType
  intent: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  events: ProgressEvent[]
  result?: AgentResult
}
