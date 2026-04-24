import { EventEmitter } from "events"
import { createHash } from "crypto"
import { JobPayload, ProgressEvent, JobStatus, AgentType } from "./types.js"
import { upsertJob, listJobsFromDB, saveKBEntry } from "./db.js"

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

// ── Auto-extract KB entries from tool results ─────────────────────────────────
const KB_TOOLS = new Set(["profile_company", "save_to_knowledge_base", "generate_proposal", "generate_briefing_report"])

function maybeExtractKB(jobId: string, event: ProgressEvent): void {
  if (event.type !== "tool_result" || !event.success || !event.output) return
  if (!KB_TOOLS.has(event.tool ?? "")) return

  const out = event.output as Record<string, unknown>

  try {
    if (event.tool === "profile_company" && out.company_name) {
      saveKBEntry({
        type:   "company_profile",
        name:   String(out.company_name),
        domain: out.domain ? String(out.domain) : undefined,
        tags:   out.industry ? [String(out.industry)] : [],
        jobId,
        data:   out,
      })
    } else if (event.tool === "save_to_knowledge_base") {
      const inp = event.input as Record<string, unknown> | null ?? {}
      saveKBEntry({
        type:   String(inp.type ?? "research"),
        name:   out.name ? String(out.name) : (inp.title ? String(inp.title) : undefined),
        domain: out.domain ? String(out.domain) : undefined,
        tags:   Array.isArray(inp.tags) ? inp.tags as string[] : [],
        jobId,
        data:   { ...out, _input: inp },
      })
    } else if (event.tool === "generate_proposal") {
      const inp = event.input as Record<string, unknown> | null ?? {}
      saveKBEntry({
        type:   "proposal",
        name:   out.target_company ? String(out.target_company) : (inp.target_company ? String(inp.target_company) : "Proposal"),
        domain: undefined,
        tags:   ["proposal"],
        jobId,
        data:   out,
      })
    } else if (event.tool === "generate_briefing_report") {
      const inp = event.input as Record<string, unknown> | null ?? {}
      saveKBEntry({
        type:   "research",
        name:   inp.company_name ? String(inp.company_name) : "Briefing",
        tags:   ["briefing"],
        jobId,
        data:   out,
      })
    }
  } catch { /* ignore kb save errors */ }
}

class InMemoryStore extends EventEmitter {
  private jobs = new Map<string, JobRecord>()
  private queue: Array<{ jobId: string; payload: JobPayload }> = []
  private running = 0
  private readonly concurrency = 3

  constructor() {
    super()
    this.loadFromDB()
  }

  // ── Restore persisted jobs on startup ─────────────────────────────────────
  private loadFromDB() {
    try {
      const dbJobs = listJobsFromDB()
      for (const j of dbJobs) {
        this.jobs.set(j.jobId, {
          jobId:       j.jobId,
          status:      (j.status as JobRecord["status"]) ?? "done",
          agentType:   (j.agentType as AgentType) ?? "discovery",
          intent:      j.intent ?? "",
          createdAt:   j.createdAt ?? new Date().toISOString(),
          startedAt:   j.startedAt,
          completedAt: j.completedAt,
          events:      j.events ? JSON.parse(j.events) : [],
          result:      j.result ? JSON.parse(j.result) : undefined,
        })
      }
    } catch { /* first run — no DB yet */ }
  }

  createJob(jobId: string, payload: JobPayload): void {
    const record: JobRecord = {
      jobId,
      status:    "queued",
      agentType: payload.agentType,
      intent:    payload.intent,
      createdAt: new Date().toISOString(),
      events:    [],
    }
    this.jobs.set(jobId, record)
    this.queue.push({ jobId, payload })
    this._persistJob(jobId)
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
    this._persistJob(jobId)
  }

  appendEvent(jobId: string, event: ProgressEvent): void {
    const job = this.jobs.get(jobId)
    if (job) {
      const audited = { ...event, _audit_hash: auditHash(event) }
      job.events.push(audited as ProgressEvent)
      this.emit(`events:${jobId}`, audited)
      // Auto-extract KB entries from tool results
      maybeExtractKB(jobId, event)
      // Persist job state periodically (every 10 events to avoid thrashing)
      if (job.events.length % 10 === 0) this._persistJob(jobId)
    } else {
      this.emit(`events:${jobId}`, event)
    }
  }

  setResult(jobId: string, result: unknown): void {
    const job = this.jobs.get(jobId)
    if (job) {
      job.result = result
      this._persistJob(jobId)
    }
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

  private _persistJob(jobId: string): void {
    const job = this.jobs.get(jobId)
    if (!job) return
    try {
      upsertJob({
        jobId:       job.jobId,
        status:      job.status,
        agentType:   job.agentType,
        intent:      job.intent,
        createdAt:   job.createdAt,
        startedAt:   job.startedAt,
        completedAt: job.completedAt,
        result:      job.result !== undefined ? JSON.stringify(job.result) : undefined,
        events:      JSON.stringify(job.events.slice(-200)), // keep last 200 events
      })
    } catch { /* ignore persist errors */ }
  }
}

export const store = new InMemoryStore()
