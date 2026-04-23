"""
LangGraph node functions for the RETRO pipeline.
Each node receives PipelineState and returns a partial state update.
"""
import asyncio
import json
from datetime import datetime
from pathlib import Path

from retro.config import get_settings
from retro.state import PipelineState
from retro.tools import (
    smart_fetch, parse_text,
    extract_entities, detect_language,
    log_node_start, log_node_done, log_error, get_logger,
    render_outbound_pdf, render_internal_pdf,
    save_pipeline_results, init_db,
    domain_intelligence, validate_contact,
    log_summary,
)

log = get_logger("retro.nodes")


# ─── Helpers ──────────────────────────────────────────────────────────────

def _groq_client():
    import groq
    return groq.Groq(api_key=get_settings().groq_api_key)


def _instructor_client():
    import groq, instructor
    return instructor.from_groq(groq.Groq(api_key=get_settings().groq_api_key), mode=instructor.Mode.JSON)


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


# ─── Node 1: load_input ───────────────────────────────────────────────────

def load_input_node(state: PipelineState) -> dict:
    log_node_start("load_input")
    cfg = get_settings()
    companies = state.get("companies_input", [])
    if companies:
        log_node_done("load_input", count=len(companies), source="state")
        return {}
    try:
        if cfg.input_file.endswith(".csv"):
            import csv
            with open(cfg.input_file, newline="", encoding="utf-8-sig") as f:
                companies = list(csv.DictReader(f))
        else:
            import pandas as pd
            companies = pd.read_excel(cfg.input_file).to_dict("records")
    except Exception as e:
        log_error("load_input", str(e))
        return {"error_log": [f"load_input: {e}"]}
    log_node_done("load_input", count=len(companies))
    return {
        "companies_input": companies,
        "run_metadata": {"start_time": _now_iso(), "author": cfg.proposal_author, "theme": cfg.proposal_theme, "input_file": cfg.input_file},
    }


# ─── Node 2: crawl ────────────────────────────────────────────────────────

def crawl_node(state: PipelineState) -> dict:
    log_node_start("crawl", companies=len(state.get("companies_input", [])))
    results, errors = [], []

    for co in state.get("companies_input", []):
        name = co.get("name") or co.get("company_name") or co.get("Company Name", "")
        url  = co.get("url") or co.get("website") or co.get("URL") or co.get("Website", "")
        if not url:
            errors.append(f"crawl: no URL for {name}")
            results.append({"name": name, "url": "", "text": "", "success": False, "status_code": 0, "tool_used": "none", "error": "no_url"})
            continue
        if not url.startswith("http"):
            url = "https://" + url
        try:
            raw = asyncio.run(smart_fetch(url)) if asyncio.iscoroutinefunction(smart_fetch) else smart_fetch(url)
        except Exception as e:
            raw = {"html": "", "status_code": 0, "tool": "none", "error": str(e), "success": False}

        text = parse_text(raw.get("html", "")) if raw.get("success") else ""
        results.append({
            "name": name, "url": url, "text": text,
            "text_length": len(text), "success": raw.get("success", False),
            "status_code": raw.get("status_code", 0), "tool_used": raw.get("tool", "unknown"),
            "error": raw.get("error"),
            **{k: v for k, v in co.items() if k not in ("url", "name")},
        })
        log.info("crawl_result", company=name, success=raw.get("success"), chars=len(text))

    success_count = sum(1 for r in results if r["success"])
    log_node_done("crawl", success=f"{success_count}/{len(results)}")
    return {"crawl_results": results, "error_log": errors}


# ─── Node 2b: recovery ────────────────────────────────────────────────────

def recovery_node(state: PipelineState) -> dict:
    log_node_start("recovery")
    cfg = get_settings()
    results = state.get("crawl_results", [])
    errors = []

    for r in [r for r in results if not r.get("success")]:
        failure_type = _classify_failure(cfg, r.get("url",""), r.get("error",""), r.get("status_code",0))
        if failure_type in ("cloudflare", "bot_detection", "rate_limit"):
            import importlib.util as _ilu
            from pathlib import Path as _Pl
            _spec = _ilu.spec_from_file_location("_crawling_alt1", _Pl(__file__).parent.parent / "tools" / "crawling" / "curl_cffi.py")
            _mod = _ilu.module_from_spec(_spec); _spec.loader.exec_module(_mod)
            retry = _mod.fetch(r["url"])
            if retry.get("success"):
                r.update({"text": parse_text(retry.get("html","")), "success": True, "tool_used": "curl_cffi_recovery"})
                continue
        r["text"] = ""
        errors.append(f"recovery: {r['name']} failed ({failure_type})")

    return {"crawl_results": results, "error_log": errors}


def _classify_failure(cfg, url: str, error: str, status: int) -> str:
    if not cfg.is_groq_configured:
        if status == 403 or "cloudflare" in (error or "").lower(): return "cloudflare"
        if status == 429: return "rate_limit"
        return "unknown"
    try:
        client = _groq_client()
        resp = client.chat.completions.create(
            model=cfg.groq_fast_model,
            messages=[{"role":"user","content":f"URL crawl failed. URL:{url} Error:{error} Status:{status}\nClassify in ONE word: cloudflare, bot_detection, rate_limit, dns_error, timeout, content_empty, unknown"}],
            max_tokens=10, temperature=0,
        )
        return resp.choices[0].message.content.strip().lower().split()[0]
    except Exception:
        return "cloudflare" if status == 403 else "rate_limit" if status == 429 else "unknown"


# ─── Node 3: extract ──────────────────────────────────────────────────────

def extract_node(state: PipelineState) -> dict:
    log_node_start("extract")
    extracted = []
    for r in state.get("crawl_results", []):
        text = r.get("text", "")
        ents = extract_entities(text) if text else {"organizations":[],"persons":[],"locations":[],"emails":[],"phones":[],"tool":"none"}
        lang = detect_language(text) if text else "unknown"
        extracted.append({"name": r["name"], "url": r.get("url",""), "language": lang,
                          "crawl_success": r.get("success",False), "crawl_tool": r.get("tool_used",""), **ents})
    log_node_done("extract", count=len(extracted))
    return {"extracted_entities": extracted}


# ─── Node 4: profile ──────────────────────────────────────────────────────

def profile_node(state: PipelineState) -> dict:
    from retro.models import CompanyProfileCard
    log_node_start("profile")
    cfg = get_settings()
    crawl_map = {r["name"]: r for r in state.get("crawl_results", [])}
    profiles, errors = [], []

    for ent in state.get("extracted_entities", []):
        name = ent["name"]
        text = crawl_map.get(name, {}).get("text", "")[:3000]

        if not text or not cfg.is_groq_configured:
            profiles.append(_profile_fallback(name, ent, crawl_map.get(name,{})))
            continue
        try:
            client = _instructor_client()
            profile: CompanyProfileCard = client.chat.completions.create(
                model=cfg.groq_model, response_model=CompanyProfileCard,
                messages=[
                    {"role":"system","content":"Kamu adalah analis bisnis B2B Indonesia. Ekstrak informasi dari teks website. JSON format. Fokus potensi kolaborasi B2B."},
                    {"role":"user","content":f"Perusahaan: {name}\nBahasa: {ent.get('language','')}\nEntitas: {json.dumps({'orgs':ent.get('organizations',[])[:5]},ensure_ascii=False)}\n\nTeks:\n{text}"},
                ], max_retries=2,
            )
            p = profile.model_dump()
            p.update({"crawl_success": crawl_map.get(name,{}).get("success",False), "crawl_tool": crawl_map.get(name,{}).get("tool_used","")})
            profiles.append(p)
        except Exception as e:
            errors.append(f"profile:{name}: {e}")
            profiles.append(_profile_fallback(name, ent, crawl_map.get(name,{})))

    log_node_done("profile", count=len(profiles))
    return {"company_profiles": profiles, "error_log": errors}


def _profile_fallback(name: str, ent: dict, crawl: dict) -> dict:
    from retro.models import CompanyProfileCard
    url = crawl.get("url","")
    domain = url.replace("https://","").replace("http://","").split("/")[0]
    return CompanyProfileCard(company_name=name, domain=domain, industry="unknown",
        products_services=[], company_size="unknown", tech_maturity="unknown",
        collaboration_potential=[], red_flags=["profile_llm_unavailable"],
        confidence_score=0.1, language_detected=ent.get("language","unknown")).model_dump()


# ─── Node 5: synthesis ────────────────────────────────────────────────────

def synthesis_node(state: PipelineState) -> dict:
    from retro.models import SynthesisResult
    log_node_start("synthesis")
    cfg = get_settings()
    profiles = state.get("company_profiles", [])
    if not profiles:
        return {"synthesis_result": {}, "error_log": ["synthesis: no profiles"]}

    summary = json.dumps([{k: p.get(k) for k in ("company_name","industry","company_size","tech_maturity","collaboration_potential","confidence_score","red_flags")} for p in profiles], ensure_ascii=False, indent=2)

    if not cfg.is_groq_configured:
        return {"synthesis_result": _synthesis_fallback(profiles)}
    try:
        client = _instructor_client()
        result: SynthesisResult = client.chat.completions.create(
            model=cfg.groq_model, response_model=SynthesisResult,
            messages=[
                {"role":"system","content":"Kamu adalah strategic analyst B2B Indonesia. Rank perusahaan target berdasarkan potensi kolaborasi bisnis nyata."},
                {"role":"user","content":f"Analisis {len(profiles)} perusahaan berikut:\n{summary}\n\nBuat ranking, pilih top 3, executive summary."},
            ], max_retries=2,
        )
        log_node_done("synthesis", top=result.top_matches[0].company_name if result.top_matches else "-")
        return {"synthesis_result": result.model_dump()}
    except Exception as e:
        log_error("synthesis", str(e))
        return {"synthesis_result": _synthesis_fallback(profiles), "error_log": [f"synthesis: {e}"]}


def _synthesis_fallback(profiles: list) -> dict:
    ranked = sorted(profiles, key=lambda p: p.get("confidence_score",0), reverse=True)
    return {"top_matches": [{"company_name": p["company_name"], "ranking_reason": "highest confidence", "collaboration_strategy": "", "priority_score": p.get("confidence_score",0)} for p in ranked[:3]],
            "executive_summary": f"Batch {len(profiles)} perusahaan. Top: {ranked[0]['company_name'] if ranked else 'N/A'}.",
            "market_insight": "", "batch_notes": "Fallback synthesis (LLM unavailable)."}


# ─── Node 6: proposal ─────────────────────────────────────────────────────

def proposal_node(state: PipelineState) -> dict:
    from retro.models import ProposalSections
    log_node_start("proposal")
    cfg = get_settings()
    synthesis = state.get("synthesis_result", {})
    profiles = state.get("company_profiles", [])
    top = (synthesis.get("top_matches") or [{}])[0]
    top_name = top.get("company_name", "")
    top_profile = next((p for p in profiles if p.get("company_name") == top_name), profiles[0] if profiles else {})

    if not cfg.is_groq_configured:
        return {"proposal_sections": _proposal_fallback(top_profile, cfg.proposal_author)}
    try:
        client = _instructor_client()
        sections: ProposalSections = client.chat.completions.create(
            model=cfg.groq_model, response_model=ProposalSections,
            messages=[
                {"role":"system","content":f"Kamu adalah {cfg.proposal_author}, penulis proposal B2B profesional Indonesia. Tulis formal, substantif, minimal 2 paragraf per section."},
                {"role":"user","content":f"Buat proposal untuk: {top_name}\n\nProfil:\n{json.dumps(top_profile,ensure_ascii=False,indent=2)}\n\nInsight:\n{synthesis.get('executive_summary','')}"},
            ], max_retries=2,
        )
        log_node_done("proposal", target=top_name)
        return {"proposal_sections": sections.model_dump()}
    except Exception as e:
        log_error("proposal", str(e))
        return {"proposal_sections": _proposal_fallback(top_profile, cfg.proposal_author), "error_log": [f"proposal:{e}"]}


def _proposal_fallback(profile: dict, author: str) -> dict:
    name = profile.get("company_name","Target")
    return {"executive_summary": f"Proposal kerja sama strategis untuk {name}.",
            "background_our_company": f"{author} bergerak di bidang teknologi dan inovasi B2B.",
            "target_company_profile": f"{name} — industri {profile.get('industry','umum')}.",
            "collaboration_analysis": "Peluang kolaborasi signifikan berdasarkan analisis profil.",
            "proposed_value": "Kami menawarkan nilai tambah melalui teknologi dan jaringan.",
            "implementation_timeline": "Fase 1 (Bln 1-2): Diskusi & LOI. Fase 2 (Bln 3-4): Pilot. Fase 3: Scaling.",
            "next_steps": "Konfirmasi ketersediaan pertemuan dalam 2 minggu.",
            "appendix_data": f"Confidence score: {profile.get('confidence_score',0):.2f}",
            "email_subject": f"Proposal Kerja Sama — {name} × {author}",
            "email_body_preview": f"Yth. Tim {name}, kami mengajukan proposal kerja sama strategis..."}


# ─── Node 7: pdf ──────────────────────────────────────────────────────────

def pdf_node(state: PipelineState) -> dict:
    log_node_start("pdf")
    cfg = get_settings()
    synthesis = state.get("synthesis_result", {})
    profiles  = state.get("company_profiles", [])
    sections  = state.get("proposal_sections", {})
    crawl     = state.get("crawl_results", [])
    top_name  = (synthesis.get("top_matches") or [{}])[0].get("company_name", "company")
    top_profile = next((p for p in profiles if p.get("company_name") == top_name), profiles[0] if profiles else {})

    safe = top_name.replace(" ","_").replace("/","-")[:40]
    ds   = datetime.now().strftime("%Y-%m-%d")
    out  = Path(cfg.output_dir)
    out.mkdir(parents=True, exist_ok=True)

    r_out = render_outbound_pdf(
        {"author": cfg.proposal_author, "date": datetime.now().strftime("%d %B %Y"),
         "target_company": top_name, "company_profile": top_profile, "sections": sections},
        str(out / f"proposal_{safe}_outbound_{ds}.pdf"), theme=cfg.proposal_theme,
    )
    r_int = render_internal_pdf(
        {"author": cfg.proposal_author, "date": datetime.now().strftime("%d %B %Y"),
         "profiles": sorted(profiles, key=lambda p: p.get("confidence_score",0), reverse=True),
         "synthesis": synthesis, "error_log": state.get("error_log",[]),
         "stats": {"companies_count": len(profiles), "success_count": sum(1 for r in crawl if r.get("success")),
                   "input_file": state.get("run_metadata",{}).get("input_file",""),
                   "groq_model": cfg.groq_model, "start_time": state.get("run_metadata",{}).get("start_time",""),
                   "end_time": _now_iso(), "version": "0.1.0"}},
        str(out / f"report_internal_{ds}.pdf"), theme=cfg.proposal_theme,
    )

    log_node_done("pdf", outbound=r_out.get("tool"), internal=r_int.get("tool"))
    return {
        "output_paths": {"outbound_pdf": r_out.get("path") if r_out["success"] else None,
                         "internal_pdf": r_int.get("path") if r_int["success"] else None,
                         "outbound_tool": r_out.get("tool"), "internal_tool": r_int.get("tool")},
        "error_log": ([] if r_out["success"] else [f"pdf:outbound:{r_out.get('error')}"]) +
                     ([] if r_int["success"] else [f"pdf:internal:{r_int.get('error')}"]),
    }


# ─── Node 8: save ─────────────────────────────────────────────────────────

def save_node(state: PipelineState) -> dict:
    log_node_start("save")
    cfg  = get_settings()
    meta = state.get("run_metadata", {})
    crawl = state.get("crawl_results", [])
    run_id = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    try:
        from datetime import datetime as dt
        dur = (dt.utcnow() - dt.fromisoformat(meta.get("start_time", run_id))).total_seconds()
    except Exception:
        dur = 0.0

    result = save_pipeline_results({
        "run_id": run_id, "run_metadata": meta,
        "profiles": state.get("company_profiles",[]),
        "proposal_sections": state.get("proposal_sections",{}),
        "output_paths": state.get("output_paths",{}),
        "error_log": state.get("error_log",[]),
        "companies_count": len(state.get("company_profiles",[])),
        "success_count": sum(1 for r in crawl if r.get("success")),
        "duration_seconds": round(dur,1),
        "top_company": (state.get("synthesis_result",{}).get("top_matches") or [{}])[0].get("company_name",""),
    }, db_path=cfg.db_path)

    log_node_done("save", tool=result.get("tool"), success=result.get("success"))
    return {"error_log": [] if result.get("success") else [f"save:{result.get('error')}"]}


# ─── Routing ──────────────────────────────────────────────────────────────

def should_recover(state: PipelineState) -> str:
    return "recovery" if any(not r.get("success") for r in state.get("crawl_results",[])) else "extract"
