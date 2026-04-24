import { useEffect, useRef } from "react"
import type { ProgressEvent } from "../lib/api"

interface Props { events: ProgressEvent[]; running?: boolean }

function formatEvent(e: ProgressEvent): { tag: string; cls: string; text: string } {
  const ts = e.timestamp ? new Date(e.timestamp).toISOString().slice(11, 19) : ""

  if (e.type === "tool_call") {
    const preview = JSON.stringify(e.input || {}).slice(0, 60)
    return { tag: "CALL", cls: "t-call", text: `${e.tool?.padEnd(20) ?? ""}  ${preview}` }
  }
  if (e.type === "tool_result") {
    const out = typeof e.output === "string" ? e.output.slice(0, 60) : JSON.stringify(e.output || {}).slice(0, 60)
    return e.success
      ? { tag: "OK  ", cls: "t-ok",   text: `${e.tool?.padEnd(20) ?? ""}  ${out}` }
      : { tag: "FAIL", cls: "t-fail", text: `${e.tool?.padEnd(20) ?? ""}  ${e.error?.slice(0, 60) || "error"}` }
  }
  if (e.type === "completed") {
    return { tag: "DONE", cls: "t-done", text: e.message || "Selesai" }
  }
  if (e.type === "error") {
    return { tag: "ERR ", cls: "t-fail", text: e.error || e.message || "error" }
  }
  return { tag: "INFO", cls: "t-info", text: e.message || JSON.stringify(e).slice(0, 80) }
}

export default function JobEventLog({ events, running }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [events.length])

  return (
    <div className="cc-terminal" style={{ minHeight: 220, maxHeight: 400 }}>
      {events.length === 0 ? (
        <div className="cc-terminal-prompt">
          <span className="cc-cursor-blink" />
          <span style={{ color: "var(--cc-data-muted)", fontFamily: "var(--font-data)", fontSize: 11 }}>
            Menunggu agent...
          </span>
        </div>
      ) : (
        events.map((e, i) => {
          const { tag, cls, text } = formatEvent(e)
          const ts = e.timestamp ? new Date(e.timestamp).toISOString().slice(11, 19) : "—"
          return (
            <div key={i} className="cc-terminal-line">
              <span className="cc-terminal-ts">{ts}</span>
              <span className={`cc-terminal-tag ${cls}`}>{tag}</span>
              <span className="cc-terminal-text">{text}</span>
            </div>
          )
        })
      )}
      {running && (
        <div className="cc-terminal-prompt">
          <span className="cc-cursor-blink" />
          <span style={{ color: "var(--cc-signal-medium)", fontFamily: "var(--font-data)", fontSize: 11 }}>
            Agent sedang berjalan...
          </span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  )
}
