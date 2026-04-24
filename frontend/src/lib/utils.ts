export function fmtDuration(startedAt?: string, completedAt?: string): string {
  if (!startedAt) return "—"
  const end = completedAt ? new Date(completedAt) : new Date()
  const sec = Math.round((end.getTime() - new Date(startedAt).getTime()) / 1000)
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m ${s}s`
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("id-ID", { hour12: false })
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s
}

export function getWIBClock(): string {
  const d = new Date()
  const wib = new Date(d.getTime() + 7 * 3600000)
  return wib.toISOString().slice(11, 19) + " WIB"
}

export function extractDownloadUrls(obj: unknown, urls: string[] = []): string[] {
  if (!obj || typeof obj !== "object") return urls
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === "download_url" && typeof v === "string") urls.push(v)
    else extractDownloadUrls(v, urls)
  }
  return urls
}

export function statusClass(status: string): string {
  return `cc-badge cc-badge--${status}`
}

export function agentClass(type: string): string {
  return `cc-badge cc-badge--${type}`
}
