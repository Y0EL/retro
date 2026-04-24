import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { getKBEntry, listJobs } from "../lib/api"
import type { KBEntry, Job } from "../lib/api"
import { fmtDate } from "../lib/utils"
import JobTable from "../components/JobTable"

type Tab = "profil" | "kontak" | "laporan" | "aktivitas"

export default function ProfilPerusahaan() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [entry,   setEntry]   = useState<KBEntry | null>(null)
  const [jobs,    setJobs]    = useState<Job[]>([])
  const [tab,     setTab]     = useState<Tab>("profil")
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!id || id === "new") { setLoading(false); return }
    async function fetch() {
      setLoading(true)
      try {
        const [e, j] = await Promise.all([getKBEntry(id!), listJobs()])
        setEntry(e)
        const relatedJobs = (j.jobs || []).filter(job =>
          job.intent.toLowerCase().includes(
            ((e.data?.company_name || e.data?.name || "") as string).toLowerCase()
          )
        )
        setJobs(relatedJobs)
      } catch (err) {
        setError("Profil tidak ditemukan")
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id])

  if (loading) return <div className="cc-loading" style={{ height: "50vh" }}><span className="cc-spinner" /> Memuat profil...</div>
  if (error || !entry) return (
    <div className="cc-page">
      <div className="cc-empty">
        <div className="cc-empty-icon">ERR</div>
        <div>{error || "Profil tidak ditemukan"}</div>
        <button className="btn-cc btn-standard" onClick={() => navigate("/intel")} style={{ marginTop: 10 }}>
          Kembali ke Intel Database
        </button>
      </div>
    </div>
  )

  const name     = (entry.data?.company_name || entry.data?.name || "—") as string
  const domain   = (entry.data?.domain || "") as string
  const industry = (entry.data?.industry || "") as string
  const desc     = (entry.data?.description || entry.data?.executive_summary || "") as string
  const emails   = (entry.data?.emails || []) as string[]
  const phones   = (entry.data?.phones || []) as string[]
  const address  = (entry.data?.address || "") as string

  return (
    <div className="cc-page">
      {/* Header */}
      <div className="cc-panel">
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 24, fontWeight: 700, color: "var(--cc-data-primary)", marginBottom: 6 }}>
              {name}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              {domain   && <span style={{ fontFamily: "var(--font-data)", fontSize: 12, color: "var(--cc-signal-critical)" }}>{domain}</span>}
              {industry && <span className="cc-badge cc-badge--idle">{industry}</span>}
              <span className="cc-badge cc-badge--discovery">{entry.type}</span>
              <span style={{ fontSize: 10, color: "var(--cc-data-muted)", fontFamily: "var(--font-data)" }}>
                {fmtDate(entry.createdAt)}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-cc btn-signal" onClick={() => navigate(`/command?prefill=${encodeURIComponent(name)}`)}>
              Run Discovery
            </button>
            <button className="btn-cc btn-warn" onClick={() => navigate(`/command?prefill=${encodeURIComponent(name)}&agent=proposal`)}>
              Buat Proposal
            </button>
            <button className="btn-cc btn-ghost" onClick={() => navigate(-1)}>
              Kembali
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="cc-tabs" style={{ paddingLeft: 20 }}>
          {(["profil", "kontak", "laporan", "aktivitas"] as Tab[]).map(t => (
            <div key={t} className={`cc-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
              {t.toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === "profil" && (
        <div className="cc-grid-2">
          <div className="cc-panel">
            <div className="cc-panel-hdr"><span className="cc-panel-title">RINGKASAN</span></div>
            <div className="cc-panel-body">
              {desc ? (
                <div style={{ fontSize: 13, color: "var(--cc-data-secondary)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
                  {desc}
                </div>
              ) : (
                <div style={{ color: "var(--cc-data-muted)", fontSize: 12 }}>Tidak ada deskripsi.</div>
              )}
            </div>
          </div>
          <div className="cc-panel">
            <div className="cc-panel-hdr"><span className="cc-panel-title">DATA LENGKAP</span></div>
            <div className="cc-panel-body">
              <pre style={{
                fontFamily: "var(--font-data)", fontSize: 10, color: "var(--cc-data-secondary)",
                whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 350, overflowY: "auto"
              }}>
                {JSON.stringify(entry.data, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {tab === "kontak" && (
        <div className="cc-panel">
          <div className="cc-panel-hdr"><span className="cc-panel-title">INFORMASI KONTAK</span></div>
          <div className="cc-panel-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {emails.length > 0 && (
              <div>
                <div className="cc-section-hdr">EMAIL</div>
                {emails.map((e, i) => (
                  <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--cc-border-subtle)", fontFamily: "var(--font-data)", fontSize: 12, color: "var(--cc-signal-critical)" }}>
                    {e}
                  </div>
                ))}
              </div>
            )}
            {phones.length > 0 && (
              <div>
                <div className="cc-section-hdr">TELEPON</div>
                {phones.map((p, i) => (
                  <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--cc-border-subtle)", fontFamily: "var(--font-data)", fontSize: 12 }}>
                    {p}
                  </div>
                ))}
              </div>
            )}
            {address && (
              <div>
                <div className="cc-section-hdr">ALAMAT</div>
                <div style={{ fontSize: 12, color: "var(--cc-data-secondary)", lineHeight: 1.6 }}>{address}</div>
              </div>
            )}
            {!emails.length && !phones.length && !address && (
              <div style={{ color: "var(--cc-data-muted)", fontSize: 12 }}>
                Tidak ada informasi kontak tersedia. Jalankan agent untuk menemukan kontak.
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "aktivitas" && (
        <div className="cc-panel">
          <div className="cc-panel-hdr">
            <span className="cc-panel-title">JOB TERKAIT</span>
            <span style={{ fontSize: 10, color: "var(--cc-data-muted)" }}>{jobs.length} job</span>
          </div>
          <JobTable jobs={jobs} onSelect={j => navigate(`/operations?job=${j.jobId}`)} />
        </div>
      )}

      {tab === "laporan" && (
        <div className="cc-panel">
          <div className="cc-panel-hdr"><span className="cc-panel-title">LAPORAN TERKAIT</span></div>
          <div className="cc-empty">
            <div className="cc-empty-icon">PDF</div>
            <div>Lihat laporan PDF di halaman <button className="btn-cc btn-ghost" onClick={() => navigate("/laporan")} style={{ display: "inline" }}>Laporan</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
