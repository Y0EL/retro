"""[18] Contact Validation — ALT2: DNS A-record check (cek domain aktif)"""


def fetch(domain: str) -> dict:
    """Cek domain aktif via A-record. Lebih ringan dari MX check."""
    try:
        import dns.resolver
        answers = dns.resolver.resolve(domain, "A", lifetime=5)
        ips = [str(r) for r in answers]
        return {"domain": domain, "has_mx": len(ips) > 0, "a_records": ips, "mx_records": [], "tool": "dnspython_a", "error": None}
    except ImportError:
        try:
            import socket
            ip = socket.gethostbyname(domain)
            return {"domain": domain, "has_mx": True, "a_records": [ip], "mx_records": [], "tool": "socket", "error": None}
        except Exception as e:
            return {"domain": domain, "has_mx": False, "a_records": [], "mx_records": [], "tool": "socket", "error": str(e)}
    except Exception as e:
        return {"domain": domain, "has_mx": False, "a_records": [], "mx_records": [], "tool": "dnspython_a", "error": str(e)}
