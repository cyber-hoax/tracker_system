#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/macos/build/Daily Routine.app"

if [[ ! -x "$APP/Contents/MacOS/DailyRoutine" ]]; then
  "$ROOT/macos/build.sh"
fi

open "$APP"
