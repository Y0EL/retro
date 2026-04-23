"""[19] Logging — ALT1: loguru (developer-friendly, colorful, zero config)"""
import sys


def get_logger():
    """loguru logger. Colorful output, zero setup, perfect untuk development."""
    try:
        from loguru import logger
        logger.remove()
        logger.add(sys.stderr, format="<green>{time:HH:mm:ss}</green> | <level>{level:<8}</level> | <cyan>{name}</cyan> | {message}", level="INFO", colorize=True)
        return logger
    except ImportError:
        from .alt2 import get_logger as stdlib_logger
        return stdlib_logger()
