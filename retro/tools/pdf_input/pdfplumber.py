"""[03] PDF Input — ALT1: pdfplumber (akurat untuk tabel & multi-column)"""


def fetch(path: str, max_pages: int = 50) -> dict:
    """pdfplumber: extract text + tabel per halaman. Akurat untuk layout kompleks."""
    try:
        import pdfplumber
        parts = []
        tables_found = 0
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages[:max_pages]:
                text = page.extract_text() or ""
                if text:
                    parts.append(text)
                for table in page.extract_tables():
                    tables_found += 1
                    for row in table:
                        parts.append("[TABLE] " + " | ".join(str(c or "") for c in row))
        full_text = "\n".join(parts)
        return {"path": path, "text": full_text, "char_count": len(full_text), "tables_found": tables_found, "tool": "pdfplumber", "error": None}
    except ImportError:
        return {"path": path, "text": "", "char_count": 0, "tool": "pdfplumber", "error": "pdfplumber not installed"}
    except Exception as e:
        return {"path": path, "text": "", "char_count": 0, "tool": "pdfplumber", "error": str(e)}
