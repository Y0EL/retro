import { useState } from "react"

interface Props {
  subject?: string
  body?: string
  targetCompany?: string
  // new multi-draft fields
  company?: string
  email?: string
  role?: string
}

export default function EmailDraftPanel({ subject, body, targetCompany, company, email, role }: Props) {
  const displayCompany = company || targetCompany
  const [copied, setCopied] = useState(false)

  if (!subject && !body) return null

  function copyToClipboard() {
    const full = `Subjek: ${subject ?? ""}\n\n${body ?? ""}`
    navigator.clipboard.writeText(full).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // fallback
      const ta = document.createElement("textarea")
      ta.value = full
      document.body.appendChild(ta)
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{
      border: "1px solid var(--cc-warn-dim)",
      borderTop: "3px solid var(--cc-warn-elevated)",
      background: "var(--cc-abyss)",
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 9, fontFamily: "var(--font-data)", letterSpacing: "0.12em", color: "var(--cc-warn-elevated)", marginBottom: 2 }}>
            DRAFT EMAIL OUTBOUND
          </div>
          {displayCompany && (
            <div style={{ fontSize: 11, color: "var(--cc-data-primary)", fontWeight: 600 }}>
              {displayCompany}
            </div>
          )}
          {(email || role) && (
            <div style={{ fontSize: 10, color: "var(--cc-data-muted)", marginTop: 2 }}>
              {email && <span style={{ fontFamily: "var(--font-data)", color: "var(--cc-signal-medium)" }}>{email}</span>}
              {email && role && <span style={{ margin: "0 6px", color: "var(--cc-border)" }}>·</span>}
              {role && <span>{role}</span>}
            </div>
          )}
        </div>
        <button
          onClick={copyToClipboard}
          style={{
            background: copied ? "var(--cc-status-done)" : "var(--cc-elevated)",
            border: "1px solid var(--cc-border)",
            color: copied ? "#fff" : "var(--cc-data-secondary)",
            fontFamily: "var(--font-data)", fontSize: 9,
            padding: "5px 10px", cursor: "pointer",
            letterSpacing: "0.08em",
            transition: "background 0.2s",
          }}
        >
          {copied ? "TERSALIN!" : "SALIN DRAFT"}
        </button>
      </div>

      {subject && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, fontFamily: "var(--font-data)", color: "var(--cc-data-muted)", letterSpacing: "0.1em", marginBottom: 4 }}>
            SUBJEK
          </div>
          <div style={{
            fontSize: 12, fontWeight: 600, color: "var(--cc-data-primary)",
            background: "var(--cc-elevated)", padding: "8px 10px",
            borderLeft: "2px solid var(--cc-warn-elevated)",
          }}>
            {subject}
          </div>
        </div>
      )}

      {body && (
        <div>
          <div style={{ fontSize: 9, fontFamily: "var(--font-data)", color: "var(--cc-data-muted)", letterSpacing: "0.1em", marginBottom: 4 }}>
            ISI EMAIL
          </div>
          <div style={{
            fontSize: 11, color: "var(--cc-data-secondary)", lineHeight: 1.7,
            background: "var(--cc-elevated)", padding: "10px 12px",
            borderLeft: "2px solid var(--cc-border)",
            whiteSpace: "pre-wrap",
          }}>
            {body}
          </div>
        </div>
      )}
    </div>
  )
}
