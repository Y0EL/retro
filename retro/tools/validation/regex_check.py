"""[18] Contact Validation — ALT1: regex format check (zero dependency)"""
import re

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


def validate_email(email: str) -> dict:
    """Format-only email validation. Tidak cek MX, zero network."""
    valid = bool(_EMAIL_RE.match(email.strip()))
    return {"email": email, "valid": valid, "reason": "format_ok" if valid else "invalid_format", "tool": "regex"}


def extract_emails(text: str) -> list[str]:
    """Extract semua email address dari raw text."""
    return list(set(re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)))


def fetch(domain: str) -> dict:
    """Alias: regex tidak bisa cek domain, return unknown."""
    return {"domain": domain, "has_mx": None, "mx_records": [], "tool": "regex", "error": "no_dns_check"}
