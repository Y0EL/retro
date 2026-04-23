"""[16] Graph DB — ALT2: Neo4j (production graph DB, butuh server)"""
import os


def add_company(uri: str, company: str, attrs: dict = {}, auth: tuple = ()) -> dict:
    """Tambah node Company ke Neo4j. uri: bolt://localhost:7687"""
    uri = uri or os.environ.get("NEO4J_URI","bolt://localhost:7687")
    auth = auth or (os.environ.get("NEO4J_USER","neo4j"), os.environ.get("NEO4J_PASS","password"))
    try:
        from neo4j import GraphDatabase
        with GraphDatabase.driver(uri, auth=auth) as driver:
            with driver.session() as session:
                session.run("MERGE (c:Company {name: $name}) SET c += $attrs", name=company, attrs=attrs)
        return {"success": True, "company": company, "tool": "neo4j"}
    except ImportError:
        return {"success": False, "error": "neo4j not installed", "tool": "neo4j"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "neo4j"}


def add_relation(uri: str, src: str, dst: str, relation: str = "PARTNER", auth: tuple = ()) -> dict:
    uri = uri or os.environ.get("NEO4J_URI","bolt://localhost:7687")
    auth = auth or (os.environ.get("NEO4J_USER","neo4j"), os.environ.get("NEO4J_PASS","password"))
    try:
        from neo4j import GraphDatabase
        with GraphDatabase.driver(uri, auth=auth) as driver:
            with driver.session() as session:
                session.run(f"MATCH (a:Company {{name:$src}}),(b:Company {{name:$dst}}) MERGE (a)-[:{relation}]->(b)", src=src, dst=dst)
        return {"success": True, "tool": "neo4j"}
    except ImportError:
        return {"success": False, "error": "neo4j not installed", "tool": "neo4j"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "neo4j"}
