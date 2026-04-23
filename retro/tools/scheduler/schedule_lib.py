"""[08] Scheduler — ALT1: schedule lib (simple, human-readable syntax)"""
import time
from typing import Callable


def schedule_daily(func: Callable, at: str = "08:00") -> dict:
    """Jadwalkan func setiap hari pada jam tertentu."""
    try:
        import schedule
        schedule.every().day.at(at).do(func)
        return {"success": True, "schedule": f"daily at {at}", "tool": "schedule_lib"}
    except ImportError:
        return {"success": False, "error": "schedule not installed", "tool": "schedule_lib"}


def schedule_interval(func: Callable, hours: int = 24) -> dict:
    try:
        import schedule
        schedule.every(hours).hours.do(func)
        return {"success": True, "interval_hours": hours, "tool": "schedule_lib"}
    except ImportError:
        return {"success": False, "error": "schedule not installed", "tool": "schedule_lib"}


def run_loop(stop_event=None):
    """Blocking loop. Jalankan di thread terpisah."""
    try:
        import schedule
        while True:
            schedule.run_pending()
            time.sleep(60)
            if stop_event and stop_event.is_set():
                break
    except KeyboardInterrupt:
        pass
