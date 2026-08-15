from __future__ import annotations

import subprocess
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Tuple

from tracker.config import AppConfig
from tracker.paths import ics_path
from tracker.progress import get_setting, set_setting
from tracker.schedule import DAY_KEYS, block_window, load_routine

BYDAY = {
    "mon": "MO",
    "tue": "TU",
    "wed": "WE",
    "thu": "TH",
    "fri": "FR",
    "sat": "SA",
    "sun": "SU",
}

SKIP_KINDS = {"work", "buffer"}
ALERT_KINDS = {"study", "walk", "reading", "shutdown", "maintenance", "meal"}


def _fold(line: str) -> str:
    if len(line) <= 73:
        return line
    chunks = [line[:73]]
    rest = line[73:]
    while rest:
        chunks.append(" " + rest[:72])
        rest = rest[72:]
    return "\r\n".join(chunks)


def _ics_text(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def grouped_events(routine: Dict[str, Any]) -> List[Dict[str, Any]]:
    groups: Dict[Tuple[str, str, str, str], Dict[str, Any]] = {}
    for day_key in DAY_KEYS:
        spec = routine["days"][day_key]
        for block in spec["blocks"]:
            if block.get("kind") in SKIP_KINDS:
                continue
            if block.get("kind") == "free" and (block.get("subject") or "none") == "none":
                continue
            key = (block["start"], block["end"], block["title"])
            item = groups.setdefault(
                key,
                {
                    "start": block["start"],
                    "end": block["end"],
                    "title": block["title"],
                    "guide": block.get("guide") or "",
                    "kind": block.get("kind") or "study",
                    "days": [],
                },
            )
            item["days"].append(day_key)
    events = list(groups.values())
    events.sort(key=lambda item: (item["start"], item["title"]))
    return events


def next_weekday_on_or_after(start: date, day_key: str) -> date:
    target = DAY_KEYS.index(day_key)
    delta = (target - start.weekday()) % 7
    return start + timedelta(days=delta)


def _dtstamp() -> str:
    return datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")


def build_ics(cfg: AppConfig) -> str:
    routine = load_routine(cfg.routine_path)
    events = grouped_events(routine)
    plan_start = cfg.plan_start
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//SDE Routine Tracker//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:%s" % cfg.calendar_name,
        "X-WR-TIMEZONE:%s" % cfg.timezone,
        "BEGIN:VTIMEZONE",
        "TZID:Asia/Kolkata",
        "X-LIC-LOCATION:Asia/Kolkata",
        "BEGIN:STANDARD",
        "TZOFFSETFROM:+0530",
        "TZOFFSETTO:+0530",
        "TZNAME:IST",
        "DTSTART:19700101T000000",
        "END:STANDARD",
        "END:VTIMEZONE",
    ]
    for index, event in enumerate(events, start=1):
        first_day = event["days"][0]
        start_date = next_weekday_on_or_after(plan_start, first_day)
        start_dt, end_dt = block_window(start_date, event["start"], event["end"], cfg.timezone)
        byday = ",".join(BYDAY[day] for day in event["days"])
        uid = "tracker-%s-%s-%s@sde-prep.local" % (event["start"].replace(":", ""), index, byday.lower())
        stamp_start = start_dt.strftime("%Y%m%dT%H%M%S")
        stamp_end = end_dt.strftime("%Y%m%dT%H%M%S")
        lines.extend(
            [
                "BEGIN:VEVENT",
                "UID:%s" % uid,
                "DTSTAMP:%s" % _dtstamp(),
                "DTSTART;TZID=Asia/Kolkata:%s" % stamp_start,
                "DTEND;TZID=Asia/Kolkata:%s" % stamp_end,
                "RRULE:FREQ=WEEKLY;BYDAY=%s" % byday,
                _fold("SUMMARY:%s" % _ics_text(event["title"])),
                _fold("DESCRIPTION:%s" % _ics_text(event["guide"])),
                "LOCATION:SDE prep routine",
                "BEGIN:VALARM",
                "ACTION:DISPLAY",
                "DESCRIPTION:%s" % _ics_text(event["title"]),
                "TRIGGER:PT0S",
                "END:VALARM",
                "END:VEVENT",
            ]
        )
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def write_ics(cfg: AppConfig) -> str:
    path = ics_path()
    path.write_text(build_ics(cfg), encoding="utf-8")
    return str(path)


def _applescript_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _ensure_calendar_script(name: str) -> str:
    safe = _applescript_escape(name)
    return f'''
tell application "Calendar"
    activate
    if not (exists calendar "{safe}") then
        create calendar with name "{safe}"
    end if
end tell
'''


def _clear_and_create_script(cfg: AppConfig, events: List[Dict[str, Any]]) -> str:
    safe_cal = _applescript_escape(cfg.calendar_name)
    chunks = [
        'tell application "Calendar"',
        "    activate",
        f'    if not (exists calendar "{safe_cal}") then',
        f'        create calendar with name "{safe_cal}"',
        "    end if",
        f'    tell calendar "{safe_cal}"',
        "        delete every event",
        "    end tell",
    ]
    for event in events:
        first_day = event["days"][0]
        start_date = next_weekday_on_or_after(cfg.plan_start, first_day)
        start_dt, end_dt = block_window(start_date, event["start"], event["end"], cfg.timezone)
        byday = ",".join(BYDAY[day] for day in event["days"])
        summary = _applescript_escape(event["title"])
        description = _applescript_escape(event["guide"][:500])
        chunks.extend(
            [
                "    set startDate to current date",
                f"    set year of startDate to {start_dt.year}",
                f"    set month of startDate to {start_dt.month}",
                f"    set day of startDate to {start_dt.day}",
                f"    set hours of startDate to {start_dt.hour}",
                f"    set minutes of startDate to {start_dt.minute}",
                "    set seconds of startDate to 0",
                "    set endDate to current date",
                f"    set year of endDate to {end_dt.year}",
                f"    set month of endDate to {end_dt.month}",
                f"    set day of endDate to {end_dt.day}",
                f"    set hours of endDate to {end_dt.hour}",
                f"    set minutes of endDate to {end_dt.minute}",
                "    set seconds of endDate to 0",
                f'    tell calendar "{safe_cal}"',
                f'        set ev to make new event with properties {{summary:"{summary}", start date:startDate, end date:endDate, description:"{description}"}}',
                f'        try',
                f'            set recurrence of ev to "FREQ=WEEKLY;BYDAY={byday}"',
                f'        end try',
                f'        try',
                f'            make new display alarm at end of display alarms of ev with properties {{trigger interval:0}}',
                f'        end try',
                "    end tell",
            ]
        )
    chunks.append("end tell")
    return "\n".join(chunks)


def _run_osascript(script: str, timeout: int = 30) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(
            ["osascript", "-e", script],
            capture_output=True,
            text=True,
            check=False,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        result = subprocess.CompletedProcess(
            args=["osascript"],
            returncode=1,
            stdout=exc.stdout or "",
            stderr="Calendar timed out waiting for permission or AppleScript.",
        )
        return result


def sync_calendar(cfg: AppConfig, open_ics_fallback: bool = True) -> Dict[str, Any]:
    routine = load_routine(cfg.routine_path)
    events = grouped_events(routine)
    ics = write_ics(cfg)
    created = False
    method = "ics"
    error = ""

    ensure = _run_osascript(_ensure_calendar_script(cfg.calendar_name), timeout=60)
    create = _run_osascript(_clear_and_create_script(cfg, events), timeout=180)
    if create.returncode == 0:
        created = True
        method = "calendar_app"
    else:
        error = (create.stderr or create.stdout or ensure.stderr or "").strip()
        if open_ics_fallback:
            subprocess.run(["open", "-a", "Calendar", ics], check=False)
            method = "ics_open"

    set_setting("last_calendar_sync", datetime.now().isoformat(timespec="seconds"))
    set_setting("calendar_sync_method", method)
    return {
        "ok": created or method == "ics_open",
        "method": method,
        "ics_path": ics,
        "event_count": len(events),
        "calendar_name": cfg.calendar_name,
        "error": error,
        "last_sync": get_setting("last_calendar_sync"),
    }


def notify(title: str, message: str) -> None:
    safe_title = _applescript_escape(title)
    safe_message = _applescript_escape(message)
    script = (
        f'display notification "{safe_message}" with title "{safe_title}" sound name "Glass"'
    )
    _run_osascript(script)
