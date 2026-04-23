"""[12] Push Notification — MAIN: python-telegram-bot"""
import os


def send(message: str, bot_token: str = "", chat_id: str = "") -> dict:
    """Kirim notifikasi ke Telegram. Set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID di .env."""
    token = bot_token or os.environ.get("TELEGRAM_BOT_TOKEN","")
    cid = chat_id or os.environ.get("TELEGRAM_CHAT_ID","")
    if not token or not cid:
        return {"success": False, "error": "TELEGRAM_BOT_TOKEN/CHAT_ID not set", "tool": "telegram"}
    try:
        import httpx
        resp = httpx.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": cid, "text": message, "parse_mode": "HTML"},
            timeout=10,
        )
        data = resp.json()
        return {"success": data.get("ok", False), "message_id": data.get("result",{}).get("message_id"), "tool": "telegram", "error": None if data.get("ok") else data.get("description")}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "telegram"}
