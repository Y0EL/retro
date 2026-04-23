"""[03] PDF Input — ALT2: pytesseract OCR (untuk PDF scan / gambar)"""


def fetch(path: str, max_pages: int = 20, lang: str = "ind+eng") -> dict:
    """pytesseract OCR. Gunakan untuk PDF yang berisi scan/foto, bukan teks selectable."""
    try:
        import pytesseract
        from pdf2image import convert_from_path
        images = convert_from_path(path, dpi=200, last_page=max_pages)
        parts = []
        for i, img in enumerate(images):
            parts.append(f"--- Hal {i+1} ---\n{pytesseract.image_to_string(img, lang=lang)}")
        full_text = "\n".join(parts)
        return {"path": path, "text": full_text, "char_count": len(full_text), "pages_ocr": len(images), "tool": "pytesseract", "error": None}
    except ImportError:
        return {"path": path, "text": "", "char_count": 0, "tool": "pytesseract", "error": "pytesseract/pdf2image not installed"}
    except Exception as e:
        return {"path": path, "text": "", "char_count": 0, "tool": "pytesseract", "error": str(e)}
