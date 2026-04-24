import { randomUUID } from "crypto"
import { JobPayload, AgentType } from "../types.js"
import { store } from "../store.js"

export function enqueueAgentJob(payload: {
  intent: string
  context?: Record<string, unknown>
  agentType: AgentType
  priority?: number
}): string {
  const jobId = randomUUID()
  store.createJob(jobId, payload as JobPayload)
  return jobId
}
