import { useState, useCallback } from "react"
import { runAgent, runPipeline, subscribeToJob } from "../lib/api"
import type { ProgressEvent } from "../lib/api"
import JobEventLog from "./JobEventLog"

interface Props { onJobCreated?: (jobId: string) => void }

const AGENT_TYPES = [
  { value: "discovery", label: "Discovery" },
  { value: "briefing",  label: "Briefing" },
  { value: "proposal",  label: "Proposal" },
  { value: "admin",     label: "Admin" },
]

export default function AgentRunner({ onJobCreated }: Props) {
  const [intent,    setIntent]    = useState("")
  const [agentType, setAgentType] = useState("discovery")
  const [events,    setEvents]    = useState<ProgressEvent[]>([])
  const [running,   setRunning]   = useState(false)
  const [jobId,     setJobId]     = useState<string | null>(null)
  const [unsubFn,   setUnsubFn]   = useState<(() => void) | null>(null)

  const startSubscription = useCallback((id: string) => {
    const unsub = subscribeToJob(id, (e) => {
      if ("type" in e) {
        if (e.type === "status" && (e as { type: string; status: string }).status === "done") {
          setRunning(false)
        } else {
          setEvents(prev => [...prev, e as ProgressEvent])
        }
      }
    })
    setUnsubFn(() => unsub)
    return unsub
  }, [])

  async function handleRun() {
    if (!intent.trim() || running) return
    setEvents([])
    setRunning(true)
    try {
      const { jobId: id } = await runAgent(intent.trim(), agentType)
      setJobId(id)
      onJobCreated?.(id)
      startSubscription(id)
    } catch (e) {
      setRunning(false)
      setEvents([{
        type: "error",
        error: e instanceof Error ? e.message : String(e),
        timestamp: new Date().toISOString(),
      }])
    }
  }

  async function handlePipeline() {
    if (!intent.trim() || running) return
    setEvents([])
    setRunning(true)
    try {
      const { jobId: id } = await runPipeline(intent.trim())
      setJobId(id)
      onJobCreated?.(id)
      startSubscription(id)
    } catch (e) {
      setRunning(false)
      setEvents([{
        type: "error",
        error: e instanceof Error ? e.message : String(e),
        timestamp: new Date().toISOString(),
      }])
    }
  }

  function handleStop() {
    unsubFn?.()
    setRunning(false)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Intent input */}
      <div>
        <label className="cc-label">MISSION INTENT</label>
        <textarea
          className="cc-textarea"
          value={intent}
          onChange={e => setIntent(e.target.value)}
          placeholder="Contoh: Riset PT Pindad Indonesia, temukan profil, kontak, dan berita terbaru"
          rows={3}
          onKeyDown={e => { if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); handleRun() } }}
        />
      </div>

      {/* Agent type + buttons */}
      <div className="cc-form-row" style={{ flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label className="cc-label">AGENT TYPE</label>
          <select className="cc-select" value={agentType} onChange={e => setAgentType(e.target.value)}>
            {AGENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <button
            className="btn-cc btn-signal"
            onClick={handleRun}
            disabled={running || !intent.trim()}
          >
            {running ? <span className="cc-spinner" /> : null} RUN AGENT
          </button>
          <button
            className="btn-cc btn-warn"
            onClick={handlePipeline}
            disabled={running || !intent.trim()}
          >
            FULL PIPELINE
          </button>
          {running && (
            <button className="btn-cc btn-danger" onClick={handleStop}>
              STOP
            </button>
          )}
        </div>
      </div>

      {/* Live terminal */}
      {(events.length > 0 || running) && (
        <div>
          <div className="flex-between" style={{ marginBottom: 6 }}>
            <label className="cc-label">LIVE INTEL LOG</label>
            {jobId && (
              <span className="mono" style={{ fontSize: 10, color: "var(--cc-data-muted)" }}>
                JOB: {jobId.slice(0, 12)}…
              </span>
            )}
          </div>
          <JobEventLog events={events} running={running} />
        </div>
      )}

      <div style={{ fontSize: 10, color: "var(--cc-data-muted)" }}>
        <span className="cc-kbd">Shift+Enter</span> untuk run · <span className="cc-kbd">ESC</span> untuk batal
      </div>
    </div>
  )
}
