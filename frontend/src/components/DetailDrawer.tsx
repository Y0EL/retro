import { useEffect } from "react"

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}

export default function DetailDrawer({ open, title, onClose, children }: Props) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onEsc)
    return () => window.removeEventListener("keydown", onEsc)
  }, [onClose])

  return (
    <div className={`cc-drawer${open ? " cc-drawer--open" : ""}`}>
      <div className="cc-drawer-hdr">
        <span className="cc-drawer-title">{title}</span>
        <button className="btn-cc btn-ghost" onClick={onClose} style={{ padding: "3px 8px" }}>X</button>
      </div>
      <div className="cc-drawer-body">
        {open && children}
      </div>
    </div>
  )
}
