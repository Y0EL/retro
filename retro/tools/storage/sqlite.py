"""[06] Relational DB — MAIN: SQLite + SQLModel (embedded, zero server)"""
import json
import sqlite3
from datetime import datetime
from pathlib import Path


def init(db_path: str = "./retro.db") -> bool:
    """Buat tabel runs, companies, proposals jika belum ada."""
    try:
        conn = sqlite3.connect(db_path)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS runs (
                run_id TEXT PRIMARY KEY, input_file TEXT, author TEXT, theme TEXT,
                companies_count INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0,
                duration_seconds REAL, error_count INTEGER DEFAULT 0, created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, company_name TEXT,
                domain TEXT, industry TEXT, company_size TEXT, tech_maturity TEXT,
                confidence_score REAL, language_detected TEXT, profile_json TEXT,
                crawl_success INTEGER DEFAULT 0, crawl_tool TEXT, created_at TEXT
            );
            CREATE TABLE IF NOT EXISTS proposals (
                id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, target_company TEXT,
                outbound_pdf_path TEXT, internal_pdf_path TEXT, sections_json TEXT, created_at TEXT
            );
        """)
        conn.commit()
        conn.close()
        return True
    except Exception:
        return False


def save(data: dict, db_path: str = "./retro.db") -> dict:
    """Simpan hasil pipeline ke SQLite. data: {run_id, profiles, proposal_sections, ...}"""
    try:
        init(db_path)
        run_id = data.get("run_id", datetime.utcnow().strftime("%Y%m%d_%H%M%S"))
        now = datetime.utcnow().isoformat()
        meta = data.get("run_metadata", {})

        conn = sqlite3.connect(db_path)
        conn.execute("""
            INSERT OR REPLACE INTO runs(run_id,input_file,author,theme,companies_count,
            success_count,duration_seconds,error_count,created_at)
            VALUES(?,?,?,?,?,?,?,?,?)
        """, (run_id, meta.get("input_file",""), meta.get("author","Yoel"), meta.get("theme","light"),
              data.get("companies_count",0), data.get("success_count",0),
              data.get("duration_seconds"), len(data.get("error_log",[])), now))

        for p in data.get("profiles", []):
            conn.execute("""
                INSERT INTO companies(run_id,company_name,domain,industry,company_size,tech_maturity,
                confidence_score,language_detected,profile_json,crawl_success,crawl_tool,created_at)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
            """, (run_id, p.get("company_name",""), p.get("domain"), p.get("industry"),
                  p.get("company_size"), p.get("tech_maturity"), p.get("confidence_score"),
                  p.get("language_detected"), json.dumps(p, ensure_ascii=False),
                  int(p.get("crawl_success", False)), p.get("crawl_tool"), now))

        if data.get("proposal_sections"):
            paths = data.get("output_paths", {})
            conn.execute("""
                INSERT INTO proposals(run_id,target_company,outbound_pdf_path,internal_pdf_path,sections_json,created_at)
                VALUES(?,?,?,?,?,?)
            """, (run_id, data.get("top_company",""), paths.get("outbound_pdf"), paths.get("internal_pdf"),
                  json.dumps(data.get("proposal_sections",{}), ensure_ascii=False), now))

        conn.commit()
        conn.close()
        return {"success": True, "db_path": db_path, "run_id": run_id, "tool": "sqlite"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "sqlite"}
