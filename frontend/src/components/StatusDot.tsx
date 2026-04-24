type Status = "active" | "done" | "failed" | "idle" | "queued"

export default function StatusDot({ status }: { status: Status }) {
  return <span className={`cc-dot cc-dot--${status}`} />
}
