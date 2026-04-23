from . import lingua, langdetect, heuristic

def detect_language(text: str, prefer: str = "lingua") -> str:
    if prefer == "langdetect": return langdetect.fetch(text)
    if prefer == "heuristic": return heuristic.fetch(text)
    r = lingua.fetch(text)
    if r == "unknown": r = heuristic.fetch(text)
    return r
