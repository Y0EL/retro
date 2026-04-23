"""[09] Email Discovery — ALT2: Apollo.io API (50 exports/month free)"""
import os

try:
    import httpx
    _AVAILABLE = True
except ImportError:
    _AVAILABLE = False


def fetch(domain: str, api_key: str = "", limit: int = 10) -> dict:
    """Apollo.io people search by domain. Set APOLLO_API_KEY di .env."""
    key = api_key or os.environ.get("APOLLO_API_KEY", "")
    if not key:
        return {"domain": domain, "emails": [], "count": 0, "tool": "apollo", "error": "APOLLO_API_KEY not set"}
    if not _AVAILABLE:
        return {"domain": domain, "emails": [], "count": 0, "tool": "apollo", "error": "httpx not installed"}
    try:
        resp = httpx.post("https://api.apollo.io/v1/mixed_people/search",
                          headers={"X-Api-Key": key, "Content-Type": "application/json"},
                          json={"q_organization_domains": domain, "per_page": limit}, timeout=20)
        people = resp.json().get("people", [])
        contacts = [{"email": p.get("email"), "name": f"{p.get('first_name','')} {p.get('last_name','')}".strip(),
                     "title": p.get("title"), "linkedin": p.get("linkedin_url")}
                    for p in people if p.get("email")]
        emails = [c["email"] for c in contacts]
        return {"domain": domain, "emails": emails, "contacts": contacts, "count": len(emails), "tool": "apollo", "error": None}
    except Exception as e:
        return {"domain": domain, "emails": [], "count": 0, "tool": "apollo", "error": str(e)}
