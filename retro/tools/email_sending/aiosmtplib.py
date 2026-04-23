"""[11] Email Sending — ALT1: aiosmtplib (async SMTP, Gmail/custom SMTP)"""
import asyncio
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


async def _send_async(to: str, subject: str, html: str, smtp_host: str, smtp_port: int, username: str, password: str, sender: str) -> dict:
    try:
        import aiosmtplib
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject; msg["From"] = sender; msg["To"] = to
        msg.attach(MIMEText(html, "html", "utf-8"))
        await aiosmtplib.send(msg, hostname=smtp_host, port=smtp_port, username=username, password=password, use_tls=smtp_port==465, start_tls=smtp_port==587)
        return {"success": True, "tool": "aiosmtplib", "error": None}
    except ImportError:
        return {"success": False, "error": "aiosmtplib not installed", "tool": "aiosmtplib"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "aiosmtplib"}


def send(to: str, subject: str, html: str, from_email: str = "") -> dict:
    """SMTP async send. Set SMTP_HOST/PORT/USER/PASS di .env."""
    return asyncio.run(_send_async(
        to, subject, html,
        smtp_host=os.environ.get("SMTP_HOST","smtp.gmail.com"),
        smtp_port=int(os.environ.get("SMTP_PORT","587")),
        username=os.environ.get("SMTP_USER",""),
        password=os.environ.get("SMTP_PASS",""),
        sender=from_email or os.environ.get("SENDER_EMAIL","noreply@retro.ai"),
    ))
