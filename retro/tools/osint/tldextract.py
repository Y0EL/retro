"""[13] OSINT — ALT1: tldextract (domain parsing, zero network)"""
from urllib.parse import urlparse


def fetch(url: str) -> dict:
    """Parse URL menjadi komponen domain. Pure string operation, zero network."""
    try:
        import tldextract
        ext = tldextract.extract(url)
        return {"url": url, "subdomain": ext.subdomain, "domain": ext.domain, "suffix": ext.suffix,
                "registered_domain": ext.registered_domain, "fqdn": ext.fqdn, "tool": "tldextract", "error": None}
    except ImportError:
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        host = parsed.hostname or url
        parts = host.split(".")
        return {"url": url, "subdomain": ".".join(parts[:-2]) if len(parts)>2 else "",
                "domain": parts[-2] if len(parts)>=2 else host, "suffix": parts[-1] if parts else "",
                "registered_domain": ".".join(parts[-2:]) if len(parts)>=2 else host,
                "fqdn": host, "tool": "urllib", "error": None}
    except Exception as e:
        return {"url": url, "registered_domain": None, "tool": "tldextract", "error": str(e)}
