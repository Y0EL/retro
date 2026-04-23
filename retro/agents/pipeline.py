"""
RETRO LangGraph pipeline — StateGraph definition, compile, and invoke.
"""
from langgraph.graph import StateGraph, START, END

from retro.state import PipelineState
from retro.agents.nodes import (
    load_input_node,
    crawl_node,
    recovery_node,
    extract_node,
    profile_node,
    synthesis_node,
    proposal_node,
    pdf_node,
    save_node,
    should_recover,
)


def build_pipeline():
    """
    Build and compile the RETRO LangGraph pipeline.

    Flow:
        START → load_input → crawl
               ↓ (conditional)
        crawl → [recovery] → extract → profile → synthesis → proposal → pdf → save → END
    """
    graph = StateGraph(PipelineState)

    # Add nodes
    graph.add_node("load_input", load_input_node)
    graph.add_node("crawl", crawl_node)
    graph.add_node("recovery", recovery_node)
    graph.add_node("extract", extract_node)
    graph.add_node("profile", profile_node)
    graph.add_node("synthesis", synthesis_node)
    graph.add_node("proposal", proposal_node)
    graph.add_node("pdf", pdf_node)
    graph.add_node("save", save_node)

    # Linear edges
    graph.add_edge(START, "load_input")
    graph.add_edge("load_input", "crawl")

    # Conditional: if any crawl failed → recovery, else → extract
    graph.add_conditional_edges(
        "crawl",
        should_recover,
        {"recovery": "recovery", "extract": "extract"},
    )
    graph.add_edge("recovery", "extract")
    graph.add_edge("extract", "profile")
    graph.add_edge("profile", "synthesis")
    graph.add_edge("synthesis", "proposal")
    graph.add_edge("proposal", "pdf")
    graph.add_edge("pdf", "save")
    graph.add_edge("save", END)

    return graph.compile()


def run_pipeline(initial_state: dict | None = None) -> dict:
    """
    Compile and invoke the pipeline. Returns final state.
    initial_state: optionally pre-populate companies_input, run_metadata, etc.
    """
    pipeline = build_pipeline()

    state: PipelineState = {
        "companies_input": [],
        "crawl_results": [],
        "extracted_entities": [],
        "company_profiles": [],
        "synthesis_result": {},
        "proposal_sections": {},
        "output_paths": {},
        "error_log": [],
        "run_metadata": {},
    }

    if initial_state:
        state.update(initial_state)

    return pipeline.invoke(state)
