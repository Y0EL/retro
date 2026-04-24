import { useEffect, useState } from "react"
import { listJobs, stopJob, getJobStatus } from "../lib/api"
import type { Job, ProgressEvent } from "../lib/api"
import JobEventLog from "../components/JobEventLog"
import KPICard from "../components/KPICard"
import { fmtDuration } from "../lib/utils"
import { useNavigate } from "react-router-dom"

export default function HumanInLoop() {
  const [jobs,     setJobs]     = useState<Job[]>([])
  const [selected, setSelected] = useState<Job | null>(null)
  const [stopping, setStopping] = useState<string | null>(null)
  const navigate = useNavigate()

  const active = jobs.filter(j => j.status === "running" || j.status === "queued")
  const done   = jobs.filter(j => j.status === "done").length
  const failed = jobs.filter(j => j.status === "failed").length

  useEffect(() => {
    async function fetchAll() {
      try {
        const data = await listJobs()
        const sorted = [...(data.jobs || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        setJobs(sorted)
        // refresh selected job
        if (selected) {
          const fresh = sorted.find(j => j.jobId === selected.jobId)
          if (fresh) setSelected(fresh)
        }
      } catch { /* */ }
    }
    fetchAll()
    const id = setInterval(fetchAll, 3000)
    return () => clearInterval(id)
  }, [selected?.jobId])

  async function handleStop(jobId: string) {
    setStopping(jobId)
    try { await stopJob(jobId) } catch { /* */ }
    setStopping(null)
  }

  return (
    <div className="cc-page">
      {/* KPI strip */}
      <div className="cc-kpi-grid">
        <KPICard label="Aktif"   value={active.length} sub="running / queued" variant={active.length > 0 ? "signal" : "idle"} />
        <KPICard label="Selesai" value={done}           sub="done"             variant="done" />
        <KPICard label="Gagal"   value={failed}         sub="failed"           variant={failed > 0 ? "warn" : "idle"} />
        <KPICard label="Total"   value={jobs.length}    sub="semua"            variant="idle" />
      </div>

      {active.length === 0 && (
        <div className="cc-alert-banner cc-alert-banner--ok">
          Tidak ada agent yang aktif saat ini. Semua operasi sudah selesai.
        </div>
      )}

      <div className="cc-split">
        {/* Active jobs table */}
        <div className="cc-panel">
          <div className="cc-panel-hdr">
            <span className="cc-panel-title">
              <span className="cc-panel-title-num">04</span>AGENT AKTIF — INTERVENSI
            </span>
          </div>
          {active.length === 0 ? (
            <div className="cc-empty">
              <div className="cc-empty-icon">IDLE</div>
              <div>Tidak ada agent aktif</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="cc-table">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Agent</th>
                    <th>Mission</th>
                    <th>Status</th>
                    <th>Durasi</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map(job => (
                    <tr
                      key={job.jobId}
                      className={selected?.jobId === job.jobId ? "active" : ""}
                      onClick={() => setSelected(job)}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="mono">{job.jobId.slice(0, 10)}…</td>
                      <td><span className={`cc-badge cc-badge--${job.agentType}`}>{job.agentType}</span></td>
                      <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {job.intent}
                      </td>
                      <td>
                        <span className={`cc-badge cc-badge--${job.status}`}>
                          {job.status === "running" && <span className="cc-spinner" style={{ width: 8, height: 8, borderWidth: 1.5, marginRight: 4 }} />}
                          {job.status}
                        </span>
                      </td>
                      <td className="mono">{fmtDuration(job.startedAt)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            className="btn-cc btn-danger"
                            style={{ fontSize: 10, padding: "3px 8px" }}
                            disabled={stopping === job.jobId}
                            onClick={() => handleStop(job.jobId)}
                          >
                            {stopping === job.jobId ? <span className="cc-spinner" /> : "Stop"}
                          </button>
                          <button
                            className="btn-cc btn-standard"
                            style={{ fontSize: 10, padding: "3px 8px" }}
                            onClick={() => navigate(`/orkestrasi?job=${job.jobId}`)}
                          >
                            Graph
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Live log of selected */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {selected ? (
            <>
              <div className="cc-panel">
                <div className="cc-panel-hdr">
                  <span className="cc-panel-title">LIVE LOG — {selected.jobId.slice(0, 12)}…</span>
                  <button className="btn-cc btn-ghost" onClick={() => setSelected(null)} style={{ fontSize: 11 }}>X</button>
                </div>
                <div className="cc-panel-body" style={{ padding: 8 }}>
                  <JobEventLog
                    events={selected.events || []}
                    running={selected.status === "running"}
                  />
                </div>
              </div>

              <div className="cc-panel">
                <div className="cc-panel-hdr">
                  <span className="cc-panel-title">REDIRECT INSTRUKSI</span>
                  <span style={{ fontSize: 10, color: "var(--cc-warn-active)" }}>Coming Soon</span>
                </div>
                <div className="cc-panel-body">
                  <textarea
                    className="cc-textarea"
                    placeholder="Kirim instruksi tambahan ke agent yang berjalan (fitur mendatang)..."
                    disabled
                    style={{ opacity: 0.4 }}
                  />
                  <button className="btn-cc btn-standard" disabled style={{ marginTop: 8, opacity: 0.4 }}>
                    Kirim Instruksi
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="cc-panel">
              <div className="cc-empty">
                <div className="cc-empty-icon">--</div>
                <div>Pilih agent dari tabel untuk melihat live log</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
