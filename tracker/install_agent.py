from __future__ import annotations

import os
import shutil
import subprocess
import sys
from textwrap import dedent

from tracker.config import AppConfig
from tracker.paths import (
    LAUNCH_AGENT_LABEL,
    LAUNCH_AGENT_PATH,
    REPO_ROOT,
    log_dir,
    runtime_venv_python,
    support_dir,
)


def venv_python() -> Path:
    return runtime_venv_python()


def _copy_runtime_files() -> None:
    target = support_dir()
    shutil.copy2(REPO_ROOT / "config.yaml", target / "config.yaml")
    shutil.copy2(REPO_ROOT / "data" / "routine.json", target / "routine.json")


def ensure_venv() -> Path:
    target = support_dir() / "venv"
    py = venv_python()
    _copy_runtime_files()
    if not py.exists():
        subprocess.run([sys.executable, "-m", "venv", str(target)], check=True)
    subprocess.run([str(py), "-m", "pip", "install", "--upgrade", "pip"], check=True)
    subprocess.run([str(py), "-m", "pip", "install", str(REPO_ROOT)], check=True)
    return py


def plist_body(cfg: AppConfig) -> str:
    python = venv_python()
    workdir = support_dir()
    stdout = log_dir() / "launchd.out.log"
    stderr = log_dir() / "launchd.err.log"
    return dedent(
        f"""\
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
          <key>Label</key>
          <string>{LAUNCH_AGENT_LABEL}</string>
          <key>WorkingDirectory</key>
          <string>{workdir}</string>
          <key>ProgramArguments</key>
          <array>
            <string>{python}</string>
            <string>-m</string>
            <string>tracker</string>
            <string>serve</string>
            <string>--open</string>
          </array>
          <key>RunAtLoad</key>
          <true/>
          <key>KeepAlive</key>
          <dict>
            <key>SuccessfulExit</key>
            <false/>
          </dict>
          <key>StandardOutPath</key>
          <string>{stdout}</string>
          <key>StandardErrorPath</key>
          <string>{stderr}</string>
          <key>EnvironmentVariables</key>
          <dict>
            <key>PATH</key>
            <string>/usr/bin:/bin:/usr/sbin:/sbin:{python.parent}</string>
            <key>PYTHONUNBUFFERED</key>
            <string>1</string>
          </dict>
        </dict>
        </plist>
        """
    )


def _uid() -> str:
    return str(os.getuid())


def _launchctl(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(["launchctl", *args], capture_output=True, text=True, check=False)


def install_launch_agent(cfg: AppConfig) -> dict:
    ensure_venv()
    LAUNCH_AGENT_PATH.parent.mkdir(parents=True, exist_ok=True)
    LAUNCH_AGENT_PATH.write_text(plist_body(cfg), encoding="utf-8")
    domain = f"gui/{_uid()}/{LAUNCH_AGENT_LABEL}"
    _launchctl(["bootout", domain])
    loaded = _launchctl(["bootstrap", f"gui/{_uid()}", str(LAUNCH_AGENT_PATH)])
    if loaded.returncode != 0:
        loaded = _launchctl(["load", "-w", str(LAUNCH_AGENT_PATH)])
    _launchctl(["enable", domain])
    kicked = _launchctl(["kickstart", "-k", domain])
    return {
        "ok": loaded.returncode == 0 or kicked.returncode == 0,
        "plist": str(LAUNCH_AGENT_PATH),
        "label": LAUNCH_AGENT_LABEL,
        "bootstrap": (loaded.stderr or loaded.stdout or "").strip(),
        "runtime": str(support_dir()),
        "url": f"http://{cfg.host}:{cfg.port}",
    }


def uninstall_launch_agent() -> dict:
    domain = f"gui/{_uid()}/{LAUNCH_AGENT_LABEL}"
    _launchctl(["bootout", domain])
    _launchctl(["unload", "-w", str(LAUNCH_AGENT_PATH)])
    if LAUNCH_AGENT_PATH.exists():
        LAUNCH_AGENT_PATH.unlink()
    return {"ok": True, "removed": str(LAUNCH_AGENT_PATH)}
