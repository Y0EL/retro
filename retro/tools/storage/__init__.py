from . import sqlite, json_file, postgresql

def init_db(db_path: str = "./retro.db") -> bool:
    return sqlite.init(db_path)

def save_pipeline_results(data: dict, db_path: str = "./retro.db", prefer: str = "sqlite") -> dict:
    if prefer == "json": return json_file.save(data)
    if prefer == "postgres": return postgresql.save(data)
    r = sqlite.save(data, db_path)
    if not r["success"]: r = json_file.save(data)
    return r
