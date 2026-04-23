"""[06] Relational DB — ALT2: PostgreSQL via psycopg2 (production scale)"""
import json
import os
from datetime import datetime


def save(data: dict, dsn: str = "") -> dict:
    """Simpan ke PostgreSQL. Butuh server + DATABASE_URL env."""
    dsn = dsn or os.environ.get("DATABASE_URL", "")
    if not dsn:
        return {"success": False, "error": "DATABASE_URL not set", "tool": "postgresql"}
    try:
        import psycopg2
        run_id = data.get("run_id", datetime.utcnow().strftime("%Y%m%d_%H%M%S"))
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        cur.execute(
            "CREATE TABLE IF NOT EXISTS retro_runs(run_id TEXT PRIMARY KEY, data JSONB, created_at TIMESTAMPTZ DEFAULT NOW())"
        )
        cur.execute(
            "INSERT INTO retro_runs(run_id, data) VALUES(%s,%s) ON CONFLICT(run_id) DO UPDATE SET data=EXCLUDED.data",
            (run_id, json.dumps(data, ensure_ascii=False, default=str)),
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "run_id": run_id, "tool": "postgresql"}
    except ImportError:
        return {"success": False, "error": "psycopg2 not installed", "tool": "postgresql"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "postgresql"}
