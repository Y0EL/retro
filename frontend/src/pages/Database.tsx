import { useEffect, useState } from "react"
import { listKB } from "../lib/api"
import type { KBEntry } from "../lib/api"
import SearchBar from "../components/SearchBar"
import { fmtDate } from "../lib/utils"
import { useNavigate } from "react-router-dom"

export default function Database() {
  const [entries,    setEntries]    = useState<KBEntry[]>([])
  const [search,     setSearch]     = useState("")
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      try { const d = await listKB(); setEntries(d.entries || []) }
      catch { setEntries([]) }
      finally { setLoading(false) }
    }
    fetch()
  }, [])

  const allTypes = Array.from(new Set(entries.map(e => e.type)))

  const filtered = entries.filter(e => {
    if (typeFilter.length > 0 && !typeFilter.includes(e.type)) return false
    if (search) {
      const s = search.toLowerCase()
      return JSON.stringify(e).toLowerCase().includes(s)
    }
    return true
  })

  function toggleType(t: string) {
    setTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `retro-kb-export-${Date.now()}.json`
    a.click()
  }

  function exportCSV() {
    const rows = filtered.map(e => [
      e.id, e.type, e.createdAt,
      (e.data?.company_name || e.data?.name || "") as string,
      (e.data?.domain || "") as string,
      (e.tags || []).join(";"),
    ])
    const csv = ["ID,Type,Created,Name,Domain,Tags", ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `retro-kb-export-${Date.now()}.csv`
    a.click()
  }

  return (
    <div className="cc-page">
      <div className="cc-split-sidebar">
        {/* Filter panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="cc-panel">
            <div className="cc-panel-hdr">
              <span className="cc-panel-title">FILTER</span>
            </div>
            <div className="cc-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="cc-label">TYPE</div>
              {allTypes.map(t => (
                <label key={t} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "var(--cc-data-secondary)" }}>
                  <input
                    type="checkbox"
                    checked={typeFilter.includes(t)}
                    onChange={() => toggleType(t)}
                    style={{ accentColor: "var(--cc-signal-critical)" }}
                  />
                  {t}
                  <span style={{ marginLeft: "auto", fontFamily: "var(--font-data)", fontSize: 10, color: "var(--cc-data-muted)" }}>
                    {entries.filter(e => e.type === t).length}
                  </span>
                </label>
              ))}
              {typeFilter.length > 0 && (
                <button className="btn-cc btn-ghost" onClick={() => setTypeFilter([])} style={{ fontSize: 11 }}>
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          <div className="cc-panel">
            <div className="cc-panel-hdr">
              <span className="cc-panel-title">EXPORT</span>
            </div>
            <div className="cc-panel-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <button className="btn-cc btn-standard" onClick={exportJSON}>Export JSON ({filtered.length})</button>
              <button className="btn-cc btn-standard" onClick={exportCSV}>Export CSV ({filtered.length})</button>
            </div>
          </div>
        </div>

        {/* Table panel */}
        <div className="cc-panel" style={{ overflow: "hidden" }}>
          <div className="cc-panel-hdr">
            <span className="cc-panel-title">
              <span className="cc-panel-title-num">07</span>DATABASE KB
            </span>
            <div className="cc-filter-strip">
              <SearchBar value={search} onChange={setSearch} placeholder="Cari di semua field..." />
              <span style={{ fontSize: 10, color: "var(--cc-data-muted)", whiteSpace: "nowrap" }}>
                {filtered.length} / {entries.length}
              </span>
            </div>
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading ? (
              <div className="cc-loading"><span className="cc-spinner" /> Memuat...</div>
            ) : filtered.length === 0 ? (
              <div className="cc-empty">
                <div className="cc-empty-icon">KB</div>
                <div>Tidak ada data</div>
              </div>
            ) : (
              <table className="cc-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Nama</th>
                    <th>Domain</th>
                    <th>Tags</th>
                    <th>Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(e => {
                    const name   = (e.data?.company_name || e.data?.name || "—") as string
                    const domain = (e.data?.domain || "—") as string
                    return (
                      <>
                        <tr
                          key={e.id}
                          onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                          style={{ cursor: "pointer" }}
                          className={expanded === e.id ? "active" : ""}
                        >
                          <td className="mono" style={{ fontSize: 10 }}>{e.id.slice(0, 12)}…</td>
                          <td><span className={`cc-badge cc-badge--${e.type === "company_profile" ? "discovery" : e.type === "proposal" ? "proposal" : "idle"}`}>{e.type}</span></td>
                          <td>{name}</td>
                          <td className="mono" style={{ fontSize: 11, color: "var(--cc-signal-medium)" }}>{domain}</td>
                          <td style={{ fontSize: 10 }}>{(e.tags || []).join(", ") || "—"}</td>
                          <td className="mono" style={{ fontSize: 10 }}>{fmtDate(e.createdAt)}</td>
                        </tr>
                        {expanded === e.id && (
                          <tr key={`${e.id}-detail`}>
                            <td colSpan={6} style={{ padding: "10px 12px", background: "var(--cc-elevated)" }}>
                              <pre style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--cc-data-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 200, overflowY: "auto" }}>
                                {JSON.stringify(e.data, null, 2)}
                              </pre>
                              <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                                <button className="btn-cc btn-standard" style={{ fontSize: 10 }} onClick={() => navigate(`/profil/${e.id}`)}>
                                  Lihat Profil
                                </button>
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
    </div>
  )
}
