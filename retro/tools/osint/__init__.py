from . import wayback, tldextract, whois

def domain_intelligence(url: str) -> dict:
    parsed = tldextract.fetch(url)
    domain = parsed.get("registered_domain") or url
    wb = wayback.fetch(domain)
    return {"url": url, "domain": domain, "parsed": parsed, "wayback": wb,
            "estimated_age_years": wb.get("estimated_age_years")}
