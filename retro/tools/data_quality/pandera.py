"""[17] Data Quality — ALT1: pandera (schema validation untuk DataFrame)"""
from typing import Any


def validate_dataframe(df: Any, schema_def: dict) -> dict:
    """
    pandera: validasi DataFrame dengan schema. schema_def: {col: type_str}
    Contoh: {"company_name": "str", "confidence_score": "float"}
    """
    try:
        import pandera as pa
        import pandas as pd

        cols = {}
        type_map = {"str": pa.String, "int": pa.Int, "float": pa.Float, "bool": pa.Bool}
        for col, dtype in schema_def.items():
            pa_type = type_map.get(dtype, pa.String)
            cols[col] = pa.Column(pa_type, nullable=True)

        schema = pa.DataFrameSchema(cols, coerce=True)
        validated = schema.validate(df, lazy=True)
        return {"success": True, "rows": len(validated), "tool": "pandera", "errors": []}
    except ImportError:
        return {"success": False, "error": "pandera not installed", "tool": "pandera", "errors": []}
    except Exception as e:
        errors = []
        if hasattr(e, "failure_cases"):
            errors = e.failure_cases.to_dict("records") if hasattr(e.failure_cases, "to_dict") else [str(e)]
        return {"success": False, "error": str(e), "tool": "pandera", "errors": errors}


def validate_dict_list(data: list[dict], required_keys: list[str]) -> dict:
    """Validasi list of dicts punya semua required keys dan non-null."""
    errors = []
    for i, item in enumerate(data):
        for key in required_keys:
            if key not in item or item[key] is None or item[key] == "":
                errors.append({"row": i, "field": key, "issue": "missing_or_empty"})
    return {"success": len(errors) == 0, "errors": errors, "checked": len(data), "tool": "pandera_dict"}
