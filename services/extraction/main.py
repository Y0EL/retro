import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import structlog

from retro.tools import extract_entities, detect_language, extract_emails_from_text

app = FastAPI(title="RETRO Extraction Service")
log = structlog.get_logger()


def _ok(data):
    return {"success": True, "data": data, "error": None}


def _err(e):
    return {"success": False, "data": None, "error": str(e)}


class TextRequest(BaseModel):
    text: str
    language: Optional[str] = "auto"


@app.get("/health")
def health():
    return {"status": "ok", "service": "extraction"}


@app.post("/entities")
async def entities(req: TextRequest):
    log.info("entities", text_length=len(req.text))
    try:
        ents = extract_entities(req.text)
        lang = detect_language(req.text)
        return _ok({**ents, "language": lang, "word_count": len(req.text.split())})
    except Exception as e:
        log.error("entities_failed", error=str(e))
        return JSONResponse(status_code=500, content=_err(e))


@app.post("/detect-lang")
async def detect_lang(req: TextRequest):
    try:
        lang = detect_language(req.text)
        return _ok({"language": lang})
    except Exception as e:
        return JSONResponse(status_code=500, content=_err(e))


@app.post("/extract-emails")
async def extract_emails(req: TextRequest):
    try:
        emails = extract_emails_from_text(req.text)
        return _ok({"emails": emails, "count": len(emails)})
    except Exception as e:
        return JSONResponse(status_code=500, content=_err(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
