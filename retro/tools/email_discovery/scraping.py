"""[09] Email Discovery — MAIN: website scraping + regex"""
import re

try:
    import httpx
    _HTTPX_AVAILABLE = True
except ImportError:
    _HTTPX_AVAILABLE = False

_EMAIL = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_BAD_EXT = {".png",".jpg",".svg",".gif",".woff",".ttf",".eot",".css",".js"}
_CONTACT_PATHS = ["/contact","/contact-us","/kontak","/tentang-kami","/about","/about-us","/team"]
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; RETRO/0.1)"}


def fetch(base_url: str, timeout: int = 15) -> dict:
    """Scrape halaman contact/about untuk temukan email address."""
    if not _HTTPX_AVAILABLE:
        return {"base_url": base_url, "emails": [], "count": 0, "tool": "scraping", "error": "httpx not installed"}
    try:
        if not base_url.startswith("http"):
            base_url = "https://" + base_url
        base_url = base_url.rstrip("/")
        found = set()
        checked = []

        with httpx.Client(timeout=timeout, follow_redirects=True, verify=False, headers=_HEADERS) as client:
            for path in [""] + _CONTACT_PATHS[:4]:
                try:
                    resp = client.get(base_url + path)
                    if resp.status_code == 200:
                        emails = [e for e in _EMAIL.findall(resp.text) if not any(e.endswith(x) for x in _BAD_EXT)]
                        found.update(emails)
                        checked.append(base_url + path)
                        if found:
                            break
                except Exception:
                    continue

        emails = sorted(found)[:10]
        return {"base_url": base_url, "emails": emails, "count": len(emails), "pages_checked": checked, "tool": "scraping", "error": None}
    except Exception as e:
        return {"base_url": base_url, "emails": [], "count": 0, "tool": "scraping", "error": str(e)}
