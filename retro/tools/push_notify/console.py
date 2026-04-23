"""[12] Push Notification — ALT2: print ke console (zero dependency)"""
from datetime import datetime


def send(message: str, **kwargs) -> dict:
    """Print notifikasi ke console. Zero dependency fallback."""
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"\n[NOTIFY {ts}] {message}\n")
    return {"success": True, "tool": "print", "error": None}
