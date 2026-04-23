"""[04] NLP Entity Extraction — ALT1: regex patterns (zero dependency)"""
import re

_ORG = re.compile(r"\b(?:PT|CV|UD|Tbk|Perseroan|Koperasi|Yayasan|Kementerian|Badan|Lembaga)\.?\s+[A-Z][A-Za-z\s&]+(?:Tbk\.?|Indonesia|Group|Nusantara)?\b")
_EMAIL = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_PHONE = re.compile(r"(?:\+62|62|0)[0-9\-\s]{8,14}")


def fetch(text: str) -> dict:
    """Pure regex extraction. Kenali pola legal Indonesia (PT/CV/Tbk), email, phone."""
    orgs = list(dict.fromkeys(o.strip() for o in _ORG.findall(text)))[:10]
    emails = list(set(_EMAIL.findall(text)))[:5]
    phones = list(set(_PHONE.findall(text)))[:5]
    return {
        "organizations": orgs, "persons": [], "locations": [],
        "emails": emails, "phones": phones,
        "tool": "regex", "error": None,
    }
