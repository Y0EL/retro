"""[11] Email Sending — MAIN: Resend API (modern, developer-friendly)"""
import os


def send(to: str, subject: str, html: str, from_email: str = "", api_key: str = "") -> dict:
    """Kirim email via Resend API. Set RESEND_API_KEY + SENDER_EMAIL di .env."""
    key = api_key or os.environ.get("RESEND_API_KEY","")
    sender = from_email or os.environ.get("SENDER_EMAIL","noreply@retro.ai")
    if not key:
        return {"success": False, "error": "RESEND_API_KEY not set", "tool": "resend"}
    try:
        import resend
        resend.api_key = key
        r = resend.Emails.send({"from": sender, "to": [to], "subject": subject, "html": html})
        return {"success": True, "id": r.get("id"), "tool": "resend", "error": None}
    except ImportError:
        return {"success": False, "error": "resend not installed", "tool": "resend"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "resend"}
