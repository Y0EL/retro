"""
RETRO Tool Registry — 19 kategori × 3 tool = 57 implementations
"""
import importlib.util as _ilu
from pathlib import Path as _Path

_base = _Path(__file__).parent

def _load(folder: str):
    spec = _ilu.spec_from_file_location(f"retro.tools.{folder}", _base / folder / "__init__.py")
    mod = _ilu.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

_rss          = _load("rss")
_crawling     = _load("crawling")
_pdf_input    = _load("pdf_input")
_extraction   = _load("extraction")
_vector_db    = _load("vector_db")
_storage      = _load("storage")
_llm          = _load("llm")
_scheduler    = _load("scheduler")
_email_disc   = _load("email_discovery")
_pdf_output   = _load("pdf_output")
_email_send   = _load("email_sending")
_push_notify  = _load("push_notify")
_osint        = _load("osint")
_language     = _load("language")
_structured   = _load("structured_output")
_graph_db     = _load("graph_db")
_data_quality = _load("data_quality")
_validation   = _load("validation")
_logging      = _load("observability")

# ── Public API ──────────────────────────────────────────────────────────────
fetch_news               = _rss.fetch_news
smart_fetch              = _crawling.smart_fetch
parse_text               = _crawling.parse_text
extract_pdf              = _pdf_input.extract_pdf
extract_entities         = _extraction.extract_entities
vector_upsert            = _vector_db.vector_upsert
vector_search            = _vector_db.vector_search
save_pipeline_results    = _storage.save_pipeline_results
init_db                  = _storage.init_db
llm_complete             = _llm.llm_complete
start_schedule           = _scheduler.start_schedule
discover_emails          = _email_disc.discover_emails
render_outbound_pdf      = _pdf_output.render_outbound_pdf
render_internal_pdf      = _pdf_output.render_internal_pdf
send_email               = _email_send.send_email
send_notification        = _push_notify.send_notification
domain_intelligence      = _osint.domain_intelligence
detect_language          = _language.detect_language
extract_structured       = _structured.extract_structured
graph_add_company        = _graph_db.graph_add_company
graph_add_relation       = _graph_db.graph_add_relation
graph_save               = _graph_db.graph_save
with_retry               = _data_quality.with_retry
safe_call                = _data_quality.safe_call
deduplicate              = _data_quality.deduplicate
clean_text               = _data_quality.clean_text
validate_contact         = _validation.validate_contact
validate_email_mx        = _validation.validate_email_mx
extract_emails_from_text = _validation.extract_emails_from_text
get_logger               = _logging.get_logger
log_node_start           = _logging.log_node_start
log_node_done            = _logging.log_node_done
log_error                = _logging.log_error
log_summary              = _logging.log_summary
