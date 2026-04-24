import { useState, useEffect } from "react"

interface Config {
  ollamaUrl:   string
  ollamaModel: string
  gatewayUrl:  string
  backendUrl:  string
  vtApiKey:    string
  urlscanKey:  string
  otxKey:      string
  maxIterations: number
  defaultAgent: string
  autoSaveKB:   boolean
  pdfTheme:     string
}

const DEFAULTS: Config = {
  ollamaUrl:    "http://100.75.135.17:11434",
  ollamaModel:  "qwen3.5:9b",
  gatewayUrl:   "http://localhost:8000",
  backendUrl:   "http://localhost:3001",
  vtApiKey:     "",
  urlscanKey:   "",
  otxKey:       "",
  maxIterations: 25,
  defaultAgent:  "discovery",
  autoSaveKB:    true,
  pdfTheme:      "dark",
}

function loadConfig(): Config {
  try {
    const s = localStorage.getItem("retro-config")
    return s ? { ...DEFAULTS, ...JSON.parse(s) } : DEFAULTS
  } catch { return DEFAULTS }
}

export default function Akun() {
  const [cfg,   setCfg]   = useState<Config>(loadConfig)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof Config>(k: K, v: Config[K]) {
    setCfg(prev => ({ ...prev, [k]: v }))
  }

  function save() {
    localStorage.setItem("retro-config", JSON.stringify(cfg))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function reset() {
    setCfg(DEFAULTS)
    localStorage.removeItem("retro-config")
  }

  return (
    <div className="cc-page">
      {saved && (
        <div className="cc-alert-banner cc-alert-banner--ok">
          Konfigurasi berhasil disimpan ke localStorage.
        </div>
      )}

      {/* Ollama */}
      <div className="cc-panel">
        <div className="cc-panel-hdr">
          <span className="cc-panel-title">
            <span className="cc-panel-title-num">01</span>KONFIGURASI OLLAMA
          </span>
        </div>
        <div className="cc-panel-body cc-grid-2">
          <Field label="Ollama Server URL"  value={cfg.ollamaUrl}   onChange={v => set("ollamaUrl", v)} />
          <Field label="Model Name"         value={cfg.ollamaModel} onChange={v => set("ollamaModel", v)} />
        </div>
      </div>

      {/* Services */}
      <div className="cc-panel">
        <div className="cc-panel-hdr">
          <span className="cc-panel-title">
            <span className="cc-panel-title-num">02</span>SERVICE URLS
          </span>
        </div>
        <div className="cc-panel-body cc-grid-2">
          <Field label="Gateway URL"  value={cfg.gatewayUrl} onChange={v => set("gatewayUrl", v)} />
          <Field label="Backend URL"  value={cfg.backendUrl} onChange={v => set("backendUrl", v)} />
        </div>
      </div>

      {/* API Keys */}
      <div className="cc-panel">
        <div className="cc-panel-hdr">
          <span className="cc-panel-title">
            <span className="cc-panel-title-num">03</span>API KEYS
          </span>
          <span style={{ fontSize: 10, color: "var(--cc-data-muted)" }}>Disimpan hanya di browser (localStorage)</span>
        </div>
        <div className="cc-panel-body cc-grid-3">
          <Field label="VirusTotal API Key"    value={cfg.vtApiKey}    onChange={v => set("vtApiKey", v)}    password />
          <Field label="URLScan.io API Key"    value={cfg.urlscanKey}  onChange={v => set("urlscanKey", v)}  password />
          <Field label="AlienVault OTX Key"   value={cfg.otxKey}      onChange={v => set("otxKey", v)}      password />
        </div>
      </div>

      {/* Agent defaults */}
      <div className="cc-panel">
        <div className="cc-panel-hdr">
          <span className="cc-panel-title">
            <span className="cc-panel-title-num">04</span>AGENT DEFAULTS
          </span>
        </div>
        <div className="cc-panel-body" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <div>
            <label className="cc-label">Max Iterations</label>
            <input
              type="number"
              className="cc-input"
              value={cfg.maxIterations}
              onChange={e => set("maxIterations", Number(e.target.value))}
              min={5} max={50}
            />
          </div>
          <div>
            <label className="cc-label">Default Agent</label>
            <select className="cc-select" value={cfg.defaultAgent} onChange={e => set("defaultAgent", e.target.value)} style={{ width: "100%" }}>
              <option value="discovery">Discovery</option>
              <option value="briefing">Briefing</option>
              <option value="proposal">Proposal</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="cc-label">PDF Theme</label>
            <select className="cc-select" value={cfg.pdfTheme} onChange={e => set("pdfTheme", e.target.value)} style={{ width: "100%" }}>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "flex-end" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "var(--cc-data-secondary)" }}>
              <input
                type="checkbox"
                checked={cfg.autoSaveKB}
                onChange={e => set("autoSaveKB", e.target.checked)}
                style={{ accentColor: "var(--cc-signal-critical)" }}
              />
              <span>Auto-save ke KB</span>
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn-cc btn-signal" onClick={save}>
          Simpan Konfigurasi
        </button>
        <button className="btn-cc btn-standard" onClick={reset}>
          Reset ke Default
        </button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, password }: {
  label: string; value: string | number
  onChange: (v: string) => void; password?: boolean
}) {
  return (
    <div>
      <label className="cc-label">{label}</label>
      <input
        type={password ? "password" : "text"}
        className="cc-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={password ? "●●●●●●●●●●●●" : undefined}
      />
    </div>
  )
}
