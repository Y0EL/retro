from . import weasyprint, fpdf2, plaintext

def render_outbound_pdf(data: dict, output_path: str, theme: str = "light") -> dict:
    r = weasyprint.render_outbound(data, output_path, theme)
    if not r["success"]: r = fpdf2.render_outbound(data, output_path, theme)
    if not r["success"]: r = plaintext.render_outbound(data, output_path, theme)
    return r

def render_internal_pdf(data: dict, output_path: str, theme: str = "light") -> dict:
    r = weasyprint.render_internal(data, output_path, theme)
    if not r["success"]: r = fpdf2.render_internal(data, output_path, theme)
    if not r["success"]: r = plaintext.render_internal(data, output_path, theme)
    return r
