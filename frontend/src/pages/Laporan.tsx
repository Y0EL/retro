import { useEffect, useState } from "react"
import { listJobs } from "../lib/api"
import type { Job } from "../lib/api"
import { extractDownloadUrls, fmtDate, fmtTime } from "../lib/utils"
import KPICard from "../components/KPICard"
import EmailDraftPanel from "../components/EmailDraftPanel"

interface Report {
  jobId: string
  intent: string
  agentType: string
  url: string
  type: "outbound" | "internal" | "unknown"
  createdAt: string
  emailSubject?: string
  emailBody?: string
  targetCompany?: string
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

export default function Laporan() {
  const [reports,   setReports]   = useState<Report[]>([])
  const [filter,    setFilter]    = useState<"all" | "outbound" | "internal">("all")
  const [loading,   setLoading]   = useState(true)
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      try {
        const data = await listJobs()
        const all: Report[] = []
        for (const job of data.jobs || []) {
          if (job.status !== "done") continue
          const urls = extractDownloadUrls(job.result)
          for (const url of urls) {
            const type = url.includes("outbound") ? "outbound"
              : url.includes("internal")          ? "internal"
              : "unknown"
            all.push({
              jobId:         job.jobId,
              intent:        job.intent,
              agentType:     job.agentType,
              url,
              type:          type as Report["type"],
              createdAt:     job.completedAt || job.createdAt,
              emailSubject:  deepFind(job.result, "email_subject"),
              emailBody:     deepFind(job.result, "email_body_preview"),
              targetCompany: deepFind(job.result, "target_company"),
            })
          }
        }
        setReports(all.reverse())
      } catch { setReports([]) }
      finally { setLoading(false) }
    }
    fetch()
    const id = setInterval(fetch, 15000)
    return () => clearInterval(id)
  }, [])

  const filtered = filter === "all" ? reports : reports.filter(r => r.type === filter)

  return (
    <div className="cc-page">
      <div className="cc-kpi-grid">
        <KPICard label="Total Laporan" value={reports.length}                         sub="semua" />
        <KPICard label="Outbound"      value={reports.filter(r => r.type === "outbound").length} sub="surat penawaran" variant="warn" />
        <KPICard label="Internal"      value={reports.filter(r => r.type === "internal").length} sub="laporan riset"   variant="signal" />
        <KPICard label="Unknown"       value={reports.filter(r => r.type === "unknown").length} sub="lainnya" />
      </div>

      <div className="cc-panel">
        <div className="cc-panel-hdr">
          <span className="cc-panel-title">
            <span className="cc-panel-title-num">09</span>LAPORAN PDF
          </span>
          <div className="cc-tabs" style={{ border: "none", gap: 4 }}>
            {(["all", "outbound", "internal"] as const).map(f => (
              <button
                key={f}
                className={`cc-tab${filter === f ? " active" : ""}`}
                onClick={() => setFilter(f)}
                style={{ padding: "4px 12px" }}
              >
                {f === "all" ? "Semua" : f === "outbound" ? "Outbound" : "Internal"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          {loading ? (
            <div className="cc-loading"><span className="cc-spinner" /> Memuat laporan...</div>
          ) : filtered.length === 0 ? (
            <div className="cc-empty">
              <div className="cc-empty-icon">PDF</div>
              <div>
                {reports.length === 0
                  ? "Belum ada laporan PDF. Jalankan agent Discovery atau Proposal."
                  : "Tidak ada laporan dengan filter ini."}
              </div>
            </div>
          ) : (
            <table className="cc-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Laporan</th>
                  <th>Type</th>
                  <th>Agent</th>
                  <th>Tanggal</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const rowKey = `${r.jobId}-${i}`
                  const isExp  = expanded.has(rowKey)
                  const hasEmail = !!(r.emailSubject || r.emailBody)
                  return (
                    <>
                      <tr key={rowKey}
                        style={{ cursor: hasEmail ? "pointer" : "default" }}
                        onClick={() => {
                          if (!hasEmail) return
                          setExpanded(prev => {
                            const next = new Set(prev)
                            isExp ? next.delete(rowKey) : next.add(rowKey)
                            return next
                          })
                        }}
                      >
                        <td className="mono" style={{ fontSize: 10 }}>{i + 1}</td>
                        <td>
                          <div style={{ fontSize: 12, color: "var(--cc-data-primary)", fontWeight: 500 }}>
                            {r.intent.slice(0, 60)}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--cc-data-muted)", fontFamily: "var(--font-data)" }}>
                            {r.jobId.slice(0, 12)}…
                            {hasEmail && <span style={{ color: "var(--cc-warn-elevated)", marginLeft: 8 }}>✉ draft email</span>}
                          </div>
                        </td>
                        <td>
                          <span className={`cc-badge ${r.type === "outbound" ? "cc-badge--proposal" : r.type === "internal" ? "cc-badge--discovery" : "cc-badge--idle"}`}>
                            {r.type}
                          </span>
                        </td>
                        <td>
                          <span className={`cc-badge cc-badge--${r.agentType}`}>{r.agentType}</span>
                        </td>
                        <td className="mono" style={{ fontSize: 10 }}>{fmtDate(r.createdAt)}</td>
                        <td>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <a href={r.url} target="_blank" rel="noopener noreferrer"
                              className="btn-cc btn-standard"
                              style={{ textDecoration: "none", fontSize: 11, padding: "4px 10px" }}
                              onClick={e => e.stopPropagation()}
                            >
                              ↓ PDF
                            </a>
                            {hasEmail && (
                              <span style={{ fontSize: 10, color: "var(--cc-data-muted)" }}>{isExp ? "▲" : "▼"}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExp && hasEmail && (
                        <tr key={`${rowKey}-email`}>
                          <td colSpan={6} style={{ padding: 0 }}>
                            <div style={{ padding: "0 12px 12px" }}>
                              <EmailDraftPanel subject={r.emailSubject} body={r.emailBody} targetCompany={r.targetCompany} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
