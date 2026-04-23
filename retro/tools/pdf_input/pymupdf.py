"""[03] PDF Input — MAIN: pymupdf4llm (Markdown-friendly text untuk LLM)"""
from pathlib import Path


def fetch(path: str, max_pages: int = 50) -> dict:
    """Konversi PDF → Markdown text. Terbaik untuk LLM consumption."""
    try:
        import pymupdf4llm
        pages = list(range(min(max_pages, 500)))
        text = pymupdf4llm.to_markdown(path, pages=pages)
        return {"path": path, "text": text, "char_count": len(text), "tool": "pymupdf4llm", "error": None}
    except ImportError:
        return {"path": path, "text": "", "char_count": 0, "tool": "pymupdf4llm", "error": "pymupdf4llm not installed"}
    except Exception as e:
        return {"path": path, "text": "", "char_count": 0, "tool": "pymupdf4llm", "error": str(e)}
