"""[07] LLM Agent — ALT1: LiteLLM (100+ provider, ganti model = ganti string)"""


def complete(messages: list[dict], model: str | None = None, temperature: float = 0.3, max_tokens: int = 2048) -> dict:
    """
    LiteLLM unified interface. Ganti provider cukup ubah model string:
    'groq/llama-3.3-70b-versatile' | 'anthropic/claude-3-5-sonnet-20241022' | 'openai/gpt-4o'
    """
    try:
        import litellm
        from retro.config import get_settings
        cfg = get_settings()
        litellm_model = model or f"groq/{cfg.groq_model}"
        resp = litellm.completion(model=litellm_model, messages=messages, temperature=temperature, max_tokens=max_tokens)
        return {
            "content": resp.choices[0].message.content,
            "model": litellm_model,
            "usage": dict(resp.usage) if resp.usage else {},
            "tool": "litellm",
            "error": None,
        }
    except ImportError:
        return {"content": "", "tool": "litellm", "error": "litellm not installed"}
    except Exception as e:
        return {"content": "", "tool": "litellm", "error": str(e)}
