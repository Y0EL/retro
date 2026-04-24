import { extractDownloadUrls, fmtDate } from "../lib/utils"

interface Props { result?: unknown; jobId?: string }

export default function PdfViewer({ result, jobId }: Props) {
  const urls = extractDownloadUrls(result)
  if (urls.length === 0) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="cc-label">LAPORAN PDF</div>
      {urls.map((url, i) => (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-cc btn-standard"
          style={{ textDecoration: "none", display: "inline-flex" }}
        >
          Download PDF {urls.length > 1 ? `(${i + 1})` : ""}
        </a>
      ))}
    </div>
  )
}
