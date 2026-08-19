#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/macos/DailyRoutine"
OUT="$ROOT/macos/build/Daily Routine.app"
MACOS_DIR="$OUT/Contents/MacOS"
SDK="$(xcrun --show-sdk-path)"
ARCH="$(uname -m)"
TARGET="${ARCH}-apple-macosx14.0"
export COPYFILE_DISABLE=1

mkdir -p "$MACOS_DIR" "$OUT/Contents/Resources"

swiftc -parse-as-library \
  -target "$TARGET" \
  -sdk "$SDK" \
  -O \
  -framework SwiftUI \
  -framework AppKit \
  -framework WebKit \
  "$SRC/DailyRoutineApp.swift" \
  "$SRC/ContentView.swift" \
  "$SRC/AppWebView.swift" \
  "$SRC/LocalServer.swift" \
  -o "$MACOS_DIR/DailyRoutine"

cp "$SRC/Info.plist" "$OUT/Contents/Info.plist"
printf 'APPL????' > "$OUT/Contents/PkgInfo"
xattr -cr "$OUT"
codesign --force --sign - "$OUT" >/dev/null

echo "Built $OUT"
