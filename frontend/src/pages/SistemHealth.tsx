import { useEffect, useState } from "react"
import { listJobs } from "../lib/api"
import type { Job } from "../lib/api"
import KPICard from "../components/KPICard"
import StatusDot from "../components/StatusDot"
import { fmtDuration } from "../lib/utils"

interface ServiceStatus { ok: boolean; ms: number; lastCheck: string }

async function ping(url: string): Promise<ServiceStatus> {
  const t0 = Date.now()
  try {
    await fetch(url, { signal: AbortSignal.timeout(3000) })
    return { ok: true, ms: Date.now() - t0, lastCheck: new Date().toLocaleTimeString("id-ID") }
  } catch {
    return { ok: false, ms: 0, lastCheck: new Date().toLocaleTimeString("id-ID") }
  }
}

export default function SistemHealth() {
  const [jobs,    setJobs]    = useState<Job[]>([])
  const [gateway, setGateway] = useState<ServiceStatus | null>(null)
  const [backend, setBackend] = useState<ServiceStatus | null>(null)

  useEffect(() => {
    async function fetchAll() {
      const [j, gw, be] = await Promise.all([
        listJobs().catch(() => ({ jobs: [] })),
        ping("http://localhost:8000/health"),
        ping("http://localhost:3001/health"),
      ])
      setJobs(j.jobs || [])
      setGateway(gw)
      setBackend(be)
    }
    fetchAll()
    const id = setInterval(fetchAll, 10000)
    return () => clearInterval(id)
  }, [])

  const today = jobs.filter(j => {
    const d = new Date(j.createdAt)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  })
  const runningJobs = jobs.filter(j => j.status === "running")
  const failedToday = today.filter(j => j.status === "failed")
  const doneToday   = today.filter(j => j.status === "done")

  const avgDur = (() => {
    const finished = jobs.filter(j => j.status === "done" && j.startedAt && j.completedAt)
    if (!finished.length) return "—"
    const avg = finished.reduce((acc, j) => {
      const ms = new Date(j.completedAt!).getTime() - new Date(j.startedAt!).getTime()
      return acc + ms
    }, 0) / finished.length
    const sec = Math.round(avg / 1000)
    return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`
  })()

  const recentErrors = jobs
    .filter(j => j.status === "failed")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  return (
    <div className="cc-page">
      {/* Service cards */}
      <div className="cc-grid-3">
        <ServiceCard title="Gateway" url="localhost:8000" status={gateway} model={null} />
        <ServiceCard title="Backend" url="localhost:3001" status={backend} model={null} />
        <ServiceCard title="Ollama"  url="100.75.135.17:11434" status={{ ok: true, ms: 0, lastCheck: "" }} model="qwen3.5:9b" />
      </div>

      {/* Metrics */}
      <div className="cc-kpi-grid">
        <KPICard label="Queue Depth"    value={jobs.filter(j => j.status === "queued").length}  sub="antrian"         />
        <KPICard label="Running"        value={`${runningJobs.length}/3`}                       sub="max concurrent"  variant={runningJobs.length > 0 ? "signal" : "idle"} />
        <KPICard label="Done Hari Ini"  value={doneToday.length}                                sub="completed today" variant="done" />
        <KPICard label="Gagal Hari Ini" value={failedToday.length}                              sub="failed today"    variant={failedToday.length > 0 ? "warn" : "idle"} />
        <KPICard label="Avg Durasi"     value={avgDur}                                          sub="per job"         />
      </div>

      {/* Recent errors */}
      <div className="cc-panel">
        <div className="cc-panel-hdr">
          <span className="cc-panel-title">
            <span className="cc-panel-title-num">10</span>ERROR TERBARU
          </span>
          <span style={{ fontSize: 10, color: "var(--cc-data-muted)" }}>{recentErrors.length} job gagal</span>
        </div>
        {recentErrors.length === 0 ? (
          <div className="cc-empty">
            <div className="cc-empty-icon">OK</div>
            <div>Tidak ada error terbaru. Sistem berjalan normal.</div>
          </div>
        ) : (
          <table className="cc-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Intent</th>
                <th>Agent</th>
                <th>Error</th>
                <th>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {recentErrors.map(job => {
                const errEvent = (job.events || []).find(e => e.type === "error" || (e.type === "tool_result" && !e.success))
                return (
                  <tr key={job.jobId}>
                    <td className="mono" style={{ fontSize: 10 }}>{job.jobId.slice(0, 10)}…</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{job.intent}</td>
                    <td><span className={`cc-badge cc-badge--${job.agentType}`}>{job.agentType}</span></td>
                    <td style={{ fontSize: 11, color: "var(--cc-status-failed)", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {errEvent?.error || "Unknown error"}
                    </td>
                    <td className="mono" style={{ fontSize: 10 }}>{new Date(job.createdAt).toLocaleTimeString("id-ID")}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function ServiceCard({ title, url, status, model }: {
  title: string; url: string;
  status: ServiceStatus | null; model: string | null
}) {
  const s = status?.ok === undefined ? "idle" : status.ok ? "done" : "failed"
  return (
    <div className={`cc-kpi-card cc-kpi-card--${s === "done" ? "done" : s === "failed" ? "warn" : "idle"}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <StatusDot status={s as "done" | "failed" | "idle"} />
        <span className="cc-kpi-label" style={{ margin: 0 }}>{title}</span>
      </div>
      <div style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--cc-data-tertiary)", marginBottom: 4 }}>
        {url}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: status?.ok ? "var(--cc-status-done)" : status?.ok === false ? "var(--cc-status-failed)" : "var(--cc-data-muted)" }}>
        {status === null ? "Memeriksa..." : status.ok ? "ONLINE" : "OFFLINE"}
        {status?.ms ? ` · ${status.ms}ms` : ""}
      </div>
      {model && <div style={{ fontSize: 10, color: "var(--cc-data-muted)", marginTop: 2 }}>{model}</div>}
      {status?.lastCheck && (
        <div style={{ fontSize: 10, color: "var(--cc-data-ghost)", marginTop: 4, fontFamily: "var(--font-data)" }}>
          Last check: {status.lastCheck}
        </div>
      )}
    </div>
  )
}
