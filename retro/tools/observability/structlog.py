"""[19] Logging / Observability — MAIN: structlog (structured JSON logging)"""
import sys

_CONFIGURED = False


def get_logger(name: str = "retro"):
    """structlog logger dengan konsol renderer. Production-ready structured logging."""
    global _CONFIGURED
    try:
        import structlog
        if not _CONFIGURED:
            structlog.configure(
                processors=[
                    structlog.stdlib.add_log_level,
                    structlog.stdlib.add_logger_name,
                    structlog.processors.TimeStamper(fmt="%H:%M:%S", utc=False),
                    structlog.dev.ConsoleRenderer(colors=sys.stdout.isatty()),
                ],
                wrapper_class=structlog.make_filtering_bound_logger(20),
                logger_factory=structlog.PrintLoggerFactory(),
                cache_logger_on_first_use=True,
            )
            _CONFIGURED = True
        return structlog.get_logger(name)
    except ImportError:
        return _Fallback(name)


class _Fallback:
    def __init__(self, name: str): self.name = name
    def _log(self, lvl: str, event: str, **kw):
        extras = " | ".join(f"{k}={v}" for k, v in kw.items())
        print(f"[{lvl:5}] {self.name} | {event}" + (f" | {extras}" if extras else ""))
    def info(self, e, **kw): self._log("INFO", e, **kw)
    def warning(self, e, **kw): self._log("WARN", e, **kw)
    def error(self, e, **kw): self._log("ERROR", e, **kw)
    def debug(self, e, **kw): self._log("DEBUG", e, **kw)
    def bind(self, **kw): return self
