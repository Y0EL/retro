from . import instructor, json_parse, outlines

def extract_structured(model_class, messages: list, llm_model=None, prefer: str = "instructor"):
    if prefer == "json": return json_parse.llm_then_parse(model_class, messages, llm_model)
    r = instructor.extract(model_class, messages, llm_model)
    if r is None: r = json_parse.llm_then_parse(model_class, messages, llm_model)
    return r
