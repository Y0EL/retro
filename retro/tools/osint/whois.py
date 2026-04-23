"""[13] OSINT — ALT2: python-whois (registrar, creation date, expiry)"""


def fetch(domain: str) -> dict:
    """WHOIS lookup: registrar, tanggal buat, tanggal expired, nameserver."""
    try:
        import whois
        w = whois.whois(domain)
        creation = w.creation_date
        if isinstance(creation, list): creation = creation[0]
        expiry = w.expiration_date
        if isinstance(expiry, list): expiry = expiry[0]
        return {"domain": domain, "registrar": w.registrar, "creation_date": str(creation) if creation else None,
                "expiry_date": str(expiry) if expiry else None, "name_servers": w.name_servers,
                "org": w.org, "country": w.country, "tool": "whois", "error": None}
    except ImportError:
        return {"domain": domain, "tool": "whois", "error": "python-whois not installed"}
    except Exception as e:
        return {"domain": domain, "tool": "whois", "error": str(e)}
