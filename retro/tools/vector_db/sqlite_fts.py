"""[05] Vector DB — ALT2: SQLite FTS5 (full-text search, zero dependency)"""
import json
import sqlite3


def upsert(collection: str, documents: list[dict], db_path: str = "./retro.db") -> dict:
    """Insert dokumen ke SQLite FTS5 virtual table."""
    try:
        table = f"fts_{collection.replace('-','_')}"
        conn = sqlite3.connect(db_path)
        conn.execute(f"CREATE VIRTUAL TABLE IF NOT EXISTS {table} USING fts5(id UNINDEXED, text, metadata UNINDEXED)")
        conn.executemany(f"INSERT INTO {table}(id, text, metadata) VALUES(?,?,?)",
                         [(str(d["id"]), d["text"], json.dumps(d.get("metadata", {}))) for d in documents])
        conn.commit()
        conn.close()
        return {"success": True, "count": len(documents), "table": table, "tool": "sqlite_fts5"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "sqlite_fts5"}


def search(collection: str, query: str, n: int = 5, db_path: str = "./retro.db") -> dict:
    """Full-text search di SQLite FTS5."""
    try:
        table = f"fts_{collection.replace('-','_')}"
        conn = sqlite3.connect(db_path)
        rows = conn.execute(f"SELECT id, text, metadata, rank FROM {table}(?) ORDER BY rank LIMIT ?", (query, n)).fetchall()
        conn.close()
        hits = [{"id": r[0], "text": r[1], "metadata": json.loads(r[2] or "{}"), "score": r[3]} for r in rows]
        return {"query": query, "hits": hits, "tool": "sqlite_fts5"}
    except Exception as e:
        return {"query": query, "hits": [], "error": str(e), "tool": "sqlite_fts5"}
