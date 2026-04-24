import type { Job } from "../lib/api"
import { fmtDuration, fmtTime, truncate } from "../lib/utils"

interface Props {
  jobs: Job[]
  selectedId?: string | null
  onSelect?: (job: Job) => void
  maxRows?: number
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`cc-badge cc-badge--${status}`}>
      {status === "running" && <span className="cc-spinner" style={{ width: 8, height: 8, borderWidth: 1.5, marginRight: 4 }} />}
      {status}
    </span>
  )
}

function AgentBadge({ type }: { type: string }) {
  return <span className={`cc-badge cc-badge--${type}`}>{type}</span>
}

export default function JobTable({ jobs, selectedId, onSelect, maxRows }: Props) {
  const rows = maxRows ? jobs.slice(0, maxRows) : jobs

  if (rows.length === 0) {
    return (
      <div className="cc-empty">
        <div className="cc-empty-icon">--</div>
        <div>Belum ada operasi. Jalankan agent dari Command Center.</div>
      </div>
    )
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="cc-table">
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Agent</th>
            <th>Mission</th>
            <th>Status</th>
            <th>Durasi</th>
            <th>Dibuat</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(job => (
            <tr
              key={job.jobId}
              className={selectedId === job.jobId ? "active" : ""}
              onClick={() => onSelect?.(job)}
              style={onSelect ? { cursor: "pointer" } : {}}
            >
              <td className="mono">{job.jobId.slice(0, 10)}…</td>
              <td><AgentBadge type={job.agentType} /></td>
              <td style={{ maxWidth: 300 }}>
                <span className="truncate" style={{ display: "block" }} title={job.intent}>
                  {truncate(job.intent, 60)}
                </span>
              </td>
              <td><StatusBadge status={job.status} /></td>
              <td className="mono">{fmtDuration(job.startedAt, job.completedAt)}</td>
              <td className="mono">{fmtTime(job.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
