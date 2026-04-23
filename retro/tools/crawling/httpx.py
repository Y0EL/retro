"""[02] Web Crawling — MAIN: httpx + BeautifulSoup4"""
import re

try:
    import httpx
    _HTTPX_AVAILABLE = True
except ImportError:
    _HTTPX_AVAILABLE = False

try:
    from bs4 import BeautifulSoup
    _BS4_AVAILABLE = True
except ImportError:
    _BS4_AVAILABLE = False

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def fetch(url: str, timeout: int = 20) -> dict:
    """httpx GET + status check. Cepat, standard, support redirect."""
    if not _HTTPX_AVAILABLE:
        return {"html": "", "status_code": 0, "tool": "httpx", "error": "httpx not installed", "success": False}
    try:
        with httpx.Client(headers=HEADERS, timeout=timeout, follow_redirects=True, verify=False) as client:
            resp = client.get(url)
            success = resp.status_code == 200 and len(resp.text) > 100
            return {
                "html": resp.text,
                "status_code": resp.status_code,
                "tool": "httpx",
                "error": None if success else f"HTTP {resp.status_code}",
                "success": success,
            }
    except Exception as e:
        return {"html": "", "status_code": 0, "tool": "httpx", "error": str(e), "success": False}


def parse_text(html: str, max_chars: int = 15000) -> str:
    """HTML → clean plain text via BeautifulSoup."""
    if not html:
        return ""
    if not _BS4_AVAILABLE:
        return html[:max_chars]
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()
    text = soup.get_text(separator=" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()[:max_chars]
