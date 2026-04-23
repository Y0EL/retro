"""[14] Language Detection — MAIN: lingua-py (paling akurat untuk teks pendek)"""
_DETECTOR = None


def _get():
    global _DETECTOR
    if _DETECTOR is None:
        try:
            from lingua import Language, LanguageDetectorBuilder
            _DETECTOR = (LanguageDetectorBuilder.from_languages(Language.INDONESIAN, Language.ENGLISH, Language.MALAY)
                         .with_minimum_relative_distance(0.85).build())
        except ImportError:
            _DETECTOR = "unavailable"
    return _DETECTOR if _DETECTOR != "unavailable" else None


def fetch(text: str) -> str:
    """lingua-py: deteksi bahasa dengan confidence threshold 0.70. Return 'id'|'en'|'mixed'|'unknown'."""
    detector = _get()
    if not detector or not text or len(text.strip()) < 5:
        return "unknown"
    try:
        from lingua import Language
        scores = {lang: conf for lang, conf in detector.compute_language_confidence_values(text[:500])}
        indo = scores.get(Language.INDONESIAN, 0)
        en = scores.get(Language.ENGLISH, 0)
        if indo >= 0.70: return "id"
        if en >= 0.70: return "en"
        if indo > 0.25 and en > 0.25: return "mixed"
        return "id"
    except Exception:
        return "unknown"
