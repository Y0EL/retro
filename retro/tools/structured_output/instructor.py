"""[15] Structured Output — MAIN: instructor + Pydantic v2 (LLM → typed objects)"""
from typing import Type, TypeVar

try:
    from pydantic import BaseModel
    _PYDANTIC_AVAILABLE = True
except ImportError:
    _PYDANTIC_AVAILABLE = False
    BaseModel = object  # type: ignore

T = TypeVar("T")


def extract(model_class: Type[T], messages: list[dict], llm_model: str | None = None) -> T | None:
    """
    instructor + Groq: extract structured Pydantic object dari LLM response.
    Otomatis retry jika JSON invalid. Paling reliable.
    """
    try:
        import groq, instructor
        from retro.config import get_settings
        cfg = get_settings()
        client = instructor.from_groq(groq.Groq(api_key=cfg.groq_api_key), mode=instructor.Mode.JSON)
        return client.chat.completions.create(model=llm_model or cfg.groq_model, response_model=model_class, messages=messages, max_retries=2)
    except ImportError:
        return None
    except Exception:
        return None
