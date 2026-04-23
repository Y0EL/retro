from . import chromadb, faiss, sqlite_fts

def vector_upsert(collection: str, documents: list, prefer: str = "chromadb") -> dict:
    if prefer == "faiss": return faiss.upsert(collection, documents)
    if prefer == "fts5": return sqlite_fts.upsert(collection, documents)
    r = chromadb.upsert(collection, documents)
    if not r["success"]: r = sqlite_fts.upsert(collection, documents)
    return r

def vector_search(collection: str, query: str, n: int = 5, prefer: str = "chromadb") -> dict:
    if prefer == "faiss": return faiss.search(collection, query, n)
    if prefer == "fts5": return sqlite_fts.search(collection, query, n)
    r = chromadb.search(collection, query, n)
    if r.get("error") and "not installed" in (r["error"] or ""):
        r = sqlite_fts.search(collection, query, n)
    return r
