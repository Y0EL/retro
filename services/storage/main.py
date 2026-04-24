import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import structlog

from retro.tools import save_pipeline_results, init_db
from retro.config import get_settings

app = FastAPI(title="RETRO Storage Service")
log = structlog.get_logger()


def _ok(data):
    return {"success": True, "data": data, "error": None}


def _err(e):
    return {"success": False, "data": None, "error": str(e)}


class SaveRunRequest(BaseModel):
    run_data: dict


class QueryRunsRequest(BaseModel):
    filters: Optional[dict] = None


@app.on_event("startup")
def startup():
    cfg = get_settings()
    init_db(db_path=cfg.db_path)
    log.info("storage_startup", db_path=cfg.db_path)


@app.get("/health")
def health():
    return {"status": "ok", "service": "storage"}


@app.post("/save-run")
async def save_run(req: SaveRunRequest):
    log.info("save_run", run_id=req.run_data.get("run_id", ""))
    cfg = get_settings()
    try:
        result = save_pipeline_results(req.run_data, db_path=cfg.db_path)
        if result.get("success"):
            return _ok(result)
        return JSONResponse(status_code=500, content=_err(result.get("error", "save failed")))
    except Exception as e:
        log.error("save_run_failed", error=str(e))
        return JSONResponse(status_code=500, content=_err(e))


@app.post("/query-runs")
async def query_runs(req: QueryRunsRequest):
    log.info("query_runs")
    cfg = get_settings()
    try:
        import sqlite3
        conn = sqlite3.connect(cfg.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.execute("SELECT * FROM runs ORDER BY created_at DESC LIMIT 50")
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return _ok({"runs": rows, "count": len(rows)})
    except Exception as e:
        log.error("query_runs_failed", error=str(e))
        return JSONResponse(status_code=500, content=_err(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
