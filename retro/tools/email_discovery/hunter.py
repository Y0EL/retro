"""[09] Email Discovery — ALT1: Hunter.io API (25 searches/month free)"""
import os

try:
    import httpx
    _AVAILABLE = True
except ImportError:
    _AVAILABLE = False


def fetch(domain: str, api_key: str = "", limit: int = 10) -> dict:
    """Hunter.io domain search. Set HUNTER_API_KEY di .env."""
    key = api_key or os.environ.get("HUNTER_API_KEY", "")
    if not key:
        return {"domain": domain, "emails": [], "count": 0, "tool": "hunter", "error": "HUNTER_API_KEY not set"}
    if not _AVAILABLE:
        return {"domain": domain, "emails": [], "count": 0, "tool": "hunter", "error": "httpx not installed"}
    try:
        resp = httpx.get("https://api.hunter.io/v2/domain-search",
                         params={"domain": domain, "api_key": key, "limit": limit}, timeout=15)
        data = resp.json()
        contacts = [{"email": e.get("value"), "name": f"{e.get('first_name','')} {e.get('last_name','')}".strip(),
                     "position": e.get("position"), "confidence": e.get("confidence")}
                    for e in data.get("data",{}).get("emails",[])]
        emails = [c["email"] for c in contacts if c["email"]]
        return {"domain": domain, "emails": emails, "contacts": contacts, "count": len(emails), "tool": "hunter", "error": None}
    except Exception as e:
        return {"domain": domain, "emails": [], "count": 0, "tool": "hunter", "error": str(e)}
