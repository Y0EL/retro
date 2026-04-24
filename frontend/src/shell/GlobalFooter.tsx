import { useEffect, useState } from "react"
import { getWIBClock } from "../lib/utils"

const GROUPS = [
  [
    { key: "1-5", label: "PANEL" },
    { key: "J/K", label: "JOB"   },
  ],
  [
    { key: "R",   label: "RUN"    },
    { key: "S",   label: "STOP"   },
    { key: "E",   label: "EXPORT" },
  ],
  [
    { key: "/",   label: "CARI"    },
    { key: "F",   label: "FULLSCR" },
    { key: "ESC", label: "BACK"    },
  ],
]

const ALL_KEYS = GROUPS.flat()

export default function GlobalFooter() {
  const [clock,     setClock]  = useState(getWIBClock())
  const [activeKey, setActive] = useState<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => setClock(getWIBClock()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    function onKeyPress(e: Event) {
      const key = (e as CustomEvent).detail?.key as string
      if (!key) return
      const match = ALL_KEYS.find(s => s.key.toLowerCase() === key.toLowerCase())
      if (match) {
        setActive(match.key)
        setTimeout(() => setActive(null), 250)
      }
    }
    window.addEventListener("cc:key-press", onKeyPress)
    return () => window.removeEventListener("cc:key-press", onKeyPress)
  }, [])

  return (
    <footer className="cc-footer">
      <div className="cc-footer-shortcuts">
        {GROUPS.map((group, gi) => (
          <div key={gi} className="cc-footer-group">
            {gi > 0 && <div className="cc-footer-sep" />}
            {group.map(s => (
              <div key={s.key} className="cc-footer-item">
                <span className={`cc-kbd${activeKey === s.key ? " cc-kbd--active" : ""}`}>
                  {s.key}
                </span>
                <span className="cc-footer-label">{s.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="cc-footer-clock">{clock}</div>
    </footer>
  )
}
