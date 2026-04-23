from typing import Callable
from . import apscheduler, schedule_lib, manual

def start_schedule(func: Callable, cron: str = "0 8 * * 1-5", prefer: str = "apscheduler", **kwargs) -> dict:
    if prefer == "schedule":
        h, m = cron.split()[1], cron.split()[0]
        return schedule_lib.schedule_daily(func, at=f"{int(h):02d}:{int(m):02d}")
    if prefer == "manual":
        import threading
        t = threading.Thread(target=manual.run, args=(func,), kwargs=kwargs, daemon=True)
        t.start()
        return {"success": True, "tool": "manual", "thread": t.ident}
    r = apscheduler.schedule_cron(func, cron, **kwargs)
    if not r["success"]: return schedule_lib.schedule_daily(func)
    return r
