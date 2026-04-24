import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { listJobs, getJobStatus, subscribeToJob } from "../lib/api"
import type { Job, ProgressEvent } from "../lib/api"
import JobTable from "../components/JobTable"
import JobEventLog from "../components/JobEventLog"
import KPICard from "../components/KPICard"
import PdfViewer from "../components/PdfViewer"
import { fmtDuration } from "../lib/utils"

export default function OperasiAktif() {
  const [jobs,        setJobs]        = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [events,      setEvents]      = useState<ProgressEvent[]>([])
  const [searchParams] = useSearchParams()

  // Auto-select from URL param
  const urlJobId = searchParams.get("job")

  useEffect(() => {
    async function fetchAll() {
      try {
        const data = await listJobs()
        const sorted = [...(data.jobs || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        setJobs(sorted)

        if (urlJobId && !selectedJob) {
          const found = sorted.find(j => j.jobId === urlJobId)
          if (found) selectJob(found)
        }
      } catch { /* */ }
    }
    fetchAll()
    const id = setInterval(fetchAll, 2000)
    return () => clearInterval(id)
  }, [])

  function selectJob(job: Job) {
    setSelectedJob(job)
    setEvents(job.events || [])

    if (job.status === "running") {
      const unsub = subscribeToJob(job.jobId, (e) => {
        if ("type" in e && e.type !== "status") {
          setEvents(prev => [...prev, e as ProgressEvent])
        }
      })
      return unsub
    }
  }

  const running = jobs.filter(j => j.status === "running" || j.status === "queued").length

  return (
    <div className="cc-page">
      {/* Banner */}
      {running > 0 && (
        <div className="cc-alert-banner cc-alert-banner--info">
          <span className="cc-spinner" />
          {running} agent sedang berjalan — hasil akan muncul di Intel Database saat selesai.
        </div>
      )}

      {/* KPIs */}
      <div className="cc-kpi-grid">
        <KPICard label="Total"   value={jobs.length} sub="semua" />
        <KPICard label="Aktif"   value={running} sub="running/queued" variant={running > 0 ? "signal" : "idle"} />
        <KPICard label="Selesai" value={jobs.filter(j => j.status === "done").length} sub="done" variant="done" />
        <KPICard label="Gagal"   value={jobs.filter(j => j.status === "failed").length} sub="failed" variant={jobs.filter(j => j.status === "failed").length > 0 ? "warn" : "idle"} />
      </div>

      {/* Split: table + detail */}
      <div className="cc-split">
        {/* Job table */}
        <div className="cc-panel">
          <div className="cc-panel-hdr">
            <span className="cc-panel-title">
              <span className="cc-panel-title-num">05</span>OPERASI AKTIF
            </span>
            <span style={{ fontSize: 10, color: "var(--cc-data-muted)" }}>Live · 2s</span>
          </div>
          <JobTable jobs={jobs} selectedId={selectedJob?.jobId} onSelect={j => selectJob(j)} />
        </div>

        {/* Job detail */}
        {selectedJob ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="cc-panel">
              <div className="cc-panel-hdr">
                <span className="cc-panel-title">
                  <span className="cc-panel-title-num">&gt;</span>DETAIL JOB
                </span>
                <button className="btn-cc btn-ghost" onClick={() => setSelectedJob(null)} style={{ fontSize: 11 }}>X</button>
              </div>
              <div className="cc-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Row label="Job ID"     value={selectedJob.jobId} mono />
                <Row label="Intent"     value={selectedJob.intent} />
                <Row label="Agent"      value={selectedJob.agentType} />
                <Row label="Status"     value={selectedJob.status} />
                <Row label="Durasi"     value={fmtDuration(selectedJob.startedAt, selectedJob.completedAt)} mono />
              </div>
            </div>

            <div className="cc-panel">
              <div className="cc-panel-hdr">
                <span className="cc-panel-title">INTEL LOG</span>
                <span style={{ fontSize: 10, color: "var(--cc-data-muted)" }}>{events.length} events</span>
              </div>
              <div className="cc-panel-body" style={{ padding: 10 }}>
                <JobEventLog events={events} running={selectedJob.status === "running"} />
              </div>
            </div>

            {selectedJob.result && (
              <div className="cc-panel">
                <div className="cc-panel-hdr">
                  <span className="cc-panel-title">HASIL</span>
                </div>
                <div className="cc-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <PdfViewer result={selectedJob.result} />
                  {selectedJob.result.result && (
                    <div style={{
                      background: "var(--cc-abyss)",
                      border: "1px solid var(--cc-border-subtle)",
                      borderRadius: "var(--cc-radius-sm)",
                      padding: 10,
                      fontFamily: "var(--font-data)",
                      fontSize: 11,
                      color: "var(--cc-data-secondary)",
                      maxHeight: 200,
                      overflowY: "auto",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}>
                      {selectedJob.result.result}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="cc-panel">
            <div className="cc-empty">
              <div className="cc-empty-icon">--</div>
              <div>Klik baris job untuk melihat detail dan live log</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
      <span style={{ color: "var(--cc-data-muted)", minWidth: 70, fontFamily: "var(--font-ui)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </span>
      <span style={{ color: "var(--cc-data-primary)", fontFamily: mono ? "var(--font-data)" : undefined, wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  )
}
