import { useState, useEffect, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { runAgent, runPipeline, stopJob, getJobStatus, subscribeToJob } from "../lib/api"
import type { Job, ProgressEvent } from "../lib/api"
import SynthesisReport from "../components/SynthesisReport"
import EmailDraftPanel from "../components/EmailDraftPanel"

const AGENT_CARDS = [
  {
    key: "full",
    label: "FULL PIPELINE",
    title: "Penjahit Bisnis",
    desc: "Cari perusahaan → profil → proposal → PDF outbound → draft email. Semua dalam satu run.",
    color: "var(--cc-status-done)",
    bg: "#0a2a1a",
  },
  {
    key: "discovery",
    label: "DISCOVERY",
    title: "Riset Perusahaan",
    desc: "Cari dan profil perusahaan di sektor yang diminta, simpan ke Knowledge Base, internal PDF",
    color: "var(--cc-signal-high)",
    bg: "var(--cc-signal-dim)",
  },
  {
    key: "proposal",
    label: "PROPOSAL",
    title: "Surat Penawaran",
    desc: "Buat proposal kemitraan B2B untuk perusahaan target, PDF outbound + draft email",
    color: "var(--cc-warn-elevated)",
    bg: "var(--cc-warn-dim)",
  },
  {
    key: "briefing",
    label: "BRIEFING",
    title: "Pre-Meeting Intel",
    desc: "Briefing pra-pertemuan: analisis kompetitor, pertanyaan CEO, PDF outbound",
    color: "#9d92d8",
    bg: "#1a1a3a",
  },
] as const

type AgentKey = "full" | "discovery" | "proposal" | "briefing"

// Extract download URLs recursively from a result object
function extractUrls(obj: unknown): string[] {
  if (!obj || typeof obj !== "object") return []
  const urls: string[] = []
  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (typeof v === "string" && (v.includes("/api/files/") || v.endsWith(".pdf"))) urls.push(v)
    else if (typeof v === "object") urls.push(...extractUrls(v))
  }
  return [...new Set(urls)]
}

function deepFind(obj: unknown, key: string): string | undefined {
  if (!obj || typeof obj !== "object") return undefined
  const rec = obj as Record<string, unknown>
  if (typeof rec[key] === "string") return rec[key] as string
  for (const v of Object.values(rec)) {
    const found = deepFind(v, key)
    if (found) return found
  }
  return undefined
}

export default function CommandCenter() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const prefill = searchParams.get("prefill") ?? ""

  const [agentType, setAgentType] = useState<AgentKey>("full")
  const [intent,    setIntent]    = useState(prefill)
  const [context,   setContext]   = useState("")
  const [busy,      setBusy]      = useState(false)
  const [jobId,     setJobId]     = useState<string | null>(null)
  const [job,       setJob]       = useState<Job | null>(null)
  const [events,    setEvents]    = useState<ProgressEvent[]>([])
  const logRef = useRef<HTMLDivElement>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  // Poll job status while running
  useEffect(() => {
    if (!jobId) return
    let alive = true
    let timer: ReturnType<typeof setTimeout>

    const unsub = subscribeToJob(jobId, (e) => {
      if ("status" in e && e.type === "status") {
        setJob(prev => prev ? { ...prev, status: e.status as Job["status"] } : prev)
      } else {
        setEvents(prev => [...prev, e as ProgressEvent])
        // Auto-scroll log
        setTimeout(() => {
          if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
        }, 50)
      }
    })
    unsubRef.current = unsub

    async function poll() {
      if (!alive) return
      try {
        const j = await getJobStatus(jobId!)
        if (!alive) return
        setJob(j)
        if (j.status === "done" || j.status === "failed") return
        timer = setTimeout(poll, 3000)
      } catch {
        if (alive) timer = setTimeout(poll, 5000)
      }
    }
    poll()
    return () => { alive = false; clearTimeout(timer); unsub() }
  }, [jobId])

  async function handleRun(e: React.FormEvent) {
    e.preventDefault()
    if (!intent.trim()) return
    setBusy(true)
    setEvents([])
    setJob(null)
    try {
      let ctx: Record<string, unknown> = {}
      if (context.trim()) {
        try { ctx = Object.fromEntries(context.split(",").map(s => s.split("=").map(p => p.trim()))) } catch { /* */ }
      }
      const r = await runAgent(intent.trim(), agentType, ctx)
      setJobId(r.jobId)
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  async function handleStop() {
    if (!jobId) return
    await stopJob(jobId)
    setJob(prev => prev ? { ...prev, status: "failed" } : prev)
  }

  function handleNewMission() {
    unsubRef.current?.()
    setJobId(null)
    setJob(null)
    setEvents([])
    setIntent("")
    setContext("")
  }

  const isRunning = job?.status === "running" || job?.status === "queued"
  const isDone    = job?.status === "done"
  const isFailed  = job?.status === "failed"
  const hasResult = isDone || isFailed

  // Extract result fields
  const res          = job?.result as Record<string, unknown> | undefined
  const synthesis    = res?.result as string | undefined
  const pdfUrls      = job?.result ? extractUrls(job.result) : []
  const productName  = res?.product_name as string | undefined
  const summary      = res?.summary as string | undefined
  const emailDrafts  = res?.email_drafts as Array<{ company: string; email: string; role: string; subject: string; body: string }> | undefined
  // legacy single draft fallback
  const emailSubject = !emailDrafts ? deepFind(job?.result, "email_subject") : undefined
  const emailBody    = !emailDrafts ? deepFind(job?.result, "email_body_preview") : undefined
  const targetCo     = !emailDrafts ? deepFind(job?.result, "target_company") : undefined

  // ── State: No job yet — LAUNCH ─────────────────────────────────────────────
  if (!jobId) return (
    <div className="cc-page">
      {/* Agent type selector */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {AGENT_CARDS.map(card => (
          <div
            key={card.key}
            onClick={() => setAgentType(card.key)}
            style={{
              padding: "14px 16px", cursor: "pointer",
              border: `1px solid ${agentType === card.key ? card.color : "var(--cc-border)"}`,
              borderTop: `3px solid ${agentType === card.key ? card.color : "var(--cc-border)"}`,
              background: agentType === card.key ? card.bg : "var(--cc-surface)",
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            <div style={{ fontSize: 8, fontFamily: "var(--font-data)", letterSpacing: "0.14em", color: card.color, marginBottom: 4 }}>
              {card.label}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cc-data-primary)", marginBottom: 5, fontFamily: "var(--font-ui)" }}>
              {card.title}
            </div>
            <div style={{ fontSize: 9, color: "var(--cc-data-muted)", lineHeight: 1.5 }}>
              {card.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Mission form */}
      <div className="cc-panel">
        <div className="cc-panel-hdr">
          <span className="cc-panel-title">
            <span className="cc-panel-title-num">02</span>MISSION INPUT
          </span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--cc-data-muted)" }}>
            {AGENT_CARDS.find(c => c.key === agentType)?.label}
          </span>
        </div>
        <div className="cc-panel-body">
          <form onSubmit={handleRun} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 9, fontFamily: "var(--font-data)", letterSpacing: "0.1em", color: "var(--cc-data-muted)", marginBottom: 6 }}>
                INTENT / MISI
              </label>
              <textarea
                value={intent}
                onChange={e => setIntent(e.target.value)}
                rows={4}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "var(--cc-elevated)", border: "1px solid var(--cc-border)",
                  borderLeft: "3px solid var(--cc-signal-high)",
                  color: "var(--cc-data-primary)", fontFamily: "var(--font-body)", fontSize: 13,
                  padding: "10px 12px", resize: "vertical", outline: "none",
                }}
                placeholder='Contoh: "Agrikultur dan teknologi pangan" atau "Startup fintech Series B Indonesia"'
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 9, fontFamily: "var(--font-data)", letterSpacing: "0.1em", color: "var(--cc-data-muted)", marginBottom: 6 }}>
                CONTEXT (opsional, format: key=nilai, key2=nilai2)
              </label>
              <input
                value={context}
                onChange={e => setContext(e.target.value)}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "var(--cc-elevated)", border: "1px solid var(--cc-border)",
                  color: "var(--cc-data-secondary)", fontFamily: "var(--font-data)", fontSize: 11,
                  padding: "8px 12px", outline: "none",
                }}
                placeholder="target_company=PT Pindad, focus=cyber"
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" disabled={busy || !intent.trim()} className="btn-cc btn-signal" style={{ flex: 1, padding: "12px" }}>
                {busy ? "MEMULAI..." : `JALANKAN ${AGENT_CARDS.find(c => c.key === agentType)?.label}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )

  // ── State: RUNNING or DONE ─────────────────────────────────────────────────
  return (
    <div className="cc-page">
      {/* Job header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: "12px 16px", background: "var(--cc-surface)", border: "1px solid var(--cc-border)" }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: isDone ? "var(--cc-status-done)" : isFailed ? "var(--cc-status-failed)" : "var(--cc-status-active)",
          boxShadow: isRunning ? `0 0 6px var(--cc-status-active)` : "none",
          animation: isRunning ? "pulse 1.5s ease-in-out infinite" : "none",
          flexShrink: 0,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontFamily: "var(--font-data)", color: "var(--cc-data-muted)", marginBottom: 2 }}>
            {jobId?.slice(0, 12)}… · {job?.agentType?.toUpperCase() ?? agentType.toUpperCase()}
          </div>
          <div style={{ fontSize: 12, color: "var(--cc-data-primary)", fontWeight: 600 }}>
            {job?.intent ?? intent}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isRunning && (
            <button onClick={handleStop} className="btn-cc btn-standard" style={{ fontSize: 10, padding: "5px 12px" }}>
              ■ STOP
            </button>
          )}
          <button onClick={handleNewMission} className="btn-cc btn-ghost" style={{ fontSize: 10, padding: "5px 12px" }}>
            + MISI BARU
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: hasResult ? "1fr 1fr" : "1fr", gap: 16 }}>
        {/* Live event log */}
        <div className="cc-panel">
          <div className="cc-panel-hdr">
            <span className="cc-panel-title">
              <span className="cc-panel-title-num" style={{ background: isRunning ? "var(--cc-status-active)" : "var(--cc-border)" }} />
              LIVE LOG
            </span>
            <span style={{ fontSize: 10, fontFamily: "var(--font-data)", color: "var(--cc-data-muted)" }}>
              {events.length} event
            </span>
          </div>
          <div
            ref={logRef}
            style={{
              height: hasResult ? 320 : 420, overflowY: "auto",
              background: "var(--cc-abyss)", padding: "10px 12px",
              fontFamily: "var(--font-data)", fontSize: 10,
            }}
          >
            {events.length === 0 && (
              <div style={{ color: "var(--cc-data-muted)", padding: "20px 0", textAlign: "center" }}>
                {isRunning ? "Menunggu event pertama..." : "Memulai..."}
              </div>
            )}
            {events.map((ev, i) => (
              <div key={i} style={{ marginBottom: 4, display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{
                  color: ev.type === "tool_call" ? "var(--cc-signal-medium)" :
                         ev.type === "tool_result" ? (ev.success ? "var(--cc-status-done)" : "var(--cc-status-failed)") :
                         ev.type === "error" ? "var(--cc-status-failed)" : "var(--cc-data-muted)",
                  flexShrink: 0, fontSize: 9,
                }}>
                  {ev.type === "tool_call" ? "CALL" : ev.type === "tool_result" ? (ev.success ? "OK" : "ERR") :
                   ev.type === "completed" ? "DONE" : ev.type === "error" ? "ERR!" : "INFO"}
                </span>
                <span style={{ color: ev.type === "error" ? "var(--cc-status-failed)" : "var(--cc-data-secondary)" }}>
                  {ev.tool ? `${ev.tool} ` : ""}
                  {ev.message ?? (ev.type === "tool_call" && ev.input
                    ? JSON.stringify(ev.input).slice(0, 80) + (JSON.stringify(ev.input).length > 80 ? "…" : "")
                    : ev.type === "tool_result"
                    ? (ev.success ? "selesai" : (ev.error ?? "gagal"))
                    : ""
                  )}
                </span>
              </div>
            ))}
            {isRunning && (
              <div style={{ color: "var(--cc-data-muted)", animation: "pulse 1s infinite" }}>▌</div>
            )}
          </div>
        </div>

        {/* Result panel — only shown when done */}
        {hasResult && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Status */}
            <div style={{
              padding: "10px 14px",
              background: isDone ? "#0a1a0f" : "var(--cc-warn-dim)",
              border: `1px solid ${isDone ? "var(--cc-status-done)" : "var(--cc-status-failed)"}`,
              fontSize: 11, color: isDone ? "var(--cc-status-done)" : "var(--cc-status-failed)",
              fontFamily: "var(--font-data)", letterSpacing: "0.06em",
            }}>
              {isDone ? "✓ SELESAI" : "✗ GAGAL"} · {job?.completedAt ? new Date(job.completedAt).toLocaleTimeString("id-ID") : ""}
            </div>

            {/* Product name banner */}
            {productName && (
              <div style={{
                padding: "12px 16px",
                background: "#0a2a1a",
                border: "1px solid var(--cc-status-done)",
                borderLeft: "4px solid var(--cc-status-done)",
              }}>
                <div style={{ fontSize: 8, fontFamily: "var(--font-data)", letterSpacing: "0.15em", color: "var(--cc-status-done)", marginBottom: 4 }}>
                  PRODUK BARU GSP
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--cc-data-primary)" }}>{productName}</div>
                {summary && <div style={{ fontSize: 11, color: "var(--cc-data-secondary)", marginTop: 6, lineHeight: 1.6 }}>{summary}</div>}
              </div>
            )}

            {/* Synthesis */}
            {synthesis && (
              <div>
                <div style={{ fontSize: 9, fontFamily: "var(--font-data)", letterSpacing: "0.12em", color: "var(--cc-data-muted)", marginBottom: 6 }}>
                  SINTESIS INTELIJEN
                </div>
                <SynthesisReport text={synthesis} />
              </div>
            )}

            {/* PDF Downloads */}
            {pdfUrls.length > 0 && (
              <div style={{ border: "1px solid var(--cc-border)", background: "var(--cc-abyss)", padding: "12px 14px" }}>
                <div style={{ fontSize: 9, fontFamily: "var(--font-data)", letterSpacing: "0.12em", color: "var(--cc-data-muted)", marginBottom: 8 }}>
                  DOKUMEN PDF ({pdfUrls.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {pdfUrls.map((url, i) => {
                    const name = url.split("/").pop() ?? "laporan.pdf"
                    const isOutbound = name.includes("outbound") || name.includes("proposal")
                    return (
                      <a key={i} href={url} download target="_blank" rel="noopener noreferrer"
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 10px",
                          background: isOutbound ? "var(--cc-warn-dim)" : "var(--cc-elevated)",
                          border: `1px solid ${isOutbound ? "var(--cc-warn-elevated)" : "var(--cc-border)"}`,
                          color: isOutbound ? "var(--cc-warn-elevated)" : "var(--cc-data-secondary)",
                          fontSize: 10, fontFamily: "var(--font-data)",
                          textDecoration: "none",
                        }}>
                        <span>↓</span>
                        <span>{isOutbound ? "Proposal Outbound" : "Laporan Internal"}</span>
                        <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--cc-data-muted)" }}>{name.slice(0, 30)}</span>
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Multiple email drafts per company */}
            {emailDrafts && emailDrafts.length > 0 && (
              <div>
                <div style={{ fontSize: 9, fontFamily: "var(--font-data)", letterSpacing: "0.12em", color: "var(--cc-data-muted)", marginBottom: 8 }}>
                  DRAFT EMAIL ({emailDrafts.length} perusahaan)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {emailDrafts.map((d, i) => (
                    <div key={i}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 12px", background: "var(--cc-elevated)",
                        borderLeft: "3px solid var(--cc-signal-high)",
                        marginBottom: 2,
                      }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--cc-data-primary)", flex: 1 }}>{d.company}</span>
                        {d.role && <span style={{ fontSize: 9, color: "var(--cc-data-muted)", fontFamily: "var(--font-data)" }}>{d.role}</span>}
                        {d.email && d.email !== "belum ditemukan" && (
                          <span style={{ fontSize: 9, color: "var(--cc-signal-high)", fontFamily: "var(--font-data)" }}>{d.email}</span>
                        )}
                      </div>
                      <EmailDraftPanel subject={d.subject} body={d.body} targetCompany={d.company} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Legacy single draft fallback */}
            {!emailDrafts && <EmailDraftPanel subject={emailSubject} body={emailBody} targetCompany={targetCo} />}

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-cc btn-signal" style={{ flex: 1, fontSize: 10 }} onClick={() => navigate(`/orkestrasi?job=${jobId}`)}>
                Lihat di Graph
              </button>
              <button className="btn-cc btn-standard" style={{ flex: 1, fontSize: 10 }} onClick={() => navigate("/intel")}>
                Intel Database
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
