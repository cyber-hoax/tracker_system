from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional

from tracker.paths import progress_db_path

SUBJECTS = ("dsa", "lld", "hld", "ai", "reading", "walk", "review", "other")


@contextmanager
def connect():
    path = progress_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    try:
        init_db(conn)
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            subject TEXT NOT NULL,
            minutes INTEGER NOT NULL DEFAULT 0,
            notes TEXT NOT NULL DEFAULT '',
            problems_count INTEGER NOT NULL DEFAULT 0,
            extra TEXT NOT NULL DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS weekly_reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            week_start TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            dsa TEXT NOT NULL DEFAULT '',
            lld TEXT NOT NULL DEFAULT '',
            hld TEXT NOT NULL DEFAULT '',
            ai TEXT NOT NULL DEFAULT '',
            personal TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """
    )


def week_start_iso(moment: datetime) -> str:
    monday = moment.date() - timedelta(days=moment.weekday())
    return monday.isoformat()


def add_session(
    subject: str,
    minutes: int = 0,
    notes: str = "",
    problems_count: int = 0,
    extra: Optional[Dict[str, Any]] = None,
    ts: Optional[str] = None,
) -> Dict[str, Any]:
    subject = (subject or "other").lower()
    if subject not in SUBJECTS:
        subject = "other"
    payload = {
        "ts": ts or datetime.now().isoformat(timespec="seconds"),
        "subject": subject,
        "minutes": max(0, int(minutes or 0)),
        "notes": notes or "",
        "problems_count": max(0, int(problems_count or 0)),
        "extra": json.dumps(extra or {}),
    }
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO sessions (ts, subject, minutes, notes, problems_count, extra)
            VALUES (:ts, :subject, :minutes, :notes, :problems_count, :extra)
            """,
            payload,
        )
        payload["id"] = cursor.lastrowid
    return payload


def save_review(week_start: str, body: Dict[str, str]) -> Dict[str, Any]:
    record = {
        "week_start": week_start,
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "dsa": body.get("dsa") or "",
        "lld": body.get("lld") or "",
        "hld": body.get("hld") or "",
        "ai": body.get("ai") or "",
        "personal": body.get("personal") or "",
    }
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO weekly_reviews (week_start, created_at, dsa, lld, hld, ai, personal)
            VALUES (:week_start, :created_at, :dsa, :lld, :hld, :ai, :personal)
            ON CONFLICT(week_start) DO UPDATE SET
                created_at=excluded.created_at,
                dsa=excluded.dsa,
                lld=excluded.lld,
                hld=excluded.hld,
                ai=excluded.ai,
                personal=excluded.personal
            """,
            record,
        )
    return record


def recent_sessions(limit: int = 20) -> List[Dict[str, Any]]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM sessions ORDER BY ts DESC, id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def get_review(week_start: str) -> Optional[Dict[str, Any]]:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM weekly_reviews WHERE week_start = ?",
            (week_start,),
        ).fetchone()
    return dict(row) if row else None


def stats_for_week(moment: datetime) -> Dict[str, Any]:
    start = week_start_iso(moment)
    end_date = date.fromisoformat(start) + timedelta(days=7)
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM sessions WHERE ts >= ? AND ts < ?",
            (start, end_date.isoformat()),
        ).fetchall()
        total_row = conn.execute(
            "SELECT COALESCE(SUM(problems_count), 0) AS n FROM sessions WHERE subject = 'dsa'"
        ).fetchone()
    by_subject: Dict[str, Dict[str, int]] = {}
    walk_days = set()
    reading_days = set()
    for row in rows:
        subject = row["subject"]
        bucket = by_subject.setdefault(subject, {"minutes": 0, "sessions": 0, "problems": 0})
        bucket["minutes"] += int(row["minutes"] or 0)
        bucket["sessions"] += 1
        bucket["problems"] += int(row["problems_count"] or 0)
        day = str(row["ts"])[:10]
        if subject == "walk":
            walk_days.add(day)
        if subject == "reading":
            reading_days.add(day)
    return {
        "week_start": start,
        "by_subject": by_subject,
        "walk_days": len(walk_days),
        "reading_days": len(reading_days),
        "dsa_problems_total": int(total_row["n"] if total_row else 0),
        "dsa_problems_week": by_subject.get("dsa", {}).get("problems", 0),
        "study_minutes_week": sum(
            by_subject.get(key, {}).get("minutes", 0) for key in ("dsa", "lld", "hld", "ai")
        ),
        "review": get_review(start),
    }


def set_setting(key: str, value: str) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value),
        )


def get_setting(key: str, default: str = "") -> str:
    with connect() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return str(row["value"]) if row else default
