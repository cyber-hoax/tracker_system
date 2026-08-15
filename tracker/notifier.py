from __future__ import annotations

import threading
from typing import Optional

from tracker.calendar_sync import notify
from tracker.coach import build_briefing
from tracker.config import AppConfig

_stop = threading.Event()
_thread: Optional[threading.Thread] = None
_last_key = ""


def _block_key(briefing: dict) -> str:
    current = briefing.get("current") or {}
    return "%s|%s|%s" % (briefing.get("day_key"), current.get("start"), current.get("title"))


def _loop(cfg: AppConfig) -> None:
    global _last_key
    while not _stop.is_set():
        try:
            briefing = build_briefing(cfg)
            key = _block_key(briefing)
            current = briefing.get("current")
            if key != _last_key and current:
                title = current.get("title") or "Routine"
                remaining = current.get("remaining_min")
                suffix = f"{current.get('start')}–{current.get('end')}"
                if remaining is not None:
                    suffix = f"{suffix} · {remaining} min left"
                guide = (current.get("guide") or "")[:120]
                notify(f"{title} starts", f"{suffix}. {guide}")
            _last_key = key
        except Exception:
            pass
        _stop.wait(30)


def start_notifier(cfg: AppConfig) -> None:
    global _thread
    if not cfg.notify_on_block_start:
        return
    if _thread and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, args=(cfg,), daemon=True)
    _thread.start()


def stop_notifier() -> None:
    _stop.set()
