import { useLocation, useNavigate } from "react-router-dom"
import { useTheme } from "../contexts/ThemeContext"

const ROUTE_LABEL: Record<string, string> = {
  "/":            "IKHTISAR",
  "/command":     "COMMAND CENTER",
  "/orkestrasi":  "ORKESTRASI",
  "/hitl":        "HUMAN IN THE LOOP",
  "/operations":  "OPERASI AKTIF",
  "/intel":       "INTEL DATABASE",
  "/database":    "DATABASE",
  "/lookup":      "LOOK UP",
  "/laporan":     "LAPORAN",
  "/health":      "SISTEM HEALTH",
  "/akun":        "AKUN",
  "/profil":      "PROFIL PERUSAHAAN",
}

interface Props { onToggleRail: () => void; railOpen: boolean }

export default function GlobalHeader({ onToggleRail, railOpen }: Props) {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const label = ROUTE_LABEL[location.pathname] ??
    (location.pathname.startsWith("/profil") ? "PROFIL PERUSAHAAN" : "RETRO")

  return (
    <header className="cc-header">
      {/* Left — OPS ID + status */}
      <div className="cc-hdr-left">
        <button className="cc-hdr-rail-toggle" onClick={onToggleRail} title="Toggle Navigation (M)">
          {railOpen ? "X" : "="}
        </button>
        <div>
          <div className="cc-hdr-ops-id">RETRO-OP-2026</div>
          <div className="cc-hdr-status">
            <span className="cc-dot cc-dot--done" />
            OPERASIONAL
          </div>
        </div>
      </div>

      {/* Center — breadcrumb */}
      <div className="cc-hdr-center">
        <span className="cc-hdr-breadcrumb-sep" style={{ fontSize: 10 }}>RETRO</span>
        <span className="cc-hdr-breadcrumb-sep">/</span>
        <span className="cc-hdr-breadcrumb">{label}</span>
      </div>

      {/* Right — actions */}
      <div className="cc-hdr-right">
        <button className="cc-hdr-btn" onClick={() => navigate("/lookup")}>
          <span className="cc-kbd">/</span> CARI
        </button>
        <span className="cc-hdr-operator">PT GSP</span>
        <button className="cc-hdr-btn" onClick={toggleTheme} title="Toggle Theme">
          {theme === "dark" ? "LIGHT" : "DARK"}
        </button>
      </div>
    </header>
  )
}
