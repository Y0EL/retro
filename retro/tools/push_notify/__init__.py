from . import telegram, ntfy, console

def send_notification(message: str, prefer: str = "telegram", **kwargs) -> dict:
    if prefer == "ntfy": return ntfy.send(message, **kwargs)
    if prefer == "console": return console.send(message)
    r = telegram.send(message)
    if not r["success"]: r = ntfy.send(message)
    if not r["success"]: r = console.send(message)
    return r
