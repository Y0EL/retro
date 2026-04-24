import { useEffect, useRef } from "react"

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export default function SearchBar({ value, onChange, placeholder = "Cari...", autoFocus }: Props) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onFocus() { ref.current?.focus() }
    window.addEventListener("cc:search-focus", onFocus)
    return () => window.removeEventListener("cc:search-focus", onFocus)
  }, [])

  return (
    <div className="cc-searchbar">
      <span className="cc-searchbar-icon">CARI</span>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          style={{ background: "none", border: "none", color: "var(--cc-data-muted)", cursor: "pointer", padding: 0 }}
        >
          X
        </button>
      )}
    </div>
  )
}
