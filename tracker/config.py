from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Dict

import yaml

from tracker.paths import config_path, routine_path


@dataclass(frozen=True)
class AppConfig:
    timezone: str
    calendar_name: str
    plan_start: date
    host: str
    port: int
    open_on_login: bool
    notify_on_block_start: bool
    config_path: Path
    routine_path: Path


def load_yaml(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict):
        raise ValueError("config.yaml must contain a mapping")
    return data


def load_config(path: Path | None = None) -> AppConfig:
    resolved_config = path or config_path()
    raw = load_yaml(resolved_config)
    plan_start_raw = str(raw.get("plan_start") or date.today().isoformat())
    return AppConfig(
        timezone=str(raw.get("timezone") or "Asia/Kolkata"),
        calendar_name=str(raw.get("calendar_name") or "SDE Prep"),
        plan_start=date.fromisoformat(plan_start_raw),
        host=str(raw.get("host") or "127.0.0.1"),
        port=int(raw.get("port") or 8765),
        open_on_login=bool(raw.get("open_on_login", True)),
        notify_on_block_start=bool(raw.get("notify_on_block_start", True)),
        config_path=resolved_config,
        routine_path=routine_path(),
    )
