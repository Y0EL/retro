import { useEffect, useState } from "react"
import { listKB } from "../lib/api"
import type { KBEntry } from "../lib/api"
import CompanyCard from "../components/CompanyCard"
import SearchBar from "../components/SearchBar"
import KPICard from "../components/KPICard"
import { useNavigate } from "react-router-dom"
import { fmtDate } from "../lib/utils"

export default function IntelDatabase() {
  const [entries, setEntries] = useState<KBEntry[]>([])
  const [search,  setSearch]  = useState("")
  const [typeFilter, setType] = useState("all")
  const [loading, setLoading] = useState(true)
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
      const s = search.toLowerCase()
      const name = (e.data?.company_name || e.data?.name || "") as string
      const domain = (e.data?.domain || "") as string
      return name.toLowerCase().includes(s) || domain.toLowerCase().includes(s)
    }
    return true
  })

  const profiles  = entries.filter(e => e.type === "company_profile").length
  const proposals = entries.filter(e => e.type === "proposal").length
  const research  = entries.filter(e => e.type === "research").length

  return (
    <div className="cc-page">
      {/* KPIs */}
      <div className="cc-kpi-grid">
        <KPICard label="Total Entries"      value={entries.length}  sub="knowledge base"    variant="idle" />
        <KPICard label="Company Profiles"   value={profiles}        sub="company_profile"   variant="signal" />
        <KPICard label="Proposals"          value={proposals}       sub="proposal"          variant="warn" />
        <KPICard label="Research"           value={research}        sub="research"          variant="idle" />
      </div>

      {/* Filter + search */}
      <div className="cc-panel">
        <div className="cc-panel-hdr">
          <span className="cc-panel-title">
            <span className="cc-panel-title-num">06</span>INTEL DATABASE
          </span>
          <div className="cc-filter-strip">
            <SearchBar value={search} onChange={setSearch} placeholder="Cari perusahaan, domain..." />
            <select className="cc-select" value={typeFilter} onChange={e => setType(e.target.value)}>
              {types.map(t => <option key={t} value={t}>{t === "all" ? "Semua Type" : t}</option>)}
            </select>
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
          ) : (
            <div className="cc-grid-3" style={{ gap: 10 }}>
              {filtered.map(entry => {
                const name   = (entry.data?.company_name || entry.data?.name || entry.id) as string
                const domain = (entry.data?.domain || "") as string
                const industry = (entry.data?.industry || entry.type) as string
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
          )}
        </div>
      </div>
    </div>
  )
}
