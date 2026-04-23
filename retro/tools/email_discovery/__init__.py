from . import scraping, hunter, apollo

def discover_emails(url_or_domain: str, prefer: str = "scraping") -> dict:
    domain = url_or_domain.replace("https://","").replace("http://","").split("/")[0]
    if prefer == "hunter": return hunter.fetch(domain)
    if prefer == "apollo": return apollo.fetch(domain)
    return scraping.fetch(url_or_domain)
