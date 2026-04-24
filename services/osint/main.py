import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import structlog

from retro.tools import domain_intelligence

app = FastAPI(title="RETRO OSINT Service")
log = structlog.get_logger()


def _ok(data):
    return {"success": True, "data": data, "error": None}


def _err(e):
    return {"success": False, "data": None, "error": str(e)}


class DomainRequest(BaseModel):
    domain: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "osint"}


@app.post("/domain-intel")
async def domain_intel(req: DomainRequest):
    log.info("domain_intel", domain=req.domain)
    try:
        result = domain_intelligence(req.domain)
        return _ok(result)
    except Exception as e:
        log.error("domain_intel_failed", domain=req.domain, error=str(e))
        return JSONResponse(status_code=500, content=_err(e))


@app.post("/whois")
async def whois(req: DomainRequest):
    log.info("whois", domain=req.domain)
    try:
        import importlib.util
        from pathlib import Path
        spec = importlib.util.spec_from_file_location(
            "_whois", Path(__file__).parent.parent.parent / "retro" / "tools" / "osint" / "whois.py"
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        result = mod.fetch(req.domain)
        return _ok(result)
    except Exception as e:
        log.error("whois_failed", domain=req.domain, error=str(e))
        return JSONResponse(status_code=500, content=_err(e))


@app.post("/wayback")
async def wayback(req: DomainRequest):
    log.info("wayback", domain=req.domain)
    try:
        import importlib.util
        from pathlib import Path
        spec = importlib.util.spec_from_file_location(
            "_wayback", Path(__file__).parent.parent.parent / "retro" / "tools" / "osint" / "wayback.py"
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        result = mod.fetch(req.domain)
        return _ok(result)
    except Exception as e:
        log.error("wayback_failed", domain=req.domain, error=str(e))
        return JSONResponse(status_code=500, content=_err(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
