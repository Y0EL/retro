import { EventEmitter } from "events"
import { createHash } from "crypto"
import { JobPayload, ProgressEvent, JobStatus, AgentType } from "./types.js"

function auditHash(event: ProgressEvent): string {
  return createHash("sha256")
    .update(JSON.stringify(event) + Date.now())
    .digest("hex")
    .slice(0, 16)
}

interface JobRecord {
  jobId: string
  status: "queued" | "running" | "done" | "failed"
  agentType: AgentType
  intent: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  events: ProgressEvent[]
  result?: unknown
}

class InMemoryStore extends EventEmitter {
  private jobs = new Map<string, JobRecord>()
  private queue: Array<{ jobId: string; payload: JobPayload }> = []
  private running = 0
  private readonly concurrency = 3

  createJob(jobId: string, payload: JobPayload): void {
    this.jobs.set(jobId, {
      jobId,
      status: "queued",
      agentType: payload.agentType,
      intent: payload.intent,
      createdAt: new Date().toISOString(),
      events: [],
    })
    this.queue.push({ jobId, payload })
  }

  setStatus(jobId: string, status: JobRecord["status"]): void {
    const job = this.jobs.get(jobId)
    if (!job) return
    job.status = status
    if (status === "running") job.startedAt = new Date().toISOString()
    if (status === "done" || status === "failed") {
      job.completedAt = new Date().toISOString()
      this.emit("jobComplete", jobId)
    }
  }

  appendEvent(jobId: string, event: ProgressEvent): void {
    const job = this.jobs.get(jobId)
    if (job) {
      const audited = { ...event, _audit_hash: auditHash(event) }
      job.events.push(audited as ProgressEvent)
      this.emit(`events:${jobId}`, audited)
    } else {
      this.emit(`events:${jobId}`, event)
    }
  }

  setResult(jobId: string, result: unknown): void {
    const job = this.jobs.get(jobId)
    if (job) job.result = result
  }

  getJob(jobId: string): JobRecord | undefined {
    return this.jobs.get(jobId)
  }

  listJobs(): JobRecord[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50)
  }

  dequeue(): { jobId: string; payload: JobPayload } | undefined {
    return this.queue.shift()
  }

  get runningCount() { return this.running }
  incRunning() { this.running++ }
  decRunning() { this.running-- }
}

export const store = new InMemoryStore()
