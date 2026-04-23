"""[10] PDF Output — MAIN: WeasyPrint + Jinja2 (HTML→PDF, CSS themes)"""
from datetime import datetime
from pathlib import Path

_TEMPLATES_DIR = Path(__file__).parent.parent.parent.parent / "templates"


def _jinja_env():
    from jinja2 import Environment, FileSystemLoader, select_autoescape
    return Environment(loader=FileSystemLoader(str(_TEMPLATES_DIR)), autoescape=select_autoescape(["html"]))


def render_outbound(data: dict, output_path: str, theme: str = "light") -> dict:
    """Render outbound proposal PDF via WeasyPrint."""
    try:
        from weasyprint import HTML, CSS
        env = _jinja_env()
        html = env.get_template("proposal_outbound.html.j2").render(
            theme=theme, author=data.get("author","Yoel"),
            date=data.get("date", datetime.now().strftime("%d %B %Y")),
            target_company=data.get("target_company",""), profile=data.get("company_profile",{}),
            sections=data.get("sections",{}), generated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
        )
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        HTML(string=html, base_url=str(_TEMPLATES_DIR)).write_pdf(output_path, stylesheets=[CSS(str(_TEMPLATES_DIR/"proposal.css"))])
        return {"success": True, "path": output_path, "tool": "weasyprint"}
    except ImportError:
        return {"success": False, "error": "weasyprint not installed", "tool": "weasyprint"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "weasyprint"}


def render_internal(data: dict, output_path: str, theme: str = "light") -> dict:
    """Render internal intelligence report PDF via WeasyPrint."""
    try:
        from weasyprint import HTML, CSS
        env = _jinja_env()
        html = env.get_template("proposal_internal.html.j2").render(
            theme=theme, author=data.get("author","Yoel"),
            date=data.get("date", datetime.now().strftime("%d %B %Y")),
            profiles=data.get("profiles",[]), synthesis=data.get("synthesis",{}),
            stats=data.get("stats",{}), error_log=data.get("error_log",[]),
            generated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
        )
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        HTML(string=html, base_url=str(_TEMPLATES_DIR)).write_pdf(output_path, stylesheets=[CSS(str(_TEMPLATES_DIR/"proposal.css"))])
        return {"success": True, "path": output_path, "tool": "weasyprint"}
    except ImportError:
        return {"success": False, "error": "weasyprint not installed", "tool": "weasyprint"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "weasyprint"}
