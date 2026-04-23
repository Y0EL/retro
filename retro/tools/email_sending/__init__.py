from . import resend, aiosmtplib, save_to_file

def send_email(to: str, subject: str, html: str, from_email: str = "", prefer: str = "resend") -> dict:
    if prefer == "smtp": return aiosmtplib.send(to, subject, html, from_email)
    if prefer == "file": return save_to_file.send(to, subject, html, from_email)
    r = resend.send(to, subject, html, from_email)
    if not r["success"] and "not set" in (r["error"] or ""):
        r = save_to_file.send(to, subject, html, from_email)
    return r
