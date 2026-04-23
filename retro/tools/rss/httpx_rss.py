"""[01] RSS / World Awareness — ALT1: httpx raw XML parse"""
from xml.etree import ElementTree as ET

try:
    import httpx
    _AVAILABLE = True
except ImportError:
    _AVAILABLE = False

HEADERS = {"User-Agent": "RETRO/0.1 RSS Reader"}


def fetch(feed_url: str, max_items: int = 20) -> dict:
    """Raw HTTP fetch + stdlib XML parse. Zero feedparser dependency."""
    if not _AVAILABLE:
        return {"feed_url": feed_url, "items": [], "count": 0, "tool": "httpx_xml", "error": "httpx not installed"}
    try:
        with httpx.Client(timeout=15, follow_redirects=True) as client:
            resp = client.get(feed_url, headers=HEADERS)
            resp.raise_for_status()

        root = ET.fromstring(resp.text)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        items = []

        for item in root.findall(".//item")[:max_items]:
            items.append({
                "title": item.findtext("title", ""),
                "link": item.findtext("link", ""),
                "summary": (item.findtext("description") or "")[:500],
                "published": item.findtext("pubDate", ""),
                "author": item.findtext("author", ""),
                "tags": [],
            })

        if not items:
            for entry in root.findall(".//atom:entry", ns)[:max_items]:
                link_el = entry.find("atom:link", ns)
                items.append({
                    "title": entry.findtext("atom:title", "", ns),
                    "link": link_el.get("href", "") if link_el is not None else "",
                    "summary": entry.findtext("atom:summary", "", ns)[:500],
                    "published": entry.findtext("atom:published", "", ns),
                    "author": "",
                    "tags": [],
                })

        feed_title = root.findtext(".//channel/title") or ""
        return {"feed_url": feed_url, "feed_title": feed_title, "items": items, "count": len(items), "tool": "httpx_xml", "error": None}
    except Exception as e:
        return {"feed_url": feed_url, "items": [], "count": 0, "tool": "httpx_xml", "error": str(e)}
