import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

const KEY_NAV: Record<string, string> = {
  "1": "/",
  "2": "/command",
  "3": "/orkestrasi",
  "4": "/hitl",
  "5": "/operations",
}

export function useGlobalKeyboard() {
  const navigate = useNavigate()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      window.dispatchEvent(new CustomEvent("cc:key-press", { detail: { key: e.key } }))

      if (KEY_NAV[e.key]) {
        navigate(KEY_NAV[e.key])
        return
      }

      switch (e.key) {
        case "Escape":
          window.dispatchEvent(new CustomEvent("cc:escape"))
          break
        case "/":
          e.preventDefault()
          window.dispatchEvent(new CustomEvent("cc:search-focus"))
          break
        case "r":
        case "R":
          window.dispatchEvent(new CustomEvent("cc:refresh"))
          break
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [navigate])
}
