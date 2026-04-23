"""Run this once to rewrite all 19 subfolder __init__.py files after rename."""
import os

os.chdir(os.path.dirname(__file__))

FILES = {

"rss/__init__.py": """\
from . import feedparser, httpx_rss, gdelt

def fetch_news(source: str, max_items: int = 20, prefer: str = "feedparser") -> dict:
    if prefer == "gdelt": return gdelt.fetch(source, max_items)
    if prefer == "httpx": return httpx_rss.fetch(source, max_items)
    try: return feedparser.fetch(source, max_items)
    except ImportError: return httpx_rss.fetch(source, max_items)
""",

"crawling/__init__.py": """\
from . import httpx, curl_cffi, playwright
_CF = {"cloudflare", "cf-ray", "just a moment", "__cf_bm"}

def _blocked(r: dict) -> bool:
    return any(s in (r.get("html") or "").lower() for s in _CF) or r.get("status_code") in (403, 429, 503)

def smart_fetch(url: str) -> dict:
    r = httpx.fetch(url)
    if r["success"]: return r
    if _blocked(r) or r["status_code"] in (403, 429, 503):
        r = curl_cffi.fetch(url)
        if r["success"]: return r
    if not r["success"]: r = playwright.fetch(url)
    return r

def parse_text(html: str) -> str:
    return httpx.parse_text(html)
""",

"pdf_input/__init__.py": """\
from pathlib import Path
from . import pymupdf, pdfplumber, pytesseract

def extract_pdf(path: str, prefer: str = "pymupdf") -> dict:
    if not Path(path).exists():
        return {"path": path, "text": "", "error": "file_not_found", "tool": "none"}
    if prefer == "pdfplumber": return pdfplumber.fetch(path)
    if prefer == "pytesseract": return pytesseract.fetch(path)
    r = pymupdf.fetch(path)
    if r.get("error") and "not installed" in (r["error"] or ""):
        r = pdfplumber.fetch(path)
    return r
""",

"extraction/__init__.py": """\
from . import spacy, regex, indobert

def extract_entities(text: str, prefer: str = "spacy") -> dict:
    if prefer == "indobert": return indobert.fetch(text)
    if prefer == "regex": return regex.fetch(text)
    r = spacy.fetch(text)
    if r.get("error") == "no model": return regex.fetch(text)
    return r
""",

"vector_db/__init__.py": """\
from . import chromadb, faiss, sqlite_fts

def vector_upsert(collection: str, documents: list, prefer: str = "chromadb") -> dict:
    if prefer == "faiss": return faiss.upsert(collection, documents)
    if prefer == "fts5": return sqlite_fts.upsert(collection, documents)
    r = chromadb.upsert(collection, documents)
    if not r["success"]: r = sqlite_fts.upsert(collection, documents)
    return r

def vector_search(collection: str, query: str, n: int = 5, prefer: str = "chromadb") -> dict:
    if prefer == "faiss": return faiss.search(collection, query, n)
    if prefer == "fts5": return sqlite_fts.search(collection, query, n)
    r = chromadb.search(collection, query, n)
    if r.get("error") and "not installed" in (r["error"] or ""):
        r = sqlite_fts.search(collection, query, n)
    return r
""",

"storage/__init__.py": """\
from . import sqlite, json_file, postgresql

def init_db(db_path: str = "./retro.db") -> bool:
    return sqlite.init(db_path)

def save_pipeline_results(data: dict, db_path: str = "./retro.db", prefer: str = "sqlite") -> dict:
    if prefer == "json": return json_file.save(data)
    if prefer == "postgres": return postgresql.save(data)
    r = sqlite.save(data, db_path)
    if not r["success"]: r = json_file.save(data)
    return r
""",

"llm/__init__.py": """\
from . import langchain_groq, litellm, groq_sdk

def llm_complete(messages: list, model=None, temperature: float = 0.3, max_tokens: int = 2048, prefer: str = "langchain") -> dict:
    if prefer == "litellm": return litellm.complete(messages, model, temperature, max_tokens)
    if prefer == "groq": return groq_sdk.complete(messages, model, temperature, max_tokens)
    r = langchain_groq.complete(messages, model, temperature, max_tokens)
    if r.get("error") and "not installed" in (r["error"] or ""):
        r = groq_sdk.complete(messages, model, temperature, max_tokens)
    return r
""",

"scheduler/__init__.py": """\
from typing import Callable
from . import apscheduler, schedule_lib, manual

def start_schedule(func: Callable, cron: str = "0 8 * * 1-5", prefer: str = "apscheduler", **kwargs) -> dict:
    if prefer == "schedule":
        h, m = cron.split()[1], cron.split()[0]
        return schedule_lib.schedule_daily(func, at=f"{int(h):02d}:{int(m):02d}")
    if prefer == "manual":
        import threading
        t = threading.Thread(target=manual.run, args=(func,), kwargs=kwargs, daemon=True)
        t.start()
        return {"success": True, "tool": "manual", "thread": t.ident}
    r = apscheduler.schedule_cron(func, cron, **kwargs)
    if not r["success"]: return schedule_lib.schedule_daily(func)
    return r
""",

"email_discovery/__init__.py": """\
from . import scraping, hunter, apollo

def discover_emails(url_or_domain: str, prefer: str = "scraping") -> dict:
    domain = url_or_domain.replace("https://","").replace("http://","").split("/")[0]
    if prefer == "hunter": return hunter.fetch(domain)
    if prefer == "apollo": return apollo.fetch(domain)
    return scraping.fetch(url_or_domain)
""",

"pdf_output/__init__.py": """\
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
""",

"email_sending/__init__.py": """\
from . import resend, aiosmtplib, save_to_file

def send_email(to: str, subject: str, html: str, from_email: str = "", prefer: str = "resend") -> dict:
    if prefer == "smtp": return aiosmtplib.send(to, subject, html, from_email)
    if prefer == "file": return save_to_file.send(to, subject, html, from_email)
    r = resend.send(to, subject, html, from_email)
    if not r["success"] and "not set" in (r["error"] or ""):
        r = save_to_file.send(to, subject, html, from_email)
    return r
""",

"push_notify/__init__.py": """\
from . import telegram, ntfy, console

def send_notification(message: str, prefer: str = "telegram", **kwargs) -> dict:
    if prefer == "ntfy": return ntfy.send(message, **kwargs)
    if prefer == "console": return console.send(message)
    r = telegram.send(message)
    if not r["success"]: r = ntfy.send(message)
    if not r["success"]: r = console.send(message)
    return r
""",

"osint/__init__.py": """\
from . import wayback, tldextract, whois

def domain_intelligence(url: str) -> dict:
    parsed = tldextract.fetch(url)
    domain = parsed.get("registered_domain") or url
    wb = wayback.fetch(domain)
    return {"url": url, "domain": domain, "parsed": parsed, "wayback": wb,
            "estimated_age_years": wb.get("estimated_age_years")}
""",

"language/__init__.py": """\
from . import lingua, langdetect, heuristic

def detect_language(text: str, prefer: str = "lingua") -> str:
    if prefer == "langdetect": return langdetect.fetch(text)
    if prefer == "heuristic": return heuristic.fetch(text)
    r = lingua.fetch(text)
    if r == "unknown": r = heuristic.fetch(text)
    return r
""",

"structured_output/__init__.py": """\
from . import instructor, json_parse, outlines

def extract_structured(model_class, messages: list, llm_model=None, prefer: str = "instructor"):
    if prefer == "json": return json_parse.llm_then_parse(model_class, messages, llm_model)
    r = instructor.extract(model_class, messages, llm_model)
    if r is None: r = json_parse.llm_then_parse(model_class, messages, llm_model)
    return r
""",

"graph_db/__init__.py": """\
from . import networkx, adjacency, neo4j

def graph_add_company(graph_name: str, company: str, attrs: dict = {}, prefer: str = "networkx") -> dict:
    if prefer == "adjacency": return adjacency.add_company(graph_name, company, attrs)
    r = networkx.add_company(graph_name, company, attrs)
    if not r["success"]: r = adjacency.add_company(graph_name, company, attrs)
    return r

def graph_add_relation(graph_name: str, src: str, dst: str, relation: str = "partner", prefer: str = "networkx") -> dict:
    if prefer == "adjacency": return adjacency.add_relation(graph_name, src, dst, relation)
    r = networkx.add_relation(graph_name, src, dst, relation)
    if not r["success"]: r = adjacency.add_relation(graph_name, src, dst, relation)
    return r

def graph_save(graph_name: str, path: str = "./output/graph.json", prefer: str = "networkx") -> dict:
    if prefer == "adjacency": return adjacency.save_graph(graph_name, path)
    r = networkx.save_graph(graph_name, path)
    if not r["success"]: r = adjacency.save_graph(graph_name, path)
    return r
""",

"data_quality/__init__.py": """\
from . import tenacity, pandera, pydantic_val

with_retry          = tenacity.with_retry
safe_call           = tenacity.safe_call
deduplicate         = tenacity.deduplicate
clean_text          = tenacity.clean_text
validate_dict_list  = pandera.validate_dict_list
validate_with_model = pydantic_val.validate_with_model
""",

"validation/__init__.py": """\
from . import mx_check, regex_check, dns_a_check

validate_email_mx        = mx_check.validate_email
validate_email_regex     = regex_check.validate_email
extract_emails_from_text = regex_check.extract_emails

def validate_contact(email=None, domain=None) -> dict:
    result = {}
    if email:
        try:    result["email_check"] = mx_check.validate_email(email)
        except: result["email_check"] = regex_check.validate_email(email)
    if domain:
        result["domain_check"] = mx_check.fetch(domain)
    return result
""",

"observability/__init__.py": """\
from . import structlog, loguru, stdlib

def get_logger(name: str = "retro", prefer: str = "structlog"):
    if prefer == "loguru": return loguru.get_logger()
    if prefer == "stdlib": return stdlib.get_logger(name)
    return structlog.get_logger(name)

def log_node_start(node: str, **kw): get_logger("retro.pipeline").info("node_start", node=node, **kw)
def log_node_done(node: str, **kw):  get_logger("retro.pipeline").info("node_done",  node=node, **kw)
def log_error(node: str, error: str, **kw): get_logger("retro.pipeline").error("node_error", node=node, error=error, **kw)
def log_summary(stats: dict): get_logger("retro.pipeline").info("pipeline_complete", **stats)
""",

}

for path, content in FILES.items():
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  OK  {path}")

print(f"\nDone. {len(FILES)} files updated.")
