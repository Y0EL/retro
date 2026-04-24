import { useEffect, useState } from "react"
import { listJobs, stopJob } from "../lib/api"
import type { Job } from "../lib/api"
import JobEventLog from "../components/JobEventLog"
import KPICard from "../components/KPICard"
import EmailDraftPanel from "../components/EmailDraftPanel"
import { fmtDuration } from "../lib/utils"
import { useNavigate } from "react-router-dom"

export default function HumanInLoop() {
  const [jobs,     setJobs]     = useState<Job[]>([])
  const [selected, setSelected] = useState<Job | null>(null)
  const [stopping, setStopping] = useState<string | null>(null)
  const [tab,      setTab]      = useState<"active" | "done">("active")
  const navigate = useNavigate()

  const active = jobs.filter(j => j.status === "running" || j.status === "queued")
  const done   = jobs.filter(j => j.status === "done")
  const failed = jobs.filter(j => j.status === "failed")

  useEffect(() => {
    async function fetchAll() {
      try {
        const data = await listJobs()
        const sorted = [...(data.jobs || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        setJobs(sorted)
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

  const selectedRes = selected?.result as Record<string, unknown> | undefined
  const emailDrafts = selectedRes?.email_drafts as Array<{ company: string; email: string; role: string; subject: string; body: string }> | undefined
  const productName = selectedRes?.product_name as string | undefined
  const summary     = selectedRes?.summary as string | undefined
  const downloadUrls = selectedRes?.download_urls as string[] | undefined

  return (
    <div className="cc-page">
      <div className="cc-kpi-grid">
        <KPICard label="Aktif"   value={active.length} sub="running / queued" variant={active.length > 0 ? "signal" : "idle"} />
        <KPICard label="Selesai" value={done.length}   sub="done"             variant="done" />
        <KPICard label="Gagal"   value={failed.length} sub="failed"           variant={failed.length > 0 ? "warn" : "idle"} />
        <KPICard label="Total"   value={jobs.length}   sub="semua"            variant="idle" />
      </div>

      {active.length === 0 && tab === "active" && (
        <div className="cc-alert-banner cc-alert-banner--ok">
          Tidak ada agent aktif. Semua operasi selesai.
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, marginBottom: 12, borderBottom: "1px solid var(--cc-border-subtle)" }}>
        {[["active", `AKTIF (${active.length})`], ["done", `SELESAI (${done.length + failed.length})`]].map(([key, lbl]) => (
          <button
            key={key}
            onClick={() => setTab(key as "active" | "done")}
            style={{
              background: "none", border: "none", cursor: "pointer",
              padding: "6px 16px",
              fontSize: 10, fontFamily: "var(--font-data)", letterSpacing: "0.1em",
              color: tab === key ? "var(--cc-data-primary)" : "var(--cc-data-muted)",
              borderBottom: tab === key ? "2px solid var(--cc-signal-active)" : "2px solid transparent",
            }}
          >
            {lbl}
          </button>
        ))}
      </div>

      <div className="cc-split">
        {/* Job table */}
        <div className="cc-panel">
          <div className="cc-panel-hdr">
            <span className="cc-panel-title">
              <span className="cc-panel-title-num">04</span>
              {tab === "active" ? "AGENT AKTIF — INTERVENSI" : "RIWAYAT OPERASI"}
            </span>
          </div>

          {tab === "active" && active.length === 0 ? (
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
                  {(tab === "active" ? active : [...done, ...failed]).map(job => (
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
                          {(job.status === "running" || job.status === "queued") && (
                            <button
                              className="btn-cc btn-danger"
                              style={{ fontSize: 10, padding: "3px 8px" }}
                              disabled={stopping === job.jobId}
                              onClick={() => handleStop(job.jobId)}
                            >
                              {stopping === job.jobId ? <span className="cc-spinner" /> : "Stop"}
                            </button>
                          )}
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

        {/* Right panel: log + results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {selected ? (
            <>
              {/* Intel log */}
              <div className="cc-panel">
                <div className="cc-panel-hdr">
                  <span className="cc-panel-title">INTEL LOG — {selected.jobId.slice(0, 12)}…</span>
                  <button className="btn-cc btn-ghost" onClick={() => setSelected(null)} style={{ fontSize: 11 }}>X</button>
                </div>
                <div className="cc-panel-body" style={{ padding: 8 }}>
                  <JobEventLog events={selected.events || []} running={selected.status === "running"} />
                </div>
              </div>

              {/* Result panel for done jobs */}
              {selected.status === "done" && (productName || (emailDrafts && emailDrafts.length > 0) || (downloadUrls && downloadUrls.length > 0)) && (
                <div className="cc-panel">
                  <div className="cc-panel-hdr">
                    <span className="cc-panel-title">HASIL OPERASI</span>
                  </div>
                  <div className="cc-panel-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                    {productName && (
                      <div style={{
                        background: "#0d2215", border: "1px solid #1e4a2a",
                        borderLeft: "3px solid #52b788", padding: "10px 14px",
                      }}>
                        <div style={{ fontSize: 9, color: "#52b788", fontFamily: "var(--font-data)", letterSpacing: "0.12em", marginBottom: 4 }}>
                          PRODUK BARU GSP
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#c8e8d4" }}>{productName}</div>
                        {summary && (
                          <div style={{ fontSize: 11, color: "var(--cc-data-secondary)", lineHeight: 1.6, marginTop: 6 }}>
                            {summary}
                          </div>
                        )}
                      </div>
                    )}

                    {downloadUrls && downloadUrls.length > 0 && (
                      <div>
                        <div className="cc-label" style={{ marginBottom: 6 }}>LAPORAN PDF</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {downloadUrls.map((url, i) => (
                            <a
                              key={i}
                              href={`/api/files/${url.split("/").pop()}`}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-cc btn-standard"
                              style={{ textDecoration: "none", textAlign: "center", fontSize: 11 }}
                            >
                              {url.includes("outbound") ? "⬇ Proposal PDF (Outbound)" : "⬇ Laporan Internal PDF"}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {emailDrafts && emailDrafts.length > 0 && (
                      <div>
                        <div className="cc-label" style={{ marginBottom: 8 }}>
                          EMAIL DRAFT — {emailDrafts.length} PERUSAHAAN
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {emailDrafts.map((draft, i) => (
                            <EmailDraftPanel
                              key={i}
                              subject={draft.subject}
                              body={draft.body}
                              company={draft.company}
                              email={draft.email}
                              role={draft.role}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Intervensi (active only) */}
              {(selected.status === "running" || selected.status === "queued") && (
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
              )}
            </>
          ) : (
            <div className="cc-panel">
              <div className="cc-empty">
                <div className="cc-empty-icon">--</div>
                <div>Pilih job dari tabel untuk melihat log dan hasil</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
