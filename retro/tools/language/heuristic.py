"""[14] Language Detection — ALT2: keyword heuristic (zero dependency)"""
_INDO = {"yang","dan","di","dengan","untuk","dari","ini","kami","adalah","dalam","pada",
         "tidak","juga","telah","akan","serta","atas","pt","cv","tbk","bergerak","perusahaan","layanan"}
_EN = {"the","and","for","with","our","company","services","products","we","are","is","that","from","have","this","been"}


def fetch(text: str) -> str:
    """Keyword counting heuristic. Zero dependency fallback."""
    if not text: return "unknown"
    words = set(text.lower().split()[:100])
    id_hits = len(words & _INDO)
    en_hits = len(words & _EN)
    if id_hits > en_hits * 1.5: return "id"
    if en_hits > id_hits * 1.5: return "en"
    if id_hits > 0 and en_hits > 0: return "mixed"
    return "id"
