from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from tracker.config import AppConfig
from tracker.progress import stats_for_week
from tracker.schedule import current_and_next

KIND_COACHING = {
    "maintenance": "This is maintenance time, not study time. Keep it short and predictable.",
    "work": "Work block. The learning plan starts after work, not during it.",
    "break": "Protect the break. The routine is built around recovery between focus blocks.",
    "meal": "If dinner moves, move the walk and the next study block with it. Do not compress.",
    "walk": "Keep the 20-minute walk. It is a non-negotiable, not leftover time.",
    "reading": "Thirty minutes of reading. Do not convert this into another technical session.",
    "shutdown": "Close the day. Prepare tomorrow, then sleep. Do not bargain for extra study.",
    "personal": "Protected personal time. Long-term consistency beats maximizing today.",
    "free": "Free time is part of the plan. Use some of Sunday evening for the weekly review.",
    "buffer": "Transition time. No need to fill it with a problem.",
    "study": "Stay on the assigned subject. Depth over extra hours.",
}


def _subject_line(snapshot: Dict[str, Any], stats: Dict[str, Any]) -> str:
    current = snapshot.get("current") or {}
    subject = current.get("subject")
    phase = snapshot.get("phase") or {}
    topics = phase.get("topics") or []
    if subject == "dsa":
        solved = stats.get("dsa_problems_total") or 0
        topic = topics[solved % len(topics)] if topics else "pattern practice"
        flow = " → ".join(snapshot.get("dsa_explain_flow") or [])
        if snapshot.get("day_kind") == "weekend_review":
            return (
                f"Timed DSA mock. Do not look up the pattern immediately. "
                f"Target topic family: {topic}. After each problem, explain: {flow}."
            )
        return (
            f"DSA focus: {topic}. One serious problem plus review, not two rushed ones. "
            f"Explain: {flow}."
        )
    if subject == "lld":
        return (
            "LLD: finish a complete design slice. Name interfaces, composition vs inheritance, "
            "and what change would require the smallest modification."
        )
    if subject == "hld":
        return (
            "HLD: go past Client → API → Service → DB. Answer why this design instead of another, "
            "including failure modes and operational complexity."
        )
    if subject == "ai":
        return (
            "AI internals, not wrappers. Continue the current project slice: data flow from tokens "
            "to embeddings to attention to logits to sampling — then implement one piece."
        )
    if subject == "review":
        return (
            "Capture the weekly review before the week disappears: DSA, LLD, HLD, AI, sleep, walks, reading, energy."
        )
    if subject == "walk":
        return "Twenty minutes outside. This is the transition, not optional overflow."
    if subject == "reading":
        return "Read for thirty minutes. Leave technical study alone."
    if current.get("kind") == "free" and snapshot.get("day_kind") != "weekend_review":
        return "Evening is free. Keep dinner, the walk, and reading — do not add extra study by default."
    return KIND_COACHING.get(current.get("kind") or "buffer", "Follow the current block.")


def _habit_nudge(snapshot: Dict[str, Any], stats: Dict[str, Any]) -> List[str]:
    nudges: List[str] = []
    day_kind = snapshot.get("day_kind")
    if day_kind == "deep_work":
        nudges.append(
            "Thursday is the highest-value weekday. Use focused blocks with breaks — not a five-hour grind."
        )
    if day_kind == "weekend_focus":
        nudges.append(
            "Saturday target is 4–5 focused hours: 2h DSA, 1.5h LLD, 1.5h AI. Evening stays free."
        )
    if day_kind == "weekend_review":
        if not stats.get("review"):
            nudges.append("Sunday includes the weekly review. Fill it before the night ends.")
        nudges.append("Keep recovery after 5:30 PM. Mocks already happened.")
    walk_days = stats.get("walk_days") or 0
    reading_days = stats.get("reading_days") or 0
    if walk_days < 5:
        nudges.append(f"Walks logged this week: {walk_days}. Keep the daily 20-minute walk.")
    if reading_days < 5:
        nudges.append(f"Reading days this week: {reading_days}. Keep the 30-minute book block.")
    hours = round((stats.get("study_minutes_week") or 0) / 60, 1)
    nudges.append(f"Focused study logged this week: {hours}h. Weekly target is about 20h, not more.")
    return nudges[:5]


def build_briefing(cfg: AppConfig, moment: datetime | None = None) -> Dict[str, Any]:
    snapshot = current_and_next(cfg, moment)
    stats = stats_for_week(datetime.fromisoformat(snapshot["now"]))
    current = snapshot.get("current")
    nxt = snapshot.get("next")
    if current:
        headline = f"Now: {current['title']} ({current['start']}–{current['end']})"
        remaining = current.get("remaining_min")
        remaining_line = f"{remaining} minutes left in this block." if remaining is not None else ""
        guidance = [current.get("guide") or "", remaining_line, _subject_line(snapshot, stats)]
    else:
        headline = "Between blocks"
        remaining_line = "Nothing is scheduled right now."
        if nxt:
            remaining_line = f"Next is {nxt['title']} at {nxt['start']}."
        guidance = [remaining_line, snapshot.get("day_summary") or ""]

    return {
        **snapshot,
        "headline": headline,
        "guidance": [line for line in guidance if line] + _habit_nudge(snapshot, stats),
        "stats": stats,
        "restart_note": (
            "Opened after login. Follow the current block. Do not try to catch up missed morning "
            "study — the plan never scheduled technical work before the evening."
        ),
    }
