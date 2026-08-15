from __future__ import annotations

import socket
import sys
import threading
import webbrowser
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from tracker.calendar_sync import sync_calendar
from tracker.coach import build_briefing
from tracker.config import AppConfig, load_config
from tracker.notifier import start_notifier
from tracker.paths import PACKAGE_DIR
from tracker.progress import add_session, recent_sessions, save_review, stats_for_week, week_start_iso
from tracker.schedule import now_in_tz

STATIC_DIR = PACKAGE_DIR / "static"


class SessionIn(BaseModel):
    subject: str
    minutes: int = 0
    notes: str = ""
    problems_count: int = 0
    extra: Dict[str, Any] = Field(default_factory=dict)


class ReviewIn(BaseModel):
    week_start: Optional[str] = None
    dsa: str = ""
    lld: str = ""
    hld: str = ""
    ai: str = ""
    personal: str = ""


def create_app(cfg: Optional[AppConfig] = None) -> FastAPI:
    cfg = cfg or load_config()
    app = FastAPI(title="SDE Routine Tracker", docs_url=None, redoc_url=None)

    @app.get("/api/health")
    def health() -> Dict[str, Any]:
        return {"ok": True}

    @app.get("/api/briefing")
    def briefing() -> Dict[str, Any]:
        return build_briefing(cfg)

    @app.get("/api/sessions")
    def sessions() -> Dict[str, Any]:
        moment = now_in_tz(cfg.timezone)
        return {
            "recent": recent_sessions(30),
            "stats": stats_for_week(moment),
        }

    @app.post("/api/sessions")
    def create_session(body: SessionIn) -> Dict[str, Any]:
        record = add_session(
            subject=body.subject,
            minutes=body.minutes,
            notes=body.notes,
            problems_count=body.problems_count,
            extra=body.extra,
        )
        return {"ok": True, "session": record, "briefing": build_briefing(cfg)}

    @app.post("/api/reviews")
    def create_review(body: ReviewIn) -> Dict[str, Any]:
        moment = now_in_tz(cfg.timezone)
        week_start = body.week_start or week_start_iso(moment)
        record = save_review(
            week_start,
            {
                "dsa": body.dsa,
                "lld": body.lld,
                "hld": body.hld,
                "ai": body.ai,
                "personal": body.personal,
            },
        )
        return {"ok": True, "review": record, "briefing": build_briefing(cfg)}

    @app.post("/api/calendar/sync")
    def calendar() -> Dict[str, Any]:
        try:
            result = sync_calendar(cfg)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        return result

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")

    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    return app


def _port_open(host: str, port: int) -> bool:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.4)
    try:
        return sock.connect_ex((host, port)) == 0
    finally:
        sock.close()


def serve(cfg: Optional[AppConfig] = None, open_browser: bool = False) -> None:
    cfg = cfg or load_config()
    url = f"http://{cfg.host}:{cfg.port}"
    if _port_open(cfg.host, cfg.port):
        if open_browser:
            webbrowser.open(url)
        sys.exit(0)

    start_notifier(cfg)
    if open_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    import uvicorn

    uvicorn.run(
        create_app(cfg),
        host=cfg.host,
        port=cfg.port,
        log_level="info",
    )
