from . import feedparser, httpx_rss, gdelt

def fetch_news(source: str, max_items: int = 20, prefer: str = "feedparser") -> dict:
    if prefer == "gdelt": return gdelt.fetch(source, max_items)
    if prefer == "httpx": return httpx_rss.fetch(source, max_items)
    try: return feedparser.fetch(source, max_items)
    except ImportError: return httpx_rss.fetch(source, max_items)
