"""[15] Structured Output — ALT1: manual json.loads dengan repair"""
import json
import re
from typing import Type, TypeVar

try:
    from pydantic import BaseModel
    _PYDANTIC_AVAILABLE = True
except ImportError:
    _PYDANTIC_AVAILABLE = False
    BaseModel = object  # type: ignore

T = TypeVar("T")


def _repair_json(text: str) -> str:
    """Coba extract JSON dari teks mixed (LLM kadang tambah prose)."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    return match.group(0) if match else text


def extract(model_class: Type[T], raw_text: str) -> T | None:
    """Parse JSON string dari LLM response → Pydantic model. Dengan repair."""
    try:
        cleaned = _repair_json(raw_text)
        data = json.loads(cleaned)
        return model_class(**data)
    except Exception:
        return None


def llm_then_parse(model_class: Type[T], messages: list[dict], llm_model: str | None = None) -> T | None:
    """Call LLM, ambil raw text, parse manual ke Pydantic model."""
    try:
        import groq
        from retro.config import get_settings
        cfg = get_settings()
        client = groq.Groq(api_key=cfg.groq_api_key)
        system_prompt = f"Respond ONLY with valid JSON matching this schema: {model_class.model_json_schema()}"
        msgs = [{"role": "system", "content": system_prompt}] + [m for m in messages if m.get("role") != "system"]
        resp = client.chat.completions.create(model=llm_model or cfg.groq_model, messages=msgs, temperature=0.1, response_format={"type": "json_object"})
        return extract(model_class, resp.choices[0].message.content)
    except Exception:
        return None
