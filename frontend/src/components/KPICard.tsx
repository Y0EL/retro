interface Props {
  label: string
  value: number | string
  sub?: string
  delta?: string
  deltaUp?: boolean
  variant?: "signal" | "warn" | "done" | "idle"
}

export default function KPICard({ label, value, sub, delta, deltaUp = true, variant = "idle" }: Props) {
  return (
    <div className={`cc-kpi-card cc-kpi-card--${variant}`}>
      <span className="cc-kpi-label">{label}</span>
      <span className="cc-kpi-value">{value}</span>
      {sub   && <span className="cc-kpi-sub">{sub}</span>}
      {delta && <span className={`cc-kpi-delta cc-kpi-delta--${deltaUp ? "up" : "down"}`}>{delta}</span>}
    </div>
  )
}
