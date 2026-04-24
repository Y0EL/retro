import { useEffect, useCallback } from "react"

export function useArrowNav(
  items: string[],
  selected: string | null,
  onSelect: (id: string) => void
) {
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (!items.length) return
    const tag = (e.target as HTMLElement).tagName
    if (tag === "INPUT" || tag === "TEXTAREA") return

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const idx = selected ? items.indexOf(selected) : -1
      const next = e.key === "ArrowDown"
        ? Math.min(idx + 1, items.length - 1)
        : Math.max(idx - 1, 0)
      onSelect(items[next])
    }
  }, [items, selected, onSelect])

  useEffect(() => {
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [handleKey])
}
