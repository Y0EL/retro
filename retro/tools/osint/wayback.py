"""[13] OSINT — MAIN: Wayback Machine CDX API (free, no key)"""
from datetime import datetime
from typing import Optional

try:
    import httpx
    _AVAILABLE = True
except ImportError:
    _AVAILABLE = False


def fetch(domain: str, limit: int = 5) -> dict:
    """Query Wayback CDX API: kapan domain pertama kali di-crawl, snapshot history."""
    if not _AVAILABLE:
        return {"domain": domain, "found": False, "snapshots": [], "tool": "wayback", "error": "httpx not installed"}
    try:
        url = (f"https://web.archive.org/cdx/search/cdx?url={domain}&output=json"
               f"&limit={limit}&fl=timestamp,statuscode&filter=statuscode:200&collapse=timestamp:4")
        with httpx.Client(timeout=15) as client:
            resp = client.get(url)
            if resp.status_code != 200:
                return {"domain": domain, "found": False, "snapshots": [], "tool": "wayback", "error": f"HTTP {resp.status_code}"}
            rows = resp.json()
            if not rows or len(rows) <= 1:
                return {"domain": domain, "found": False, "snapshots": [], "tool": "wayback", "error": None}
            header = rows[0]
            snapshots = [dict(zip(header, r)) for r in rows[1:]]
            first_seen = snapshots[0].get("timestamp","")[:8]
            age = _age_years(first_seen)
            return {"domain": domain, "found": True, "first_seen": first_seen, "estimated_age_years": age, "snapshots": snapshots, "tool": "wayback", "error": None}
    except Exception as e:
        return {"domain": domain, "found": False, "snapshots": [], "tool": "wayback", "error": str(e)}


def _age_years(yyyymmdd: str) -> Optional[float]:
    if not yyyymmdd or len(yyyymmdd) < 8: return None
    try:
        delta = datetime.utcnow() - datetime.strptime(yyyymmdd[:8], "%Y%m%d")
        return round(delta.days / 365.25, 1)
    except Exception: return None
