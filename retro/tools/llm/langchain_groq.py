"""[07] LLM Agent — MAIN: LangGraph + langchain-groq"""
from typing import Optional


def complete(messages: list[dict], model: str | None = None, temperature: float = 0.3, max_tokens: int = 2048) -> dict:
    """langchain-groq chat completion. Terintegrasi penuh dengan LangGraph."""
    try:
        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
        from retro.config import get_settings
        cfg = get_settings()
        llm = ChatGroq(model=model or cfg.groq_model, api_key=cfg.groq_api_key, temperature=temperature, max_tokens=max_tokens)
        lc_msgs = []
        for m in messages:
            role, content = m.get("role","user"), m.get("content","")
            if role == "system": lc_msgs.append(SystemMessage(content=content))
            elif role == "assistant": lc_msgs.append(AIMessage(content=content))
            else: lc_msgs.append(HumanMessage(content=content))
        resp = llm.invoke(lc_msgs)
        return {"content": resp.content, "model": model or cfg.groq_model, "tool": "langchain_groq", "error": None}
    except ImportError:
        return {"content": "", "tool": "langchain_groq", "error": "langchain-groq not installed"}
    except Exception as e:
        return {"content": "", "tool": "langchain_groq", "error": str(e)}


def with_tools(messages: list[dict], tools: list, model: str | None = None) -> dict:
    """langchain-groq dengan tool binding untuk agentic calls."""
    try:
        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage, SystemMessage
        from retro.config import get_settings
        cfg = get_settings()
        llm = ChatGroq(model=model or cfg.groq_model, api_key=cfg.groq_api_key).bind_tools(tools)
        lc_msgs = [SystemMessage(content=m["content"]) if m["role"]=="system" else HumanMessage(content=m["content"]) for m in messages]
        resp = llm.invoke(lc_msgs)
        return {"content": resp.content, "tool_calls": [tc.dict() for tc in (resp.tool_calls or [])], "tool": "langchain_groq_tools", "error": None}
    except Exception as e:
        return {"content": "", "tool_calls": [], "tool": "langchain_groq_tools", "error": str(e)}
