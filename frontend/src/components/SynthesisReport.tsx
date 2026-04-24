interface Props {
  text: string
  style?: React.CSSProperties
}

// Render agent synthesis text with simple markdown-like formatting
export default function SynthesisReport({ text, style }: Props) {
  if (!text || !text.trim()) return null

  const lines = text.split("\n")
  const elements: React.ReactNode[] = []

  lines.forEach((line, i) => {
    const trimmed = line.trim()

    if (!trimmed) {
      elements.push(<div key={i} style={{ height: 8 }} />)
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <div key={i} style={{
          fontSize: 12, fontWeight: 700, fontFamily: "var(--font-data)",
          color: "var(--cc-signal-high)", letterSpacing: "0.1em",
          marginTop: 14, marginBottom: 4,
          borderLeft: "3px solid var(--cc-signal-high)", paddingLeft: 8,
        }}>
          {trimmed.slice(3).toUpperCase()}
        </div>
      )
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <div key={i} style={{
          fontSize: 14, fontWeight: 700, color: "var(--cc-data-primary)",
          marginTop: 16, marginBottom: 6, fontFamily: "var(--font-ui)",
        }}>
          {trimmed.slice(2)}
        </div>
      )
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={i} style={{
          display: "flex", gap: 8,
          fontSize: 11, color: "var(--cc-data-secondary)", lineHeight: 1.6,
          paddingLeft: 8, marginBottom: 2,
        }}>
          <span style={{ color: "var(--cc-signal-medium)", flexShrink: 0 }}>▸</span>
          <span>{renderInline(trimmed.slice(2))}</span>
        </div>
      )
    } else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)/)
      elements.push(
        <div key={i} style={{
          display: "flex", gap: 8,
          fontSize: 11, color: "var(--cc-data-secondary)", lineHeight: 1.6,
          paddingLeft: 8, marginBottom: 2,
        }}>
          <span style={{ color: "var(--cc-signal-medium)", flexShrink: 0, fontFamily: "var(--font-data)" }}>
            {match?.[1]}.
          </span>
          <span>{renderInline(match?.[2] ?? "")}</span>
        </div>
      )
    } else if (trimmed.startsWith("---")) {
      elements.push(<div key={i} className="cc-divider" style={{ margin: "10px 0" }} />)
    } else {
      elements.push(
        <div key={i} style={{
          fontSize: 11, color: "var(--cc-data-secondary)", lineHeight: 1.7, marginBottom: 2,
        }}>
          {renderInline(trimmed)}
        </div>
      )
    }
  })

  return (
    <div style={{
      padding: "16px",
      background: "var(--cc-abyss)",
      border: "1px solid var(--cc-border-subtle)",
      maxHeight: 380,
      overflowY: "auto",
      ...style,
    }}>
      {elements}
    </div>
  )
}

// Render **bold** and `code` inline
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} style={{ color: "var(--cc-data-primary)", fontWeight: 700 }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--cc-signal-high)", background: "var(--cc-elevated)", padding: "0 3px" }}>{part.slice(1, -1)}</code>
    }
    return part
  })
}
