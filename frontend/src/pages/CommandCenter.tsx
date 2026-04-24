import { useState } from "react"
import { useNavigate } from "react-router-dom"
import AgentRunner from "../components/AgentRunner"

export default function CommandCenter() {
  const navigate  = useNavigate()

  function onJobCreated(jobId: string) {
    setTimeout(() => navigate(`/operations`), 3000)
  }

  return (
    <div className="cc-page">
      <div className="cc-kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="cc-kpi-card cc-kpi-card--signal">
          <span className="cc-kpi-label">DISCOVERY</span>
          <span className="cc-kpi-value" style={{ fontSize: 14 }}>Riset Perusahaan</span>
          <span className="cc-kpi-sub">7 langkah otomatis · Profil + PDF</span>
        </div>
        <div className="cc-kpi-card cc-kpi-card--idle">
          <span className="cc-kpi-label">BRIEFING</span>
          <span className="cc-kpi-value" style={{ fontSize: 14 }}>Pre-Meeting Intel</span>
          <span className="cc-kpi-sub">9 seksi · Pertanyaan CEO</span>
        </div>
        <div className="cc-kpi-card cc-kpi-card--warn">
          <span className="cc-kpi-label">PROPOSAL</span>
          <span className="cc-kpi-value" style={{ fontSize: 14 }}>Surat Penawaran</span>
          <span className="cc-kpi-sub">B2B proposal · PDF outbound</span>
        </div>
        <div className="cc-kpi-card cc-kpi-card--done" style={{ cursor: "pointer" }} onClick={() => navigate("/operations")}>
          <span className="cc-kpi-label">PIPELINE</span>
          <span className="cc-kpi-value" style={{ fontSize: 14 }}>Full Auto</span>
          <span className="cc-kpi-sub">Discovery → Briefing → Proposal</span>
        </div>
      </div>

      <div className="cc-panel">
        <div className="cc-panel-hdr">
          <span className="cc-panel-title">
            <span className="cc-panel-title-num">02</span>MISSION INPUT
          </span>
          <span style={{ fontFamily: "var(--font-data)", fontSize: 10, color: "var(--cc-data-muted)" }}>
            Ollama · qwen3.5:9b
          </span>
        </div>
        <div className="cc-panel-body">
          <AgentRunner onJobCreated={onJobCreated} />
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--cc-data-muted)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--cc-data-tertiary)" }}>Tips:</strong>{" "}
        Gunakan <span style={{ color: "var(--cc-signal-critical)" }}>Discovery</span> untuk riset perusahaan baru,{" "}
        <span style={{ color: "#9d92d8" }}>Briefing</span> untuk persiapan meeting,{" "}
        <span style={{ color: "var(--cc-warn-elevated)" }}>Proposal</span> untuk surat penawaran B2B.{" "}
        <span style={{ color: "var(--cc-status-done)" }}>Full Pipeline</span> menjalankan semua secara berurutan.
      </div>
    </div>
  )
}
