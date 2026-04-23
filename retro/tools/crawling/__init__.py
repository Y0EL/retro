from . import httpx, curl_cffi, playwright
_CF = {"cloudflare", "cf-ray", "just a moment", "__cf_bm"}

def _blocked(r: dict) -> bool:
    return any(s in (r.get("html") or "").lower() for s in _CF) or r.get("status_code") in (403, 429, 503)

def smart_fetch(url: str) -> dict:
    r = httpx.fetch(url)
    if r["success"]: return r
    if _blocked(r) or r["status_code"] in (403, 429, 503):
        r = curl_cffi.fetch(url)
        if r["success"]: return r
    if not r["success"]: r = playwright.fetch(url)
    return r

def parse_text(html: str) -> str:
    return httpx.parse_text(html)
