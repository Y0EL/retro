"""[12] Push Notification — ALT1: Ntfy (self-hostable, no account needed)"""
import os

try:
    import httpx
    _AVAILABLE = True
except ImportError:
    _AVAILABLE = False


def send(message: str, topic: str = "", server: str = "") -> dict:
    """Kirim notifikasi via Ntfy. Default server: ntfy.sh (gratis, public)."""
    topic = topic or os.environ.get("NTFY_TOPIC","retro-pipeline")
    server = server or os.environ.get("NTFY_SERVER","https://ntfy.sh")
    if not _AVAILABLE:
        return {"success": False, "tool": "ntfy", "error": "httpx not installed"}
    try:
        resp = httpx.post(
            f"{server}/{topic}",
            content=message.encode("utf-8"),
            headers={"Title": "RETRO Pipeline", "Priority": "default", "Tags": "robot"},
            timeout=10,
        )
        return {"success": resp.status_code == 200, "url": f"{server}/{topic}", "tool": "ntfy", "error": None if resp.status_code==200 else f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "ntfy"}
