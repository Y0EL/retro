"""[19] Logging — ALT2: stdlib logging (zero dependency)"""
import logging
import sys


def get_logger(name: str = "retro"):
    """Standard library logging. Zero dependency fallback."""
    log = logging.getLogger(name)
    if not log.handlers:
        h = logging.StreamHandler(sys.stdout)
        h.setFormatter(logging.Formatter("[%(levelname)-5s] %(name)s | %(message)s"))
        log.addHandler(h)
        log.setLevel(logging.INFO)
    return log
