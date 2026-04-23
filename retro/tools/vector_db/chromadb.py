"""[05] Vector DB — MAIN: ChromaDB (embedded, no Docker, persistent)"""
_CLIENT = None


def _get(persist_dir: str = "./chroma_db"):
    global _CLIENT
    if _CLIENT is None:
        try:
            import chromadb
            _CLIENT = chromadb.PersistentClient(path=persist_dir)
        except ImportError:
            _CLIENT = "unavailable"
    return _CLIENT if _CLIENT != "unavailable" else None


def upsert(collection: str, documents: list[dict], persist_dir: str = "./chroma_db") -> dict:
    """Upsert documents ke ChromaDB. documents: [{id, text, metadata}]"""
    client = _get(persist_dir)
    if client is None:
        return {"success": False, "error": "chromadb not installed", "tool": "chromadb"}
    try:
        col = client.get_or_create_collection(collection)
        col.upsert(
            ids=[str(d["id"]) for d in documents],
            documents=[d["text"] for d in documents],
            metadatas=[d.get("metadata", {}) for d in documents],
        )
        return {"success": True, "count": len(documents), "collection": collection, "tool": "chromadb"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "chromadb"}


def search(collection: str, query: str, n: int = 5, persist_dir: str = "./chroma_db") -> dict:
    """Semantic similarity search di ChromaDB."""
    client = _get(persist_dir)
    if client is None:
        return {"query": query, "hits": [], "error": "chromadb not installed", "tool": "chromadb"}
    try:
        col = client.get_or_create_collection(collection)
        res = col.query(query_texts=[query], n_results=n)
        hits = [{"id": res["ids"][0][i], "text": res["documents"][0][i],
                 "metadata": (res.get("metadatas") or [[]])[0][i] if res.get("metadatas") else {},
                 "distance": (res.get("distances") or [[]])[0][i] if res.get("distances") else None}
                for i in range(len(res["ids"][0]))]
        return {"query": query, "hits": hits, "tool": "chromadb"}
    except Exception as e:
        return {"query": query, "hits": [], "error": str(e), "tool": "chromadb"}
