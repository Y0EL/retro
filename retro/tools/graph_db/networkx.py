"""[16] Graph DB — MAIN: NetworkX (in-memory, analisis relasi antar perusahaan)"""
import json
from pathlib import Path

_GRAPHS: dict = {}


def get_graph(name: str = "retro"):
    if name not in _GRAPHS:
        try:
            import networkx as nx
            _GRAPHS[name] = nx.DiGraph()
        except ImportError:
            return None
    return _GRAPHS.get(name)


def add_company(graph_name: str, company: str, attrs: dict = {}) -> dict:
    """Tambah node perusahaan ke graph."""
    G = get_graph(graph_name)
    if G is None: return {"success": False, "error": "networkx not installed", "tool": "networkx"}
    G.add_node(company, **attrs)
    return {"success": True, "nodes": G.number_of_nodes(), "tool": "networkx"}


def add_relation(graph_name: str, src: str, dst: str, relation: str = "partner", weight: float = 1.0) -> dict:
    """Tambah edge relasi antar perusahaan."""
    G = get_graph(graph_name)
    if G is None: return {"success": False, "error": "networkx not installed", "tool": "networkx"}
    G.add_edge(src, dst, relation=relation, weight=weight)
    return {"success": True, "edges": G.number_of_edges(), "tool": "networkx"}


def get_neighbors(graph_name: str, company: str) -> dict:
    """Ambil semua perusahaan yang terhubung ke company."""
    G = get_graph(graph_name)
    if G is None: return {"company": company, "neighbors": [], "tool": "networkx"}
    try:
        import networkx as nx
        neighbors = [{"node": n, **G.edges[company, n]} for n in G.successors(company)]
        return {"company": company, "neighbors": neighbors, "in_degree": G.in_degree(company), "out_degree": G.out_degree(company), "tool": "networkx"}
    except Exception as e:
        return {"company": company, "neighbors": [], "error": str(e), "tool": "networkx"}


def save_graph(graph_name: str, path: str = "./output/graph.json") -> dict:
    """Export graph ke JSON."""
    G = get_graph(graph_name)
    if G is None: return {"success": False, "tool": "networkx"}
    try:
        import networkx as nx
        data = nx.node_link_data(G)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2))
        return {"success": True, "path": path, "nodes": G.number_of_nodes(), "edges": G.number_of_edges(), "tool": "networkx"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "networkx"}
