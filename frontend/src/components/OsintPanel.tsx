import { useState } from "react"

interface Props {
  title: string
  placeholder: string
  buttonLabel?: string
  onQuery: (value: string) => Promise<unknown>
}

export default function OsintPanel({ title, placeholder, buttonLabel = "Query", onQuery }: Props) {
  const [value,   setValue]   = useState("")
  const [result,  setResult]  = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function run() {
    if (!value.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const r = await onQuery(value.trim())
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cc-osint-panel">
      <div className="cc-osint-panel-hdr">
        <span className="cc-osint-title">{title}</span>
        {loading && <span className="cc-spinner" />}
      </div>
      <div className="cc-osint-body">
        <div className="cc-form-row">
          <input
            className="cc-input"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={placeholder}
            onKeyDown={e => e.key === "Enter" && run()}
          />
          <button className="btn-cc btn-signal" onClick={run} disabled={loading || !value.trim()}>
            {buttonLabel}
          </button>
        </div>
        {error && (
          <div className="cc-osint-result" style={{ color: "var(--cc-status-failed)" }}>
            Error: {error}
          </div>
        )}
        {result && !error && (
          <div className="cc-osint-result">
            {typeof result === "string"
              ? result
              : JSON.stringify(result, null, 2)}
          </div>
        )}
      </div>
    </div>
  )
}
