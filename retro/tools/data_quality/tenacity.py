"""[17] Data Quality — MAIN: tenacity (retry dengan backoff untuk unstable calls)"""
from typing import Callable, Any

try:
    from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
    _AVAILABLE = True
except ImportError:
    _AVAILABLE = False


def with_retry(func: Callable, max_attempts: int = 3, min_wait: float = 1.0, max_wait: float = 10.0) -> Callable:
    """Dekorasikan func dengan tenacity retry (exponential backoff)."""
    if not _AVAILABLE:
        return func
    return retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=min_wait, max=max_wait),
        retry=retry_if_exception_type((Exception,)),
        reraise=True,
    )(func)


def safe_call(func: Callable, *args, default=None, max_attempts: int = 3, **kwargs) -> Any:
    """Call func dengan retry. Jika gagal semua, return default."""
    wrapped = with_retry(func, max_attempts)
    try:
        return wrapped(*args, **kwargs)
    except Exception:
        return default


def deduplicate(items: list[dict], key: str) -> list[dict]:
    """Hapus duplikat dari list of dicts berdasarkan key."""
    seen = set()
    result = []
    for item in items:
        val = item.get(key,"")
        if val and val not in seen:
            seen.add(val)
            result.append(item)
    return result


def clean_text(text: str) -> str:
    """Basic text cleaning: strip whitespace, normalize unicode."""
    import re, unicodedata
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text
