from . import langchain_groq, litellm, groq_sdk

def llm_complete(messages: list, model=None, temperature: float = 0.3, max_tokens: int = 2048, prefer: str = "langchain") -> dict:
    if prefer == "litellm": return litellm.complete(messages, model, temperature, max_tokens)
    if prefer == "groq": return groq_sdk.complete(messages, model, temperature, max_tokens)
    r = langchain_groq.complete(messages, model, temperature, max_tokens)
    if r.get("error") and "not installed" in (r["error"] or ""):
        r = groq_sdk.complete(messages, model, temperature, max_tokens)
    return r
