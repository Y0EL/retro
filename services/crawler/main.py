import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import structlog

from retro.tools import smart_fetch, parse_text

app = FastAPI(title="RETRO Crawler Service")
log = structlog.get_logger()


def _ok(data):
    return {"success": True, "data": data, "error": None}


def _err(e):
    return {"success": False, "data": None, "error": str(e)}


class FetchRequest(BaseModel):
    url: str
    timeout: int = 30


class FetchBatchRequest(BaseModel):
    urls: List[str]
    concurrency: int = 10


class ParseRequest(BaseModel):
    html: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "crawler"}


@app.post("/fetch")
async def fetch(req: FetchRequest):
    log.info("fetch", url=req.url)
    try:
        if not req.url.startswith("http"):
            req.url = "https://" + req.url
        raw = smart_fetch(req.url)
        text = parse_text(raw.get("html", "")) if raw.get("success") else ""
        return _ok({"url": req.url, "text": text, "text_length": len(text),
                    "success": raw.get("success", False), "status_code": raw.get("status_code", 0),
                    "tool_used": raw.get("tool", "unknown"), "error": raw.get("error")})
    except Exception as e:
        log.error("fetch_failed", url=req.url, error=str(e))
        return JSONResponse(status_code=500, content=_err(e))


@app.post("/fetch-batch")
async def fetch_batch(req: FetchBatchRequest):
    import asyncio
    log.info("fetch_batch", count=len(req.urls))
    results = []
    sem = asyncio.Semaphore(req.concurrency)

    async def _one(url: str):
        async with sem:
            try:
                if not url.startswith("http"):
                    url = "https://" + url
                loop = asyncio.get_event_loop()
                raw = await loop.run_in_executor(None, smart_fetch, url)
                text = parse_text(raw.get("html", "")) if raw.get("success") else ""
                return {"url": url, "text": text, "text_length": len(text),
                        "success": raw.get("success", False), "tool_used": raw.get("tool", "unknown"),
                        "error": raw.get("error")}
            except Exception as e:
                return {"url": url, "text": "", "text_length": 0, "success": False,
                        "tool_used": "none", "error": str(e)}

    results = await asyncio.gather(*[_one(u) for u in req.urls])
    return _ok({"results": list(results), "total": len(results),
                "success_count": sum(1 for r in results if r["success"])})


@app.post("/parse")
async def parse(req: ParseRequest):
    try:
        text = parse_text(req.html)
        return _ok({"text": text, "text_length": len(text)})
    except Exception as e:
        return JSONResponse(status_code=500, content=_err(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
