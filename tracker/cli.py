from __future__ import annotations

import argparse
import json
import sys

from tracker.calendar_sync import sync_calendar
from tracker.coach import build_briefing
from tracker.config import load_config
from tracker.install_agent import install_launch_agent, uninstall_launch_agent
from tracker.server import serve


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="tracker",
        description="SDE-2/SDE-3 routine dashboard, Apple Calendar sync, and login launch agent.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    serve_p = sub.add_parser("serve", help="Run the local dashboard")
    serve_p.add_argument("--open", action="store_true", help="Open the dashboard in the browser")

    sub.add_parser("now", help="Print the current briefing as JSON")
    sub.add_parser("sync-calendar", help="Write the weekly routine into Apple Calendar")
    sub.add_parser("install", help="Install the login LaunchAgent and start the dashboard")
    sub.add_parser("uninstall", help="Remove the login LaunchAgent")

    args = parser.parse_args(argv)
    cfg = load_config()

    if args.command == "serve":
        serve(cfg, open_browser=args.open)
        return 0
    if args.command == "now":
        json.dump(build_briefing(cfg), sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0
    if args.command == "sync-calendar":
        json.dump(sync_calendar(cfg), sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0
    if args.command == "install":
        json.dump(install_launch_agent(cfg), sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0
    if args.command == "uninstall":
        json.dump(uninstall_launch_agent(), sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0
    parser.error("unknown command")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
