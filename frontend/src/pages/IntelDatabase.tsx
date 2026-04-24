import { useEffect, useState } from "react"
import { listKB } from "../lib/api"
import type { KBEntry } from "../lib/api"
import CompanyCard from "../components/CompanyCard"
import SearchBar from "../components/SearchBar"
import KPICard from "../components/KPICard"
import { useNavigate } from "react-router-dom"
import { fmtDate } from "../lib/utils"

function exportJSON(entries: KBEntry[]) {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a"); a.href = url; a.download = "retro-kb.json"; a.click()
  URL.revokeObjectURL(url)
}

function exportCSV(entries: KBEntry[]) {
  const rows = [
    ["id", "type", "name", "domain", "tags", "createdAt"],
    ...entries.map(e => [
      e.id, e.type,
      String(e.data?.company_name ?? e.data?.name ?? ""),
      String(e.data?.domain ?? ""),
      (e.tags ?? []).join("; "),
      e.createdAt,
    ]),
  ]
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a"); a.href = url; a.download = "retro-kb.csv"; a.click()
  URL.revokeObjectURL(url)
}

export default function IntelDatabase() {
  const [entries,    setEntries]    = useState<KBEntry[]>([])
  const [search,     setSearch]     = useState("")
  const [typeFilter, setType]       = useState("all")
  const [viewMode,   setViewMode]   = useState<"grid" | "table">("grid")
  const [loading,    setLoading]    = useState(true)
  const [expandId,   setExpandId]   = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      try {
        const data = await listKB()
        setEntries(data.entries || [])
      } catch { setEntries([]) }
      finally { setLoading(false) }
    }
    fetch()
    const id = setInterval(fetch, 10000)
    return () => clearInterval(id)
  }, [])

  const types = ["all", ...Array.from(new Set(entries.map(e => e.type)))]

  const filtered = entries.filter(e => {
    if (typeFilter !== "all" && e.type !== typeFilter) return false
    if (search) {
      const s    = search.toLowerCase()
      const name = String(e.data?.company_name ?? e.data?.name ?? "")
      const dom  = String(e.data?.domain ?? "")
      return name.toLowerCase().includes(s) || dom.toLowerCase().includes(s) || e.id.includes(s)
    }
    return true
  })

  const profiles  = entries.filter(e => e.type === "company_profile").length
  const proposals = entries.filter(e => e.type === "proposal").length
  const research  = entries.filter(e => e.type === "research").length

  return (
    <div className="cc-page">
      <div className="cc-kpi-grid">
        <KPICard label="Total Entries"    value={entries.length}  sub="knowledge base"  variant="idle" />
        <KPICard label="Company Profiles" value={profiles}        sub="company_profile" variant="signal" />
        <KPICard label="Proposals"        value={proposals}       sub="proposal"        variant="warn" />
        <KPICard label="Research"         value={research}        sub="research"        variant="idle" />
      </div>

      <div className="cc-panel">
        <div className="cc-panel-hdr">
          <span className="cc-panel-title">
            <span className="cc-panel-title-num">06</span>INTEL DATABASE
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <SearchBar value={search} onChange={setSearch} placeholder="Cari perusahaan, domain..." />
            <select className="cc-select" value={typeFilter} onChange={e => setType(e.target.value)}>
              {types.map(t => <option key={t} value={t}>{t === "all" ? "Semua Type" : t}</option>)}
            </select>
            {/* View toggle */}
            <div style={{ display: "flex", border: "1px solid var(--cc-border)" }}>
              {(["grid", "table"] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  style={{
                    padding: "4px 10px", fontSize: 9, fontFamily: "var(--font-data)", letterSpacing: "0.1em",
                    background: viewMode === m ? "var(--cc-elevated)" : "transparent",
                    color: viewMode === m ? "var(--cc-data-primary)" : "var(--cc-data-muted)",
                    border: "none", cursor: "pointer",
                  }}>
                  {m === "grid" ? "GRID" : "TABEL"}
                </button>
              ))}
            </div>
            {/* Export */}
            <button onClick={() => exportJSON(filtered)} className="btn-cc btn-ghost" style={{ fontSize: 9, padding: "4px 10px" }}>JSON</button>
            <button onClick={() => exportCSV(filtered)}  className="btn-cc btn-ghost" style={{ fontSize: 9, padding: "4px 10px" }}>CSV</button>
          </div>
        </div>

        <div className="cc-panel-body">
          {loading ? (
            <div className="cc-loading"><span className="cc-spinner" /> Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div className="cc-empty">
              <div className="cc-empty-icon">KB</div>
              <div>
                {entries.length === 0
                  ? "Belum ada data. Jalankan agent Discovery untuk mengisi knowledge base."
                  : "Tidak ada hasil yang cocok dengan filter."}
              </div>
            </div>
          ) : viewMode === "grid" ? (
            <div className="cc-grid-3" style={{ gap: 10 }}>
              {filtered.map(entry => {
                const name     = String(entry.data?.company_name ?? entry.data?.name ?? entry.id)
                const domain   = String(entry.data?.domain ?? "")
                const industry = String(entry.data?.industry ?? entry.type)
                return (
                  <CompanyCard
                    key={entry.id}
                    id={entry.id}
                    name={name}
                    domain={domain}
                    industry={industry}
                    meta={fmtDate(entry.createdAt)}
                    onClick={() => navigate(`/profil/${entry.id}`)}
                  />
                )
              })}
            </div>
          ) : (
            /* Table view */
            <div style={{ overflowX: "auto" }}>
              <table className="cc-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nama</th>
                    <th>Domain</th>
                    <th>Type</th>
                    <th>Tags</th>
                    <th>Tanggal</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(entry => {
                    const name   = String(entry.data?.company_name ?? entry.data?.name ?? "—")
                    const domain = String(entry.data?.domain ?? "")
                    const isExp  = expandId === entry.id
                    return (
                      <>
                        <tr key={entry.id} style={{ cursor: "pointer" }} onClick={() => setExpandId(isExp ? null : entry.id)}>
                          <td className="mono" style={{ fontSize: 9 }}>{entry.id.slice(0, 8)}…</td>
                          <td style={{ fontWeight: 500 }}>{name}</td>
                          <td className="mono" style={{ fontSize: 10, color: "var(--cc-data-muted)" }}>{domain || "—"}</td>
                          <td><span className={`cc-badge cc-badge--${entry.type === "company_profile" ? "discovery" : entry.type === "proposal" ? "proposal" : "idle"}`}>{entry.type}</span></td>
                          <td style={{ fontSize: 10, color: "var(--cc-data-muted)" }}>{(entry.tags ?? []).join(", ") || "—"}</td>
                          <td className="mono" style={{ fontSize: 10 }}>{fmtDate(entry.createdAt)}</td>
                          <td>
                            <button className="btn-cc btn-ghost" style={{ fontSize: 10, padding: "3px 8px" }}
                              onClick={e => { e.stopPropagation(); navigate(`/profil/${entry.id}`) }}>
                              Profil
                            </button>
                          </td>
                        </tr>
                        {isExp && (
                          <tr key={`${entry.id}-exp`}>
                            <td colSpan={7} style={{ padding: "0 12px 12px", background: "var(--cc-abyss)" }}>
                              <pre style={{ fontSize: 10, color: "var(--cc-data-muted)", overflowX: "auto", margin: 0, padding: "8px 0" }}>
                                {JSON.stringify(entry.data, null, 2).slice(0, 1200)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
