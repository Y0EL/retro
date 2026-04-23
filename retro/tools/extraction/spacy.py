"""[04] NLP Entity Extraction — MAIN: spaCy (xx_ent_wiki_sm multilingual)"""
import re

_NLP = None


def _get_nlp():
    global _NLP
    if _NLP is None:
        import spacy
        for model in ("xx_ent_wiki_sm", "en_core_web_sm"):
            try:
                _NLP = spacy.load(model)
                break
            except OSError:
                continue
        if _NLP is None:
            _NLP = "unavailable"
    return _NLP if _NLP != "unavailable" else None


def fetch(text: str) -> dict:
    """spaCy multilingual NER: ORG, PERSON, LOC + regex email/phone."""
    nlp = _get_nlp()
    if nlp is None:
        return {"organizations": [], "persons": [], "locations": [], "emails": [], "phones": [], "tool": "spacy_unavailable", "error": "no model"}

    try:
        doc = nlp(text[:5000])
        orgs, persons, locs = [], [], []
        for ent in doc.ents:
            w = ent.text.strip()
            if len(w) < 2:
                continue
            if ent.label_ in ("ORG", "PRODUCT", "WORK_OF_ART") and w not in orgs:
                orgs.append(w)
            elif ent.label_ in ("PERSON", "PER") and w not in persons:
                persons.append(w)
            elif ent.label_ in ("GPE", "LOC", "FAC") and w not in locs:
                locs.append(w)

        emails = re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
        phones = re.findall(r"(?:\+62|62|0)[0-9\-\s]{8,14}", text)

        return {
            "organizations": orgs[:10], "persons": persons[:10], "locations": locs[:10],
            "emails": list(set(emails))[:5], "phones": list(set(phones))[:5],
            "tool": "spacy", "error": None,
        }
    except Exception as e:
        return {"organizations": [], "persons": [], "locations": [], "emails": [], "phones": [], "tool": "spacy", "error": str(e)}
