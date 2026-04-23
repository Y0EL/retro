"""[06] Relational DB — ALT1: JSON file (zero dependency fallback)"""
import json
from datetime import datetime
from pathlib import Path


def save(data: dict, output_dir: str = "./output") -> dict:
    """Simpan seluruh pipeline result ke JSON file."""
    try:
        Path(output_dir).mkdir(parents=True, exist_ok=True)
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        path = f"{output_dir}/retro_run_{ts}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
        return {"success": True, "path": path, "tool": "json_file"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "json_file"}


def load(path: str) -> dict:
    """Load pipeline result dari JSON file."""
    try:
        with open(path, encoding="utf-8") as f:
            return {"success": True, "data": json.load(f), "tool": "json_file"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "json_file"}
