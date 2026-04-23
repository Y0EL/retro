from . import structlog, loguru, stdlib

def get_logger(name: str = "retro", prefer: str = "structlog"):
    if prefer == "loguru": return loguru.get_logger()
    if prefer == "stdlib": return stdlib.get_logger(name)
    return structlog.get_logger(name)

def log_node_start(node: str, **kw): get_logger("retro.pipeline").info("node_start", node=node, **kw)
def log_node_done(node: str, **kw):  get_logger("retro.pipeline").info("node_done",  node=node, **kw)
def log_error(node: str, error: str, **kw): get_logger("retro.pipeline").error("node_error", node=node, error=error, **kw)
def log_summary(stats: dict): get_logger("retro.pipeline").info("pipeline_complete", **stats)
