"""[16] Graph DB — ALT1: dict adjacency list (zero dependency)"""
import json
from pathlib import Path

_GRAPHS: dict[str, dict] = {}


def _g(name: str) -> dict:
    if name not in _GRAPHS:
        _GRAPHS[name] = {"nodes": {}, "edges": []}
    return _GRAPHS[name]


def add_company(graph_name: str, company: str, attrs: dict = {}) -> dict:
    _g(graph_name)["nodes"][company] = attrs
    return {"success": True, "nodes": len(_g(graph_name)["nodes"]), "tool": "dict_graph"}


def add_relation(graph_name: str, src: str, dst: str, relation: str = "partner", weight: float = 1.0) -> dict:
    _g(graph_name)["edges"].append({"src": src, "dst": dst, "relation": relation, "weight": weight})
    return {"success": True, "edges": len(_g(graph_name)["edges"]), "tool": "dict_graph"}


def get_neighbors(graph_name: str, company: str) -> dict:
    g = _g(graph_name)
    neighbors = [e for e in g["edges"] if e["src"] == company]
    return {"company": company, "neighbors": neighbors, "tool": "dict_graph"}


def save_graph(graph_name: str, path: str = "./output/graph.json") -> dict:
    try:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(json.dumps(_g(graph_name), ensure_ascii=False, indent=2))
        return {"success": True, "path": path, "tool": "dict_graph"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "dict_graph"}
