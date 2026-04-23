from pathlib import Path
from . import pymupdf, pdfplumber, pytesseract

def extract_pdf(path: str, prefer: str = "pymupdf") -> dict:
    if not Path(path).exists():
        return {"path": path, "text": "", "error": "file_not_found", "tool": "none"}
    if prefer == "pdfplumber": return pdfplumber.fetch(path)
    if prefer == "pytesseract": return pytesseract.fetch(path)
    r = pymupdf.fetch(path)
    if r.get("error") and "not installed" in (r["error"] or ""):
        r = pdfplumber.fetch(path)
    return r
