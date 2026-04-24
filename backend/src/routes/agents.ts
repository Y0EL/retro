import { Hono } from "hono"
import { z } from "zod"
import { enqueueAgentJob } from "../queue/producer.js"
import { store } from "../store.js"
import { AgentType } from "../types.js"

const RunSchema = z.object({
  intent: z.string().min(1),
  agentType: z.enum(["discovery", "briefing", "proposal", "admin", "full"]).default("full"),
  context: z.record(z.unknown()).optional(),
  priority: z.number().optional(),
})

const PipelineSchema = z.object({
  intent: z.string().min(1),
  context: z.record(z.unknown()).optional(),
})

export const agentsRouter = new Hono()

agentsRouter.post("/run", async (c) => {
  const body = await c.req.json()
  const parsed = RunSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400)
  }
  const { intent, agentType, context, priority } = parsed.data
  const jobId = enqueueAgentJob({ intent, agentType: agentType as AgentType, context, priority })
  return c.json({ jobId })
})

agentsRouter.get("/status/:jobId", (c) => {
  const { jobId } = c.req.param()
  const job = store.getJob(jobId)
  if (!job) return c.json({ error: "Job not found" }, 404)
  return c.json({
    jobId: job.jobId,
    status: job.status,
    agentType: job.agentType,
    intent: job.intent,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    events: job.events,
    eventCount: job.events.length,
  })
})

agentsRouter.get("/result/:jobId", (c) => {
  const { jobId } = c.req.param()
  const job = store.getJob(jobId)
  if (!job) return c.json({ error: "Job not found" }, 404)
  if (!job.result) return c.json({ error: "Result not available yet" }, 404)
  return c.json({ jobId, result: job.result })
})

// Full pipeline: discovery → briefing → proposal (auto-chained via orchestrator)
agentsRouter.post("/pipeline", async (c) => {
  const body = await c.req.json()
  const parsed = PipelineSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const { intent, context } = parsed.data
  const jobId = enqueueAgentJob({ intent, agentType: "discovery", context })
  return c.json({ jobId, message: "Pipeline started — discovery → briefing → proposal will auto-chain on completion" })
})

agentsRouter.get("/jobs", (c) => {
  const full = c.req.query("full") === "1"
  const jobs = store.listJobs().map(j => ({
    jobId: j.jobId,
    status: j.status,
    agentType: j.agentType,
    intent: j.intent,
    createdAt: j.createdAt,
    startedAt: j.startedAt,
    completedAt: j.completedAt,
    events: full ? j.events : j.events.slice(-20),
    result: j.result,
  }))
  return c.json({ jobs })
})

// Stop a running job gracefully (mark failed)
agentsRouter.post("/stop/:jobId", (c) => {
  const { jobId } = c.req.param()
  const job = store.getJob(jobId)
  if (!job) return c.json({ error: "Job not found" }, 404)
  if (job.status !== "running" && job.status !== "queued") {
    return c.json({ ok: false, message: "Job not active" })
  }
  store.setStatus(jobId, "failed")
  store.appendEvent(jobId, {
    type: "error",
    error: "Dihentikan secara manual oleh operator",
    message: "Job dihentikan manual",
    timestamp: new Date().toISOString(),
  })
  return c.json({ ok: true })
})

// ── Graph cache — skip recompute if no new events ─────────────────────────────
let _graphCache: { fingerprint: string; data: unknown } | null = null

function graphFingerprint(jobs: ReturnType<typeof store.listJobs>): string {
  return jobs.map(j => `${j.jobId}:${j.events.length}:${j.status}`).join("|")
}

// Build entity knowledge graph — only company/domain/email nodes (no run/search metadata)
agentsRouter.get("/graph", (c) => {
  const jobs = store.listJobs()
  const fp   = graphFingerprint(jobs)
  if (_graphCache && _graphCache.fingerprint === fp) {
    return c.json(_graphCache.data)
  }

  type EntityNode = {
    id: string; label: string; type: "company" | "domain" | "email"
    jobId: string; pending?: boolean
    meta?: {
      domain?: string; industri?: string; lokasi?: string
      deskripsi?: string; email?: string
      // Context provenance — shown in drawer
      foundVia?: string[]          // search queries that surfaced this entity
      snippets?: string[]          // news/web snippets mentioning this entity
      articles?: { title: string; url: string; snippet: string }[]
      sourceTool?: string          // primary tool that confirmed this
    }
  }
  type EntityEdge = { source: string; target: string; sourceId: string; targetId: string; type: "owns" | "found_at" | "has_email" }

  const nodeMap = new Map<string, EntityNode>()
  const edgeSet = new Set<string>()
  const edges: EntityEdge[] = []

  function addEdge(sId: string, tId: string, type: EntityEdge["type"]) {
    const key = `${sId}>${tId}`
    if (!edgeSet.has(key)) {
      edgeSet.add(key)
      edges.push({ source: sId, target: tId, sourceId: sId, targetId: tId, type })
    }
  }

  const SEARCH_TOOLS = new Set(["search_news", "search_web", "search_google", "search_linkedin", "search_company", "search_people"])

  function stripHtml(s: string): string {
    return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
  }

  for (const job of jobs) {
    const urlToCompany     = new Map<string, string>()
    const lastToolCallInput = new Map<string, Record<string, unknown>>() // tool → last input

    for (const ev of job.events) {
      // ── Track tool_call inputs so tool_result can access the query ──
      if (ev.type === "tool_call" && ev.input) {
        lastToolCallInput.set(ev.tool || "", ev.input as Record<string, unknown>)
      }

      // ── Pending company node while profile_company is in-flight ──
      if (ev.type === "tool_call" && ev.tool === "profile_company") {
        const inp = ev.input as Record<string, unknown> | null
        const name = String(inp?.company_name || inp?.name || "")
        if (!name) continue
        const cId = `company-${name.toLowerCase().replace(/\W+/g, "-")}`
        if (!nodeMap.has(cId)) {
          nodeMap.set(cId, { id: cId, label: name, type: "company", jobId: job.jobId, pending: true })
        }
        // Track: crawl_website calls after this will associate with this company
        if (inp?.domain) urlToCompany.set(String(inp.domain), cId)
        continue
      }

      // ── Pending domain while crawl_website is in-flight ──
      if (ev.type === "tool_call" && ev.tool === "crawl_website") {
        const inp = ev.input as Record<string, unknown> | null
        if (!inp?.url) continue
        try {
          const host = new URL(String(inp.url)).hostname
          const dId = `domain-${host}`
          if (!nodeMap.has(dId)) {
            nodeMap.set(dId, { id: dId, label: host, type: "domain", jobId: job.jobId, pending: true })
          }
        } catch { /* */ }
        continue
      }

      if (ev.type !== "tool_result" || !ev.success) continue
      const output = ev.output as Record<string, unknown> | null
      if (!output) continue

      // ── profile_company → company node + domain edge ──────────
      if (ev.tool === "profile_company" && output.company_name) {
        const cId = `company-${String(output.company_name).toLowerCase().replace(/\W+/g, "-")}`
        nodeMap.set(cId, {
          id: cId, label: String(output.company_name), type: "company", jobId: job.jobId, pending: false,
          meta: {
            domain:    output.domain    ? String(output.domain)    : undefined,
            industri:  output.industry  ? String(output.industry)  : undefined,
            lokasi:    output.location  ? String(output.location)  : undefined,
            deskripsi: output.description ? String(output.description) : undefined,
            email:     output.email     ? String(output.email)     : undefined,
            sourceTool: "profile_company",
          },
        })
        if (output.domain) {
          const dId = `domain-${output.domain}`
          nodeMap.set(dId, { id: dId, label: String(output.domain), type: "domain", jobId: job.jobId })
          addEdge(cId, dId, "owns")
          urlToCompany.set(String(output.domain), cId)
        }
        if (typeof output.email === "string" && output.email) {
          const eId = `email-${output.email}`
          nodeMap.set(eId, { id: eId, label: output.email, type: "email", jobId: job.jobId })
          addEdge(cId, eId, "has_email")
        }
      }

      // ── crawl_website → confirm domain, link to company if known ─
      if (ev.tool === "crawl_website" && output.url) {
        try {
          const host = new URL(String(output.url)).hostname
          const dId = `domain-${host}`
          const existing = nodeMap.get(dId)
          nodeMap.set(dId, { id: dId, label: host, type: "domain", jobId: job.jobId, pending: false, meta: existing?.meta })
          const parentCompany = urlToCompany.get(host)
          if (parentCompany) addEdge(parentCompany, dId, "owns")
        } catch { /* */ }
      }

      // ── discover_emails → email nodes linked to domain ──────────
      if (ev.tool === "discover_emails" && Array.isArray(output.emails)) {
        const inp2 = ev.input as Record<string, unknown> | null
        const sourceUrl = String(inp2?.url || inp2?.domain || "")
        let parentDomain: string | null = null
        try { parentDomain = sourceUrl ? `domain-${new URL(sourceUrl).hostname}` : null } catch { /* */ }

        for (const email of (output.emails as string[]).slice(0, 8)) {
          if (typeof email !== "string") continue
          const eId = `email-${email}`
          nodeMap.set(eId, { id: eId, label: email, type: "email", jobId: job.jobId })
          if (parentDomain && nodeMap.has(parentDomain)) {
            addEdge(parentDomain, eId, "has_email")
          }
        }
      }

      // ── search results → company + domain entities with provenance ─
      if (SEARCH_TOOLS.has(ev.tool || "")) {
        const inp2  = lastToolCallInput.get(ev.tool || "") || (ev.input as Record<string, unknown> | null) || {}
        const query = String(inp2.query || inp2.q || inp2.keyword || "")
        const toolName = ev.tool || "search"
        const results = (output.results || output.items || output.articles || []) as Record<string, unknown>[]

        if (Array.isArray(results)) {
          for (const item of results.slice(0, 10)) {
            const url     = String(item.url || item.link || item.href || "")
            const title   = stripHtml(String(item.title || item.name || item.company_name || ""))
            const snippet = stripHtml(String(item.snippet || item.description || item.summary || item.body || "")).slice(0, 200)

            if (url && url.startsWith("http")) {
              try {
                const host = new URL(url).hostname
                const dId  = `domain-${host}`
                const existing = nodeMap.get(dId)
                const prevArticles = existing?.meta?.articles ?? []
                const prevVia = existing?.meta?.foundVia ?? []
                nodeMap.set(dId, {
                  id: dId, label: host, type: "domain", jobId: job.jobId,
                  meta: {
                    ...existing?.meta,
                    sourceTool: toolName,
                    foundVia: prevVia.includes(query) ? prevVia : [...prevVia, query].slice(0, 3),
                    articles: [...prevArticles, { title: title.slice(0, 80), url, snippet }].slice(0, 5),
                  },
                })
              } catch { /* */ }
            }

            // Only add as company if it looks like an actual company name (has company identifier)
            const COMPANY_PATTERN = /\b(PT|CV|UD|PD|BUMD|Inc\.?|Corp\.?|Ltd\.?|LLC|GmbH|S\.A\.|Tbk|Persero)\b/i
            if (title && title.length > 3 && title.length < 55 && !title.includes(". ") && !title.startsWith("http") && COMPANY_PATTERN.test(title)) {
              const cId = `company-${title.toLowerCase().replace(/\W+/g, "-")}`
              const existing = nodeMap.get(cId)
              const prevVia = existing?.meta?.foundVia ?? []
              const prevSnippets = existing?.meta?.snippets ?? []
              nodeMap.set(cId, {
                id: cId, label: title, type: "company", jobId: job.jobId,
                pending: existing?.pending ?? false,
                meta: {
                  ...existing?.meta,
                  sourceTool: existing?.meta?.sourceTool ?? toolName,
                  foundVia: prevVia.includes(query) ? prevVia : [...prevVia, query].slice(0, 3),
                  snippets: snippet ? [...prevSnippets, snippet].slice(0, 3) : prevSnippets,
                },
              })
            }
          }
        }

        const flatList = (output.companies || output.names || output.entities || []) as string[]
        if (Array.isArray(flatList)) {
          for (const name of flatList.slice(0, 8)) {
            if (typeof name === "string" && name.length > 2) {
              const cId = `company-${name.toLowerCase().replace(/\W+/g, "-")}`
              if (!nodeMap.has(cId)) {
                nodeMap.set(cId, {
                  id: cId, label: name, type: "company", jobId: job.jobId,
                  meta: { sourceTool: toolName, foundVia: query ? [query] : [] },
                })
              }
            }
          }
        }
      }
    }
  }

  const result = { nodes: Array.from(nodeMap.values()), edges }
  _graphCache = { fingerprint: fp, data: result }
  return c.json(result)
})
