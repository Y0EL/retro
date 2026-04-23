"""[01] RSS / World Awareness — MAIN: feedparser"""
try:
    import feedparser as _fp
    _AVAILABLE = True
except ImportError:
    _AVAILABLE = False


def fetch(feed_url: str, max_items: int = 20) -> dict:
    """Parse RSS/Atom feed via feedparser. Paling lengkap, support semua format."""
    if not _AVAILABLE:
        return {"feed_url": feed_url, "items": [], "count": 0, "tool": "feedparser", "error": "feedparser not installed"}
    try:
        feed = _fp.parse(feed_url)
        items = []
        for entry in feed.entries[:max_items]:
            items.append({
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "summary": entry.get("summary", "")[:500],
                "published": entry.get("published", ""),
                "author": entry.get("author", ""),
                "tags": [t.get("term", "") for t in entry.get("tags", [])],
            })
        return {
            "feed_url": feed_url,
            "feed_title": feed.feed.get("title", ""),
            "items": items,
            "count": len(items),
            "tool": "feedparser",
            "error": None,
        }
    except Exception as e:
        return {"feed_url": feed_url, "items": [], "count": 0, "tool": "feedparser", "error": str(e)}
