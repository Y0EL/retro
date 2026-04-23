"""[17] Data Quality — ALT2: pydantic validators (model-level validation)"""
from typing import Any

try:
    from pydantic import BaseModel, ValidationError
    _PYDANTIC_AVAILABLE = True
except ImportError:
    _PYDANTIC_AVAILABLE = False
    BaseModel = object  # type: ignore
    ValidationError = Exception  # type: ignore


def validate_with_model(model_class: type[BaseModel], data: dict | list[dict]) -> dict:
    """Validasi satu atau banyak dict menggunakan Pydantic model."""
    if isinstance(data, dict):
        try:
            obj = model_class(**data)
            return {"success": True, "data": obj.model_dump(), "errors": [], "tool": "pydantic"}
        except ValidationError as e:
            return {"success": False, "errors": e.errors(), "tool": "pydantic"}

    results, errors = [], []
    for i, item in enumerate(data):
        try:
            results.append(model_class(**item).model_dump())
        except ValidationError as e:
            errors.append({"index": i, "errors": e.errors()})
    return {"success": len(errors) == 0, "valid": results, "invalid_count": len(errors), "errors": errors, "tool": "pydantic"}


def coerce_types(data: dict, schema: dict[str, type]) -> dict:
    """Paksa tipe data sesuai schema. schema: {field: type}"""
    out = {}
    for k, v in data.items():
        target = schema.get(k)
        try:
            out[k] = target(v) if target and v is not None else v
        except Exception:
            out[k] = v
    return out
