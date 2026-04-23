"""[07] LLM Agent — ALT2: Groq SDK direct (minimal, zero LangChain overhead)"""


def complete(messages: list[dict], model: str | None = None, temperature: float = 0.3, max_tokens: int = 2048) -> dict:
    """Groq SDK langsung. Paling ringan untuk one-shot calls."""
    try:
        import groq
        from retro.config import get_settings
        cfg = get_settings()
        client = groq.Groq(api_key=cfg.groq_api_key)
        resp = client.chat.completions.create(model=model or cfg.groq_model, messages=messages, temperature=temperature, max_tokens=max_tokens)
        return {
            "content": resp.choices[0].message.content,
            "model": resp.model,
            "usage": {"prompt_tokens": resp.usage.prompt_tokens, "completion_tokens": resp.usage.completion_tokens},
            "tool": "groq_sdk",
            "error": None,
        }
    except ImportError:
        return {"content": "", "tool": "groq_sdk", "error": "groq not installed"}
    except Exception as e:
        return {"content": "", "tool": "groq_sdk", "error": str(e)}
