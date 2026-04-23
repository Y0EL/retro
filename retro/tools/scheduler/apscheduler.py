"""[08] Scheduler — MAIN: APScheduler (production-grade, cron + interval)"""
from typing import Callable

_SCHEDULER = None


def _get():
    global _SCHEDULER
    if _SCHEDULER is None:
        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            _SCHEDULER = BackgroundScheduler(timezone="Asia/Jakarta")
        except ImportError:
            _SCHEDULER = "unavailable"
    return _SCHEDULER if _SCHEDULER != "unavailable" else None


def schedule_cron(func: Callable, cron: str = "0 8 * * 1-5", job_id: str = "retro", **kwargs) -> dict:
    """Jadwalkan func dengan ekspresi cron. Default: setiap hari kerja 08:00 WIB."""
    sched = _get()
    if sched is None:
        return {"success": False, "error": "apscheduler not installed", "tool": "apscheduler"}
    try:
        m, h, d, mo, dow = cron.split()
        if not sched.running:
            sched.start()
        sched.add_job(func, "cron", minute=m, hour=h, day=d, month=mo, day_of_week=dow, id=job_id, replace_existing=True, kwargs=kwargs)
        return {"success": True, "job_id": job_id, "cron": cron, "next_run": str(sched.get_job(job_id).next_run_time), "tool": "apscheduler"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "apscheduler"}


def schedule_interval(func: Callable, hours: int = 24, job_id: str = "retro_interval", **kwargs) -> dict:
    sched = _get()
    if sched is None:
        return {"success": False, "error": "apscheduler not installed", "tool": "apscheduler"}
    try:
        if not sched.running:
            sched.start()
        sched.add_job(func, "interval", hours=hours, id=job_id, replace_existing=True, kwargs=kwargs)
        return {"success": True, "job_id": job_id, "interval_hours": hours, "tool": "apscheduler"}
    except Exception as e:
        return {"success": False, "error": str(e), "tool": "apscheduler"}


def stop():
    sched = _get()
    if sched and sched.running:
        sched.shutdown(wait=False)
