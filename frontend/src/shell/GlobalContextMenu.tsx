import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"

interface CtxMenu { x: number; y: number }

export default function GlobalContextMenu() {
  const [menu, setMenu] = useState<CtxMenu | null>(null)
  const navigate = useNavigate()

  const close = useCallback(() => setMenu(null), [])

  useEffect(() => {
    function onCtx(e: MouseEvent) {
      e.preventDefault()
      setMenu({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener("contextmenu", onCtx)
    window.addEventListener("click", close)
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") close() })
    return () => {
      window.removeEventListener("contextmenu", onCtx)
      window.removeEventListener("click", close)
    }
  }, [close])

  if (!menu) return null

  const items = [
    { label: "Ikhtisar",        path: "/" },
    { label: "Command Center",  path: "/command" },
    { label: "Orkestrasi",      path: "/orkestrasi" },
    { label: "Operasi Aktif",   path: "/operations" },
    { label: "Look Up",         path: "/lookup" },
    { label: "Sistem Health",   path: "/health" },
  ]

  const style: React.CSSProperties = {
    left: Math.min(menu.x, window.innerWidth - 220),
    top:  Math.min(menu.y, window.innerHeight - 240),
  }

  return (
    <div className="cc-ctx-menu" style={style}>
      <div className="cc-ctx-section">NAVIGASI CEPAT</div>
      {items.map(i => (
        <div key={i.path} className="cc-ctx-item" onClick={() => navigate(i.path)}>
          {i.label}
        </div>
      ))}
      <div className="cc-ctx-divider" />
      <div className="cc-ctx-section">AKSI</div>
      <div className="cc-ctx-item" onClick={() => { navigate("/command"); close() }}>
        Jalankan Agent Baru
      </div>
      <div className="cc-ctx-item" onClick={() => window.location.reload()}>
        Refresh Halaman
      </div>
    </div>
  )
}
