import OsintPanel from "../components/OsintPanel"
import {
  osintCompanyLookup,
  osintDomainReputation,
  osintIpIntelligence,
  osintSanctionsCheck,
  osintThreatIntel,
  osintWayback,
  osintGeolocation,
  osintUrlScan,
} from "../lib/api"

export default function LookUp() {
  return (
    <div className="cc-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--cc-data-muted)" }}>
            08 LOOK UP
          </div>
          <div style={{ fontSize: 13, color: "var(--cc-data-secondary)", marginTop: 2 }}>
            Manual OSINT tools — 8 sumber intelijen bebas
          </div>
        </div>
        <span style={{ fontSize: 10, color: "var(--cc-data-muted)", fontFamily: "var(--font-data)" }}>
          Gateway :8000
        </span>
      </div>

      {/* Row 1 */}
      <div className="cc-grid-4">
        <OsintPanel
          title="Company Lookup"
          placeholder="Nama perusahaan (ex: PT Pindad)"
          buttonLabel="Lookup"
          onQuery={v => osintCompanyLookup(v)}
        />
        <OsintPanel
          title="Domain Reputation"
          placeholder="Domain (ex: pindad.com)"
          buttonLabel="Check"
          onQuery={v => osintDomainReputation(v)}
        />
        <OsintPanel
          title="IP Intelligence"
          placeholder="IP Address (ex: 8.8.8.8)"
          buttonLabel="Lookup"
          onQuery={v => osintIpIntelligence(v)}
        />
        <OsintPanel
          title="Sanctions Check"
          placeholder="Nama perusahaan / orang"
          buttonLabel="Check"
          onQuery={v => osintSanctionsCheck(v)}
        />
      </div>

      {/* Row 2 */}
      <div className="cc-grid-4">
        <OsintPanel
          title="Threat Intel"
          placeholder="Domain atau IP (ex: evil.com)"
          buttonLabel="Analyze"
          onQuery={v => osintThreatIntel(v)}
        />
        <OsintPanel
          title="Wayback Machine"
          placeholder="URL (ex: https://pindad.com)"
          buttonLabel="Lookup"
          onQuery={v => osintWayback(v)}
        />
        <OsintPanel
          title="Geolokasi"
          placeholder="Alamat / kota / koordinat"
          buttonLabel="Geocode"
          onQuery={v => osintGeolocation(v)}
        />
        <OsintPanel
          title="URL Scan"
          placeholder="URL untuk di-scan malware"
          buttonLabel="Scan"
          onQuery={v => osintUrlScan(v)}
        />
      </div>

      <div style={{ fontSize: 11, color: "var(--cc-data-muted)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--cc-data-tertiary)" }}>Sumber data:</strong>{" "}
        OpenCorporates · VirusTotal · ipinfo.io · OpenSanctions · AlienVault OTX · Wayback Machine · Nominatim/OSM · URLScan.io
      </div>
    </div>
  )
}
