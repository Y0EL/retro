"""[15] Structured Output — ALT2: outlines (constrained decoding, guaranteed valid JSON)"""
from typing import Type, TypeVar

try:
    from pydantic import BaseModel
    _PYDANTIC_AVAILABLE = True
except ImportError:
    _PYDANTIC_AVAILABLE = False
    BaseModel = object  # type: ignore

T = TypeVar("T")


def extract(model_class: Type[T], prompt: str, model_name: str = "mistralai/Mistral-7B-Instruct-v0.2") -> T | None:
    """
    outlines: constrained generation — output dijamin sesuai schema.
    Butuh model lokal atau vLLM. Lebih berat tapi guaranteed valid.
    """
    try:
        import outlines
        model = outlines.models.transformers(model_name)
        generator = outlines.generate.json(model, model_class)
        return generator(prompt)
    except ImportError:
        return None
    except Exception:
        return None
