from . import networkx, adjacency, neo4j

def graph_add_company(graph_name: str, company: str, attrs: dict = {}, prefer: str = "networkx") -> dict:
    if prefer == "adjacency": return adjacency.add_company(graph_name, company, attrs)
    r = networkx.add_company(graph_name, company, attrs)
    if not r["success"]: r = adjacency.add_company(graph_name, company, attrs)
    return r

def graph_add_relation(graph_name: str, src: str, dst: str, relation: str = "partner", prefer: str = "networkx") -> dict:
    if prefer == "adjacency": return adjacency.add_relation(graph_name, src, dst, relation)
    r = networkx.add_relation(graph_name, src, dst, relation)
    if not r["success"]: r = adjacency.add_relation(graph_name, src, dst, relation)
    return r

def graph_save(graph_name: str, path: str = "./output/graph.json", prefer: str = "networkx") -> dict:
    if prefer == "adjacency": return adjacency.save_graph(graph_name, path)
    r = networkx.save_graph(graph_name, path)
    if not r["success"]: r = adjacency.save_graph(graph_name, path)
    return r
