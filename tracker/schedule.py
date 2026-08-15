from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from tracker.config import AppConfig, load_config

DAY_KEYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
DAY_KEY_BY_WEEKDAY = {index: key for index, key in enumerate(DAY_KEYS)}


def load_routine(path=None) -> Dict[str, Any]:
    cfg = load_config()
    routine_path = path or cfg.routine_path
    with routine_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def now_in_tz(tz_name: str) -> datetime:
    return datetime.now(ZoneInfo(tz_name))


def parse_hm(value: str) -> time:
    hour_s, minute_s = value.split(":")
    hour = int(hour_s)
    minute = int(minute_s)
    if hour == 24:
        return time(0, minute)
    return time(hour, minute)


def block_window(day: date, start: str, end: str, tz_name: str):
    tz = ZoneInfo(tz_name)
    start_dt = datetime.combine(day, parse_hm(start), tzinfo=tz)
    end_dt = datetime.combine(day, parse_hm(end), tzinfo=tz)
    if end_dt <= start_dt:
        end_dt += timedelta(days=1)
    return start_dt, end_dt


def day_key_for(moment: datetime) -> str:
    return DAY_KEY_BY_WEEKDAY[moment.weekday()]


def iso_week_number(moment: datetime) -> int:
    return int(moment.isocalendar()[1])


def resolve_subject(block: Dict[str, Any], moment: datetime) -> str:
    subject = block.get("subject") or "none"
    if subject != "hld_lld_alt":
        return subject
    # Even ISO weeks: Thursday = HLD, Friday = LLD. Odd weeks: the reverse.
    even_week = iso_week_number(moment) % 2 == 0
    weekday = moment.weekday()
    if weekday == 3:  # Thursday
        return "hld" if even_week else "lld"
    if weekday == 4:  # Friday
        return "lld" if even_week else "hld"
    return "hld"


def resolve_title(block: Dict[str, Any], moment: datetime) -> str:
    subject = resolve_subject(block, moment)
    title = block.get("title") or "Block"
    if block.get("subject") == "hld_lld_alt":
        return subject.upper()
    return title


def phase_for(plan_start: date, today: date, routine: Dict[str, Any]) -> Dict[str, Any]:
    months_elapsed = (today.year - plan_start.year) * 12 + (today.month - plan_start.month)
    month_index = max(1, min(6, months_elapsed + 1))
    for phase in routine.get("phases") or []:
        if phase["start_month"] <= month_index <= phase["end_month"]:
            return {**phase, "month_index": month_index}
    last = (routine.get("phases") or [{}])[-1]
    return {**last, "month_index": month_index}


def enrich_block(block: Dict[str, Any], day: date, tz_name: str, moment: datetime) -> Dict[str, Any]:
    start_dt, end_dt = block_window(day, block["start"], block["end"], tz_name)
    remaining = max(0, int((end_dt - moment).total_seconds() // 60)) if start_dt <= moment < end_dt else None
    elapsed = max(0, int((moment - start_dt).total_seconds() // 60)) if start_dt <= moment < end_dt else None
    total = max(1, int((end_dt - start_dt).total_seconds() // 60))
    subject = resolve_subject(block, datetime.combine(day, parse_hm(block["start"]), tzinfo=ZoneInfo(tz_name)))
    return {
        "start": block["start"],
        "end": block["end"],
        "start_iso": start_dt.isoformat(),
        "end_iso": end_dt.isoformat(),
        "title": resolve_title(block, datetime.combine(day, parse_hm(block["start"]), tzinfo=ZoneInfo(tz_name))),
        "kind": block.get("kind") or "buffer",
        "subject": subject,
        "guide": block.get("guide") or "",
        "minutes": total,
        "remaining_min": remaining,
        "elapsed_min": elapsed,
        "progress_pct": int(min(100, round(100 * (elapsed or 0) / total))) if elapsed is not None else 0,
    }


def iter_blocks_for_day(routine: Dict[str, Any], day: date, tz_name: str) -> List[Dict[str, Any]]:
    key = DAY_KEY_BY_WEEKDAY[day.weekday()]
    day_spec = routine["days"][key]
    anchor = datetime.combine(day, time(12, 0), tzinfo=ZoneInfo(tz_name))
    return [enrich_block(block, day, tz_name, anchor) for block in day_spec["blocks"]]


def current_and_next(cfg: AppConfig, moment: Optional[datetime] = None) -> Dict[str, Any]:
    routine = load_routine(cfg.routine_path)
    moment = moment or now_in_tz(cfg.timezone)
    tz_name = cfg.timezone
    today = moment.date()
    yesterday = today - timedelta(days=1)

    current = None
    upcoming: List[Dict[str, Any]] = []

    for day in (yesterday, today, today + timedelta(days=1)):
        key = DAY_KEY_BY_WEEKDAY[day.weekday()]
        day_spec = routine["days"][key]
        for raw in day_spec["blocks"]:
            start_dt, end_dt = block_window(day, raw["start"], raw["end"], tz_name)
            enriched = enrich_block(raw, day, tz_name, moment)
            enriched["day"] = key
            enriched["date"] = day.isoformat()
            if start_dt <= moment < end_dt:
                current = enriched
            elif start_dt > moment:
                upcoming.append(enriched)

    upcoming.sort(key=lambda item: item["start_iso"])
    day_spec = routine["days"][day_key_for(moment)]
    return {
        "now": moment.isoformat(),
        "timezone": tz_name,
        "day_key": day_key_for(moment),
        "day_label": day_spec["label"],
        "day_kind": day_spec["kind"],
        "day_summary": day_spec["summary"],
        "current": current,
        "next": upcoming[0] if upcoming else None,
        "upcoming": upcoming[:6],
        "today": iter_blocks_for_day(routine, today, tz_name),
        "phase": phase_for(cfg.plan_start, today, routine),
        "non_negotiables": routine.get("non_negotiables") or [],
        "dsa_explain_flow": routine.get("dsa_explain_flow") or [],
        "weekly_hours": routine.get("weekly_hours") or {},
    }
