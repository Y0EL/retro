"""[05] Vector DB — ALT1: FAISS (Facebook AI, in-memory, fast)"""
_INDEXES: dict = {}


def upsert(collection: str, documents: list[dict]) -> dict:
    """Build FAISS flat index dengan sentence-transformers embeddings."""
    try:
        import faiss
        import numpy as np
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        texts = [d["text"] for d in documents]
        emb = model.encode(texts, normalize_embeddings=True).astype("float32")
        index = faiss.IndexFlatIP(emb.shape[1])
        index.add(emb)
        _INDEXES[collection] = {"index": index, "docs": documents, "model": model}
        return {"success": True, "count": len(documents), "collection": collection, "tool": "faiss"}
    except ImportError:
        return {"success": False, "error": "faiss/sentence-transformers not installed", "tool": "faiss"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "faiss"}


def search(collection: str, query: str, n: int = 5) -> dict:
    """Cosine similarity search di FAISS index."""
    try:
        import numpy as np
        store = _INDEXES.get(collection)
        if not store:
            return {"query": query, "hits": [], "error": "index not found", "tool": "faiss"}
        q = store["model"].encode([query], normalize_embeddings=True).astype("float32")
        scores, idxs = store["index"].search(q, n)
        hits = [{**store["docs"][i], "score": float(s)} for s, i in zip(scores[0], idxs[0]) if i >= 0]
        return {"query": query, "hits": hits, "tool": "faiss"}
    except Exception as e:
        return {"query": query, "hits": [], "error": str(e), "tool": "faiss"}
