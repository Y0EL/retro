"""[02] Web Crawling — ALT1: curl_cffi (Cloudflare bypass)"""


def fetch(url: str, timeout: int = 30) -> dict:
    """curl_cffi impersonate Chrome120 TLS fingerprint — bypass Cloudflare/anti-bot."""
    try:
        from curl_cffi import requests as cf
        resp = cf.get(url, impersonate="chrome120", timeout=timeout, allow_redirects=True)
        success = resp.status_code == 200 and len(resp.text) > 100
        return {
            "html": resp.text if success else "",
            "status_code": resp.status_code,
            "tool": "curl_cffi",
            "error": None if success else f"HTTP {resp.status_code}",
            "success": success,
        }
    except ImportError:
        return {"html": "", "status_code": 0, "tool": "curl_cffi", "error": "curl_cffi not installed", "success": False}
    except Exception as e:
        return {"html": "", "status_code": 0, "tool": "curl_cffi", "error": str(e), "success": False}
