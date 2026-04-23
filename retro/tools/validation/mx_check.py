"""[18] Contact Validation — MAIN: dnspython MX check (verifikasi mail server)"""


def fetch(domain: str) -> dict:
    """Cek domain punya MX record → email bisa dikirim ke domain ini."""
    try:
        import dns.resolver
        answers = dns.resolver.resolve(domain, "MX", lifetime=5)
        mx = sorted([(r.preference, str(r.exchange).rstrip(".")) for r in answers], key=lambda x: x[0])
        return {"domain": domain, "has_mx": True, "mx_records": mx, "tool": "dnspython_mx", "error": None}
    except ImportError:
        return _socket_fallback(domain)
    except Exception as e:
        return {"domain": domain, "has_mx": False, "mx_records": [], "tool": "dnspython_mx", "error": str(e)}


def validate_email(email: str) -> dict:
    """Validasi email via MX check pada domainnya."""
    import re
    if not re.match(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$", email):
        return {"email": email, "valid": False, "reason": "invalid_format", "tool": "dnspython_mx"}
    domain = email.split("@")[1]
    mx = fetch(domain)
    return {"email": email, "valid": mx["has_mx"], "reason": "mx_found" if mx["has_mx"] else mx.get("error","no_mx"), "tool": "dnspython_mx"}


def _socket_fallback(domain: str) -> dict:
    try:
        import socket
        socket.gethostbyname(domain)
        return {"domain": domain, "has_mx": True, "mx_records": [], "tool": "socket", "error": None}
    except Exception as e:
        return {"domain": domain, "has_mx": False, "mx_records": [], "tool": "socket", "error": str(e)}
