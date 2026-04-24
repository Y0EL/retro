import { useEffect, useState } from "react"
import { listJobs, checkHealth } from "../lib/api"
import type { Job } from "../lib/api"
import KPICard from "../components/KPICard"
import JobTable from "../components/JobTable"
import StatusDot from "../components/StatusDot"
import { useNavigate } from "react-router-dom"

export default function Ikhtisar() {
  const [jobs,   setJobs]   = useState<Job[]>([])
  const [health, setHealth] = useState<{ gateway: { ok: boolean; ms: number }; backend: { ok: boolean; ms: number } } | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetch() {
      try {
        const [j, h] = await Promise.all([listJobs(), checkHealth()])
        setJobs(j.jobs || [])
        setHealth(h)
      } catch { /* */ }
    }
    fetch()
    const id = setInterval(fetch, 8000)
    return () => clearInterval(id)
  }, [])

  const stats = {
    total:   jobs.length,
    running: jobs.filter(j => j.status === "running" || j.status === "queued").length,
    done:    jobs.filter(j => j.status === "done").length,
    failed:  jobs.filter(j => j.status === "failed").length,
    profiles: jobs.filter(j => j.status === "done" && j.agentType === "discovery").length,
  }

  const agentCounts = jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.agentType] = (acc[j.agentType] || 0) + 1
    return acc
  }, {})

  const recent = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6)

  return (
    <div className="cc-page">
      {/* KPI strip */}
      <div className="cc-kpi-grid">
        <KPICard label="Total Jobs"   value={stats.total}   sub="all time"           variant="idle" />
        <KPICard label="Aktif"        value={stats.running} sub="running / queued"   variant={stats.running > 0 ? "signal" : "idle"} />
        <KPICard label="Selesai"      value={stats.done}    sub="intel reports"      variant="done" />
        <KPICard label="Gagal"        value={stats.failed}  sub="errors"             variant={stats.failed > 0 ? "warn" : "idle"} />
        <KPICard label="Profil Saved" value={stats.profiles} sub="company profiles"  variant="idle" />
      </div>

      {/* Main content grid */}
      <div className="cc-split">
        {/* Left — recent jobs */}
        <div className="cc-panel">
          <div className="cc-panel-hdr">
            <span className="cc-panel-title">
              <span className="cc-panel-title-num">01</span>AKTIVITAS TERBARU
            </span>
            <button className="btn-cc btn-ghost" onClick={() => navigate("/operations")} style={{ fontSize: 11 }}>
              Lihat Semua
            </button>
          </div>
          <JobTable jobs={recent} onSelect={j => navigate(`/operations?job=${j.jobId}`)} />
        </div>

        {/* Right — system status + agent breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* System status */}
          <div className="cc-panel">
            <div className="cc-panel-hdr">
              <span className="cc-panel-title">
                <span className="cc-panel-title-num">02</span>STATUS SISTEM
              </span>
              <button className="btn-cc btn-ghost" onClick={() => navigate("/health")} style={{ fontSize: 11 }}>
                Detail
              </button>
            </div>
            <div className="cc-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ServiceRow
                label="Gateway :8000"
                ok={health?.gateway.ok}
                ms={health?.gateway.ms}
              />
              <ServiceRow
                label="Backend :3001"
                ok={health?.backend.ok}
                ms={health?.backend.ms}
              />
              <ServiceRow label="Ollama qwen3.5:9b" ok={true} />
            </div>
          </div>

          {/* Agent breakdown */}
          <div className="cc-panel">
            <div className="cc-panel-hdr">
              <span className="cc-panel-title">
                <span className="cc-panel-title-num">03</span>AGENT DIGUNAKAN
              </span>
            </div>
            <div className="cc-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {Object.entries(agentCounts).length === 0 ? (
                <div style={{ color: "var(--cc-data-muted)", fontSize: 12 }}>Belum ada data.</div>
              ) : (
                Object.entries(agentCounts).map(([type, count]) => (
                  <div key={type} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className={`cc-badge cc-badge--${type}`}>{type}</span>
                    <div style={{ flex: 1, background: "var(--cc-abyss)", borderRadius: 2, height: 6, overflow: "hidden" }}>
                      <div style={{
                        width: `${Math.round(count / stats.total * 100)}%`,
                        height: "100%",
                        background: "var(--cc-signal-medium)",
                        borderRadius: 2,
                        transition: "width 600ms ease",
                      }} />
                    </div>
                    <span style={{ fontFamily: "var(--font-data)", fontSize: 11, color: "var(--cc-data-tertiary)", minWidth: 20 }}>
                      {count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="cc-panel">
            <div className="cc-panel-hdr">
              <span className="cc-panel-title">
                <span className="cc-panel-title-num">04</span>AKSI CEPAT
              </span>
            </div>
            <div className="cc-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button className="btn-cc btn-signal" onClick={() => navigate("/command")}>
                Jalankan Agent Baru
              </button>
              <button className="btn-cc btn-standard" onClick={() => navigate("/orkestrasi")}>
                Lihat Graph Orkestrasi
              </button>
              <button className="btn-cc btn-standard" onClick={() => navigate("/lookup")}>
                OSINT Look Up
              </button>
              <button className="btn-cc btn-standard" onClick={() => navigate("/intel")}>
                Intel Database
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ServiceRow({ label, ok, ms }: { label: string; ok?: boolean; ms?: number }) {
  const status = ok === undefined ? "idle" : ok ? "done" : "failed"
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <StatusDot status={status as "done" | "failed" | "idle"} />
      <span style={{ flex: 1, fontSize: 12, color: "var(--cc-data-secondary)" }}>{label}</span>
      {ms !== undefined && (
        <span style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--cc-data-muted)" }}>
          {ok ? `${ms}ms` : "timeout"}
        </span>
      )}
    </div>
  )
}
