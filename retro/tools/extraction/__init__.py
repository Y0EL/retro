from . import spacy, regex, indobert

def extract_entities(text: str, prefer: str = "spacy") -> dict:
    if prefer == "indobert": return indobert.fetch(text)
    if prefer == "regex": return regex.fetch(text)
    r = spacy.fetch(text)
    if r.get("error") == "no model": return regex.fetch(text)
    return r
