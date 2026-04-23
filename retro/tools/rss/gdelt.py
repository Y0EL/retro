"""[01] RSS / World Awareness — ALT2: GDELT Project API (free, no key)"""
try:
    import httpx
    _AVAILABLE = True
except ImportError:
    _AVAILABLE = False

GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc"


def fetch(query: str, max_items: int = 20, timespan: str = "24h") -> dict:
    """Query GDELT global news event database. Gratis, no API key."""
    if not _AVAILABLE:
        return {"query": query, "items": [], "count": 0, "tool": "gdelt", "error": "httpx not installed"}
    try:
        params = {
            "query": query,
            "mode": "artlist",
            "maxrecords": max_items,
            "timespan": timespan,
            "format": "json",
        }
        with httpx.Client(timeout=20) as client:
            resp = client.get(GDELT_URL, params=params)
            data = resp.json()

        items = [{
            "title": a.get("title", ""),
            "link": a.get("url", ""),
            "summary": "",
            "published": a.get("seendate", ""),
            "author": a.get("domain", ""),
            "tags": [a.get("language", ""), a.get("sourcecountry", "")],
        } for a in data.get("articles", [])]

        return {"query": query, "items": items, "count": len(items), "tool": "gdelt", "error": None}
    except Exception as e:
        return {"query": query, "items": [], "count": 0, "tool": "gdelt", "error": str(e)}
