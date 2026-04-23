"""[04] NLP Entity Extraction — ALT2: IndoBERT NER (paling akurat untuk Bahasa Indonesia)"""
import re

_NER = None


def _get_ner():
    global _NER
    if _NER is None:
        try:
            from transformers import pipeline
            _NER = pipeline("ner", model="indobenchmark/indobert-base-p2", aggregation_strategy="simple", device=-1)
        except Exception:
            _NER = "unavailable"
    return _NER if _NER != "unavailable" else None


def fetch(text: str) -> dict:
    """IndoBERT NER. Paling akurat untuk teks Indonesia. ~2-5s, ~500MB RAM."""
    ner = _get_ner()
    if ner is None:
        return {"organizations": [], "persons": [], "locations": [], "emails": [], "phones": [], "tool": "indobert", "error": "unavailable"}

    try:
        entities = ner(text[:2000])
        orgs, persons, locs = [], [], []
        for e in entities:
            if e["score"] < 0.75:
                continue
            word = re.sub(r"\s?##", "", e["word"]).strip()
            if len(word) < 2:
                continue
            label = e["entity_group"]
            if label == "ORG" and word not in orgs:
                orgs.append(word)
            elif label in ("PER", "PERSON") and word not in persons:
                persons.append(word)
            elif label in ("LOC", "GPE") and word not in locs:
                locs.append(word)

        emails = re.findall(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
        phones = re.findall(r"(?:\+62|62|0)[0-9\-\s]{8,14}", text)

        return {
            "organizations": orgs[:10], "persons": persons[:10], "locations": locs[:10],
            "emails": list(set(emails))[:5], "phones": list(set(phones))[:5],
            "tool": "indobert", "error": None,
        }
    except Exception as e:
        return {"organizations": [], "persons": [], "locations": [], "emails": [], "phones": [], "tool": "indobert", "error": str(e)}
