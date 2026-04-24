const BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001"

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

export interface Job {
  jobId: string
  status: "queued" | "running" | "done" | "failed"
  agentType: string
  intent: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  events?: ProgressEvent[]
  result?: { success: boolean; result?: string; error?: string; iterations?: number }
}

export interface ProgressEvent {
  type: string
  tool?: string
  input?: unknown
  output?: unknown
  success?: boolean
  error?: string
  message?: string
  timestamp: string
  _audit_hash?: string
}

// ── Jobs ─────────────────────────────────────────────────────
export const listJobs    = ()  => req<{ jobs: Job[] }>("/api/agents/jobs")
export const getJobStatus = (id: string) => req<Job>(`/api/agents/status/${id}`)
export const getJobResult = (id: string) => req<Job>(`/api/agents/result/${id}`)

export function runAgent(intent: string, agentType = "discovery", context: Record<string, unknown> = {}) {
  return req<{ jobId: string }>("/api/agents/run", {
    method: "POST",
    body: JSON.stringify({ intent, agentType, context }),
  })
}

export function runPipeline(intent: string) {
  return req<{ jobId: string }>("/api/agents/pipeline", {
    method: "POST",
    body: JSON.stringify({ intent }),
  })
}

export function stopJob(jobId: string) {
  return req<{ ok: boolean }>(`/api/agents/stop/${jobId}`, { method: "POST" })
}

// ── Knowledge Base ────────────────────────────────────────────
export interface KBEntry {
  id: string
  type: string
  tags?: string[]
  createdAt: string
  data: Record<string, unknown>
}

export const listKB    = (type?: string) => req<{ entries: KBEntry[] }>(`/api/kb${type ? `?type=${type}` : ""}`)
export const getKBEntry = (id: string)   => req<KBEntry>(`/api/kb/${id}`)

// ── Graph data ────────────────────────────────────────────────
export interface GraphNode {
  id: string; label: string
  type: "company" | "domain" | "email"
  jobId?: string; pending?: boolean
  meta?: {
    domain?: string; industri?: string; lokasi?: string; deskripsi?: string; email?: string
    sourceTool?: string
    foundVia?: string[]
    snippets?: string[]
    articles?: { title: string; url: string; snippet: string }[]
  }
}
export interface GraphEdge { source: string; target: string; type: "owns" | "found_at" | "has_email" | "context" }

export const getGraphData = () => req<{ nodes: GraphNode[]; edges: GraphEdge[] }>("/api/agents/graph")

// ── OSINT direct calls ────────────────────────────────────────
const GW = import.meta.env.VITE_GATEWAY_URL || "http://localhost:8000"

async function gw<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const r = await fetch(`${GW}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return r.json()
}

export const osintCompanyLookup    = (name: string, jurisdiction = "id") => gw("/company-lookup", { name, jurisdiction })
export const osintDomainReputation = (domain: string) => gw("/domain-reputation", { domain })
export const osintIpIntelligence   = (ip: string) => gw("/ip-intel", { ip })
export const osintSanctionsCheck   = (name: string, type = "company") => gw("/sanctions-check", { name, type })
export const osintThreatIntel      = (indicator: string, type = "domain") => gw("/threat-intel", { indicator, type })
export const osintWayback          = (url: string) => gw("/wayback", { url })
export const osintGeolocation      = (query: string) => gw("/geolocate", { query })
export const osintUrlScan          = (url: string) => gw("/url-scan", { url })

// ── Health ────────────────────────────────────────────────────
export async function checkHealth() {
  const t0 = Date.now()
  try {
    await fetch(`${GW}/health`)
    const gwMs = Date.now() - t0
    const t1 = Date.now()
    await fetch(`${BASE}/health`)
    const beMs = Date.now() - t1
    return { gateway: { ok: true, ms: gwMs }, backend: { ok: true, ms: beMs } }
  } catch {
    return { gateway: { ok: false, ms: 0 }, backend: { ok: false, ms: 0 } }
  }
}

// ── WebSocket subscription ────────────────────────────────────
const WS = BASE.replace(/^http/, "ws")

export function subscribeToJob(jobId: string, onEvent: (e: ProgressEvent | { type: "status"; status: string }) => void): () => void {
  const ws = new WebSocket(`${WS}/ws`)

  ws.onopen = () => { ws.send(JSON.stringify({ type: "subscribe", jobId })) }
  ws.onmessage = (e) => { try { onEvent(JSON.parse(e.data)) } catch { /* */ } }

  return () => {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: "unsubscribe", jobId })) } catch { /* */ }
    }
    if (ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) ws.close()
  }
}
