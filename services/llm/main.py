import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Any
import structlog
import json

from retro.tools import llm_complete, extract_structured
from retro.config import get_settings

app = FastAPI(title="RETRO LLM Service")
log = structlog.get_logger()


def _ok(data):
    return {"success": True, "data": data, "error": None}


def _err(e):
    return {"success": False, "data": None, "error": str(e)}


class CompleteRequest(BaseModel):
    system: str
    user: str
    model: Optional[str] = None
    response_format: Optional[str] = "text"


class ProfileRequest(BaseModel):
    company_name: str
    text: str
    language: Optional[str] = "auto"


class SynthesizeRequest(BaseModel):
    profiles: List[dict]


class ProposeRequest(BaseModel):
    profile: dict
    synthesis: dict
    author: Optional[str] = "PT GSP"


class BriefingRequest(BaseModel):
    company_name: str
    domain: Optional[str] = None
    context: Optional[str] = ""


@app.get("/health")
def health():
    return {"status": "ok", "service": "llm"}


@app.post("/complete")
async def complete(req: CompleteRequest):
    log.info("complete", response_format=req.response_format)
    try:
        result = llm_complete(system=req.system, user=req.user)
        return _ok({"text": result})
    except Exception as e:
        log.error("complete_failed", error=str(e))
        return JSONResponse(status_code=500, content=_err(e))


@app.post("/profile")
async def profile(req: ProfileRequest):
    from retro.models import CompanyProfileCard
    log.info("profile", company=req.company_name)
    cfg = get_settings()
    try:
        import groq, instructor
        client = instructor.from_groq(groq.Groq(api_key=cfg.groq_api_key), mode=instructor.Mode.JSON)
        result: CompanyProfileCard = client.chat.completions.create(
            model=cfg.groq_model, response_model=CompanyProfileCard,
            messages=[
                {"role": "system", "content": "Kamu adalah analis bisnis B2B Indonesia. Ekstrak informasi dari teks website. JSON format. Fokus potensi kolaborasi B2B."},
                {"role": "user", "content": f"Perusahaan: {req.company_name}\nBahasa: {req.language}\n\nTeks:\n{req.text[:cfg.profile_context_max_chars]}"},
            ], max_retries=2,
        )
        return _ok(result.model_dump())
    except Exception as e:
        log.error("profile_failed", company=req.company_name, error=str(e))
        return JSONResponse(status_code=500, content=_err(e))


@app.post("/synthesize")
async def synthesize(req: SynthesizeRequest):
    from retro.models import SynthesisResult
    log.info("synthesize", count=len(req.profiles))
    cfg = get_settings()
    try:
        summary = json.dumps([{k: p.get(k) for k in ("company_name", "industry", "company_size", "tech_maturity", "collaboration_potential", "confidence_score")} for p in req.profiles], ensure_ascii=False, indent=2)
        import groq, instructor
        client = instructor.from_groq(groq.Groq(api_key=cfg.groq_api_key), mode=instructor.Mode.JSON)
        result: SynthesisResult = client.chat.completions.create(
            model=cfg.groq_model, response_model=SynthesisResult,
            messages=[
                {"role": "system", "content": "Kamu adalah strategic analyst B2B Indonesia. Rank perusahaan berdasarkan potensi kolaborasi."},
                {"role": "user", "content": f"Analisis {len(req.profiles)} perusahaan:\n{summary}\n\nBuat ranking dan executive summary."},
            ], max_retries=2,
        )
        return _ok(result.model_dump())
    except Exception as e:
        log.error("synthesize_failed", error=str(e))
        return JSONResponse(status_code=500, content=_err(e))


@app.post("/propose")
async def propose(req: ProposeRequest):
    from retro.models import ProposalSections
    log.info("propose", company=req.profile.get("company_name", ""))
    cfg = get_settings()
    try:
        import groq, instructor
        client = instructor.from_groq(groq.Groq(api_key=cfg.groq_api_key), mode=instructor.Mode.JSON)
        result: ProposalSections = client.chat.completions.create(
            model=cfg.groq_model, response_model=ProposalSections,
            messages=[
                {"role": "system", "content": f"Kamu adalah {req.author}, penulis proposal B2B profesional Indonesia."},
                {"role": "user", "content": f"Buat proposal untuk: {req.profile.get('company_name','')}\n\nProfil:\n{json.dumps(req.profile, ensure_ascii=False, indent=2)}\n\nInsight:\n{req.synthesis.get('executive_summary','')}"},
            ], max_retries=2,
        )
        return _ok(result.model_dump())
    except Exception as e:
        log.error("propose_failed", error=str(e))
        return JSONResponse(status_code=500, content=_err(e))


@app.post("/briefing")
async def briefing(req: BriefingRequest):
    from retro.models import BriefingReport
    log.info("briefing", company=req.company_name)
    cfg = get_settings()
    try:
        import groq, instructor
        client = instructor.from_groq(groq.Groq(api_key=cfg.groq_api_key), mode=instructor.Mode.JSON)
        result: BriefingReport = client.chat.completions.create(
            model=cfg.groq_model, response_model=BriefingReport,
            messages=[
                {"role": "system", "content": "Kamu adalah analis intelijen bisnis senior. Buat briefing komprehensif sebelum pertemuan dengan perusahaan target."},
                {"role": "user", "content": f"Buat briefing untuk pertemuan dengan: {req.company_name}\nDomain: {req.domain or 'tidak diketahui'}\nKonteks: {req.context or 'pertemuan pertama'}\n\nSertakan semua 9 section yang diperlukan."},
            ], max_retries=2,
        )
        return _ok(result.model_dump())
    except Exception as e:
        log.error("briefing_failed", error=str(e))
        return JSONResponse(status_code=500, content=_err(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
