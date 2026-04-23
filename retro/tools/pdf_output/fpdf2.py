"""[10] PDF Output — ALT1: FPDF2 (pure Python, no system deps)"""
from datetime import datetime
from pathlib import Path


def _header(pdf, title: str, author: str, theme: str):
    if theme == "dark":
        pdf.set_fill_color(26,26,46); pdf.set_text_color(0,212,255)
    else:
        pdf.set_fill_color(0,71,171); pdf.set_text_color(255,255,255)
    pdf.rect(0,0,210,40,"F")
    pdf.set_xy(10,12); pdf.set_font("Helvetica","B",16); pdf.cell(0,8,title,ln=True)
    pdf.set_xy(10,22); pdf.set_font("Helvetica","",10)
    pdf.cell(0,6,f"Disiapkan oleh: {author}  |  {datetime.now().strftime('%d %B %Y')}")
    pdf.set_text_color(0,0,0); pdf.ln(20)


def render_outbound(data: dict, output_path: str, theme: str = "light") -> dict:
    """FPDF2 outbound proposal. Tidak butuh system libs."""
    try:
        from fpdf import FPDF
        pdf = FPDF(); pdf.set_auto_page_break(True, 20); pdf.add_page()
        target = data.get("target_company","Target")
        _header(pdf, f"Proposal Kerja Sama — {target}", data.get("author","Yoel"), theme)
        sections = data.get("sections",{})
        order = [("executive_summary","Executive Summary"),("background_our_company","Latar Belakang"),
                 ("target_company_profile",f"Profil {target}"),("collaboration_analysis","Analisis Kolaborasi"),
                 ("proposed_value","Nilai yang Ditawarkan"),("implementation_timeline","Timeline"),
                 ("next_steps","Langkah Selanjutnya"),("appendix_data","Apendiks")]
        for key, heading in order:
            content = sections.get(key,"")
            if not content: continue
            pdf.set_font("Helvetica","B",13); pdf.set_fill_color(230,240,255)
            pdf.cell(0,8,heading,ln=True,fill=True); pdf.ln(2)
            pdf.set_font("Helvetica","",10); pdf.multi_cell(0,6,str(content)); pdf.ln(5)
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        pdf.output(output_path)
        return {"success": True, "path": output_path, "tool": "fpdf2"}
    except ImportError:
        return {"success": False, "error": "fpdf2 not installed", "tool": "fpdf2"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "fpdf2"}


def render_internal(data: dict, output_path: str, theme: str = "light") -> dict:
    """FPDF2 internal report."""
    try:
        from fpdf import FPDF
        pdf = FPDF(); pdf.set_auto_page_break(True, 20); pdf.add_page()
        _header(pdf, "Laporan Intelijen Bisnis — RETRO", data.get("author","Yoel"), theme)
        synthesis = data.get("synthesis",{}); profiles = data.get("profiles",[])
        if synthesis.get("executive_summary"):
            pdf.set_font("Helvetica","B",13); pdf.cell(0,8,"Executive Summary",ln=True)
            pdf.set_font("Helvetica","",10); pdf.multi_cell(0,6,synthesis["executive_summary"]); pdf.ln(5)
        pdf.set_font("Helvetica","B",13); pdf.cell(0,8,"Profil Perusahaan (Ranked)",ln=True); pdf.ln(2)
        for i,p in enumerate(profiles,1):
            pdf.set_font("Helvetica","B",11)
            pdf.cell(0,7,f"{i}. {p.get('company_name','')} — {p.get('industry','')}",ln=True)
            pdf.set_font("Helvetica","",10)
            pdf.cell(0,6,f"   Size: {p.get('company_size','')} | Tech: {p.get('tech_maturity','')} | Score: {p.get('confidence_score',0):.2f}",ln=True)
            pdf.ln(2)
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        pdf.output(output_path)
        return {"success": True, "path": output_path, "tool": "fpdf2"}
    except ImportError:
        return {"success": False, "error": "fpdf2 not installed", "tool": "fpdf2"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "fpdf2"}
