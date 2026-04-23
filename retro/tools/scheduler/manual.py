"""[08] Scheduler — ALT2: manual trigger (blocking loop, zero dependency)"""
import time
from datetime import datetime
from typing import Callable


def run(func: Callable, interval_seconds: int = 86400, max_runs: int = 0, **kwargs) -> None:
    """Blocking loop. max_runs=0 → jalan selamanya. Untuk dev/testing."""
    count = 0
    print(f"[scheduler:manual] interval={interval_seconds}s max={'∞' if max_runs==0 else max_runs}")
    while True:
        try:
            print(f"[scheduler:manual] run #{count+1} @ {datetime.now().strftime('%H:%M:%S')}")
            func(**kwargs)
            count += 1
            if max_runs > 0 and count >= max_runs:
                break
            time.sleep(interval_seconds)
        except KeyboardInterrupt:
            print("\n[scheduler:manual] stopped")
            break
        except Exception as e:
            print(f"[scheduler:manual] error: {e}")
            time.sleep(60)
