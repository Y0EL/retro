import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from typing import Optional
import structlog
import tempfile
import pathlib

from retro.tools import render_outbound_pdf, render_internal_pdf

app = FastAPI(title="RETRO PDF Service")
log = structlog.get_logger()


def _ok(data):
    return {"success": True, "data": data, "error": None}


def _err(e):
    return {"success": False, "data": None, "error": str(e)}


class RenderRequest(BaseModel):
    data: dict
    theme: Optional[str] = "light"
    filename: Optional[str] = None


@app.get("/health")
def health():
    return {"status": "ok", "service": "pdf"}


@app.post("/render-outbound")
async def render_outbound(req: RenderRequest):
    log.info("render_outbound", theme=req.theme)
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = str(pathlib.Path(tmpdir) / (req.filename or "outbound.pdf"))
            result = render_outbound_pdf(req.data, out_path, theme=req.theme)
            if result.get("success") and pathlib.Path(out_path).exists():
                pdf_bytes = pathlib.Path(out_path).read_bytes()
                return Response(content=pdf_bytes, media_type="application/pdf",
                                headers={"Content-Disposition": f"attachment; filename={req.filename or 'outbound.pdf'}"})
            return JSONResponse(status_code=500, content=_err(result.get("error", "render failed")))
    except Exception as e:
        log.error("render_outbound_failed", error=str(e))
        return JSONResponse(status_code=500, content=_err(e))


@app.post("/render-internal")
async def render_internal(req: RenderRequest):
    log.info("render_internal", theme=req.theme)
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = str(pathlib.Path(tmpdir) / (req.filename or "internal.pdf"))
            result = render_internal_pdf(req.data, out_path, theme=req.theme)
            if result.get("success") and pathlib.Path(out_path).exists():
                pdf_bytes = pathlib.Path(out_path).read_bytes()
                return Response(content=pdf_bytes, media_type="application/pdf",
                                headers={"Content-Disposition": f"attachment; filename={req.filename or 'internal.pdf'}"})
            return JSONResponse(status_code=500, content=_err(result.get("error", "render failed")))
    except Exception as e:
        log.error("render_internal_failed", error=str(e))
        return JSONResponse(status_code=500, content=_err(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
