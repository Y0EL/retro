"""[10] PDF Output — ALT2: plain .txt (zero dependency, last resort)"""
from datetime import datetime
from pathlib import Path


def render_outbound(data: dict, output_path: str, theme: str = "light") -> dict:
    """Simpan sebagai plain text. Zero dependency."""
    try:
        output_path = output_path.replace(".pdf", ".txt")
        sections = data.get("sections", {})
        lines = ["="*70, f"PROPOSAL KERJA SAMA — {data.get('target_company','')}", f"Disiapkan oleh: {data.get('author','Yoel')}", f"Tanggal: {datetime.now().strftime('%d %B %Y')}", "="*70, ""]
        for key, val in sections.items():
            lines += [f"\n--- {key.upper().replace('_',' ')} ---", str(val), ""]
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        Path(output_path).write_text("\n".join(lines), encoding="utf-8")
        return {"success": True, "path": output_path, "tool": "txt"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "txt"}


def render_internal(data: dict, output_path: str, theme: str = "light") -> dict:
    try:
        output_path = output_path.replace(".pdf", ".txt")
        profiles = data.get("profiles", [])
        lines = ["="*70, "LAPORAN INTELIJEN BISNIS — RETRO", f"Tanggal: {datetime.now().strftime('%d %B %Y')}", "="*70, ""]
        synthesis = data.get("synthesis", {})
        if synthesis.get("executive_summary"):
            lines += ["--- EXECUTIVE SUMMARY ---", synthesis["executive_summary"], ""]
        for i, p in enumerate(profiles, 1):
            lines.append(f"{i}. {p.get('company_name','')} | {p.get('industry','')} | score={p.get('confidence_score',0):.2f}")
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        Path(output_path).write_text("\n".join(lines), encoding="utf-8")
        return {"success": True, "path": output_path, "tool": "txt"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "txt"}
