"""[11] Email Sending — ALT2: save to file (zero dependency, dev mode)"""
import json
from datetime import datetime
from pathlib import Path


def send(to: str, subject: str, html: str, from_email: str = "", output_dir: str = "./output/emails") -> dict:
    """Simpan email ke file HTML alih-alih kirim. Untuk development/testing."""
    try:
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_to = to.replace("@","_at_").replace(".","_")
        path = f"{output_dir}/email_{safe_to}_{ts}.html"

        content = f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>{subject}</title></head>
<body>
<div style="background:#f0f0f0;padding:10px;font-family:monospace;font-size:12px;">
  <strong>TO:</strong> {to}<br>
  <strong>FROM:</strong> {from_email or 'noreply@retro.ai'}<br>
  <strong>SUBJECT:</strong> {subject}<br>
  <strong>SAVED AT:</strong> {datetime.now().isoformat()}
</div>
<hr>
{html}
</body></html>"""

        Path(path).write_text(content, encoding="utf-8")
        return {"success": True, "path": path, "tool": "save_to_file", "error": None}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "save_to_file"}
