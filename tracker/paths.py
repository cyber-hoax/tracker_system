from __future__ import annotations

import sys
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
REPO_ROOT = PACKAGE_DIR.parent
SUPPORT_DIR = Path.home() / "Library" / "Application Support" / "SDERoutineTracker"
LOG_DIR = Path.home() / "Library" / "Logs" / "SDERoutineTracker"
LAUNCH_AGENT_LABEL = "com.cyberhoax.sde-routine-tracker"
LAUNCH_AGENT_PATH = Path.home() / "Library" / "LaunchAgents" / f"{LAUNCH_AGENT_LABEL}.plist"


def support_dir() -> Path:
    SUPPORT_DIR.mkdir(parents=True, exist_ok=True)
    return SUPPORT_DIR


def log_dir() -> Path:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    return LOG_DIR


def progress_db_path() -> Path:
    return support_dir() / "progress.db"


def ics_path() -> Path:
    return support_dir() / "sde_prep.ics"


def runtime_venv_python() -> Path:
    return support_dir() / "venv" / "bin" / "python"


def using_login_runtime() -> bool:
    try:
        return support_dir().resolve() in Path(sys.executable).resolve().parents
    except OSError:
        return False


def config_path() -> Path:
    support_config = support_dir() / "config.yaml"
    repo_config = REPO_ROOT / "config.yaml"
    if using_login_runtime() and support_config.exists():
        return support_config
    if repo_config.exists():
        return repo_config
    return support_config


def routine_path() -> Path:
    support_routine = support_dir() / "routine.json"
    repo_routine = REPO_ROOT / "data" / "routine.json"
    packaged = PACKAGE_DIR / "routine.json"
    if using_login_runtime() and support_routine.exists():
        return support_routine
    if repo_routine.exists():
        return repo_routine
    if support_routine.exists():
        return support_routine
    return packaged
