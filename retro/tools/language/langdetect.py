"""[14] Language Detection — ALT1: langdetect (popular, kurang akurat teks pendek)"""


def fetch(text: str) -> str:
    """langdetect: detect bahasa dari teks. Treat ms/tl sebagai 'id' untuk konteks RETRO."""
    try:
        from langdetect import detect, DetectorFactory
        DetectorFactory.seed = 42
        lang = detect(text[:300])
        if lang == "id": return "id"
        if lang == "en": return "en"
        if lang in ("ms","tl"): return "id"
        return "unknown"
    except ImportError:
        return "unknown"
    except Exception:
        return "unknown"
