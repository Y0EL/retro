import { useRef, useEffect, useState } from "react"
import { useLocation, Link } from "react-router-dom"
import { listJobs } from "../lib/api"

const MODUL = [
  { num: "01", path: "/",           label: "IKHTISAR",          sub: "Overview Dashboard" },
  { num: "02", path: "/command",    label: "COMMAND CENTER",     sub: "Mission Input" },
  { num: "03", path: "/orkestrasi", label: "ORKESTRASI",         sub: "D3.js Agent Graph" },
  { num: "04", path: "/hitl",       label: "HUMAN IN THE LOOP",  sub: "Manual Intervention" },
  { num: "05", path: "/operations", label: "OPERASI AKTIF",      sub: "Live Job Table" },
  { num: "06", path: "/intel",      label: "INTEL DATABASE",     sub: "KB Results" },
  { num: "07", path: "/database",   label: "DATABASE",           sub: "Full KB Browser" },
  { num: "08", path: "/lookup",     label: "LOOK UP",            sub: "OSINT Tools" },
  { num: "09", path: "/laporan",    label: "LAPORAN",            sub: "Report Library" },
  { num: "10", path: "/health",     label: "SISTEM HEALTH",      sub: "Service Monitoring" },
  { num: "11", path: "/akun",       label: "AKUN",               sub: "Settings & Keys" },
]

interface Props { open: boolean; onClose: () => void }

export default function GlobalLeftRail({ open, onClose }: Props) {
  const railRef = useRef<HTMLElement>(null)
  const location = useLocation()
  const [running, setRunning] = useState(0)

  // Light effect follows cursor
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!railRef.current || !open) return
      const rect = railRef.current.getBoundingClientRect()
      railRef.current.style.setProperty("--light-x", `${e.clientX - rect.left}px`)
      railRef.current.style.setProperty("--light-y", `${e.clientY - rect.top}px`)
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [open])

  // M key toggle
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA") return
      if (e.key === "m" || e.key === "M") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Running count badge
  useEffect(() => {
    async function fetch() {
      try {
        const data = await listJobs()
        setRunning((data.jobs || []).filter(j => j.status === "running" || j.status === "queued").length)
      } catch { /* */ }
    }
    fetch()
    const id = setInterval(fetch, 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <nav ref={railRef} className={`cc-rail${open ? " cc-rail--open" : ""}`}>
      {/* Logo */}
      <div className="cc-rail-logo">
        <div className="cc-rail-logo-title">RETRO</div>
        <div className="cc-rail-logo-sub">PT GSP · B2B Intelligence</div>
      </div>

      {/* Navigation */}
      <div className="cc-rail-nav">
        <div className="cc-rail-section-hdr">MODUL</div>

        {MODUL.map(m => {
          const isActive = location.pathname === m.path ||
            (m.path !== "/" && location.pathname.startsWith(m.path))
          const showBadge = m.path === "/operations" && running > 0

          return (
            <Link
              key={m.path}
              to={m.path}
              className={`cc-rail-item${isActive ? " cc-rail-item--active" : ""}`}
              onClick={onClose}
            >
              <span className="cc-rail-num">{m.num}</span>
              <span>
                <span className="cc-rail-label">{m.label}</span>
                <span className="cc-rail-sub">{m.sub}</span>
              </span>
              {showBadge && <span className="cc-rail-badge">{running}</span>}
            </Link>
          )
        })}

        <div className="cc-rail-spacer" />
        <div className="cc-rail-section-hdr">NAVIGASI LAIN</div>

        <Link
          to="/profil/new"
          className={`cc-rail-item${location.pathname.startsWith("/profil") ? " cc-rail-item--active" : ""}`}
          onClick={onClose}
        >
          <span className="cc-rail-num">—</span>
          <span>
            <span className="cc-rail-label">PROFIL</span>
            <span className="cc-rail-sub">Company Detail</span>
          </span>
        </Link>
      </div>

      {/* Service status */}
      <div className="cc-rail-bottom">
        <ServiceRow label="Gateway :8000"  url="http://localhost:8000/health" />
        <ServiceRow label="Backend :3001"  url="http://localhost:3001/health" />
        <ServiceRow label="Ollama qwen3.5" url="" />
      </div>
    </nav>
  )
}

function ServiceRow({ label, url }: { label: string; url: string }) {
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    if (!url) { setOk(true); return }
    async function check() {
      try { await fetch(url, { signal: AbortSignal.timeout(2000) }); setOk(true) }
      catch { setOk(false) }
    }
    check()
    const id = setInterval(check, 15000)
    return () => clearInterval(id)
  }, [url])

  return (
    <div className="cc-rail-service">
      <span className={`cc-dot cc-dot--${ok === null ? "idle" : ok ? "done" : "failed"}`} />
      <span className="cc-rail-service-name">{label}</span>
    </div>
  )
}
