#!/bin/sh
set -eu
ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd -P)
APP=${1:-"$ROOT/build/Ownference-Bridge-MenuBar.app"}
BIN="$APP/Contents/MacOS/Ownference-Bridge-MenuBar"
codesign --verify --deep --strict --verbose=2 "$APP"
plutil -lint "$APP/Contents/Info.plist"
[ "$(/usr/libexec/PlistBuddy -c 'Print :LSMinimumSystemVersion' "$APP/Contents/Info.plist")" = 13.0 ]
[ "$(/usr/libexec/PlistBuddy -c 'Print :LSUIElement' "$APP/Contents/Info.plist")" = true ]
[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP/Contents/Info.plist")" = Ownference-Bridge-MenuBar ]
xcrun lipo "$BIN" -verify_arch arm64 x86_64
for arch in arm64 x86_64; do
  xcrun vtool -arch "$arch" -show-build "$BIN" | awk '
    $1 == "platform" && $2 == "MACOS" { platform = 1 }
    $1 == "minos" && $2 == "13.0" { minimum = 1 }
    END { if (!platform || !minimum) exit 1 }
  ' || { echo "Invalid macOS deployment target for $arch" >&2; exit 1; }
done
"$BIN" --self-test
# Invalid configuration must be rejected before touching the user's configuration.
if "$BIN" --configure relative/node relative/cli >/dev/null 2>&1; then
  echo 'Relative paths were accepted' >&2
  exit 1
fi
if "$BIN" --unknown >/dev/null 2>&1; then
  echo 'Unknown option was accepted' >&2
  exit 1
fi
status=$("$BIN" --status)
case "$status" in
  'Bridge: reachable'|'Bridge: not reachable') ;;
  *) echo "Unexpected status: $status" >&2; exit 1 ;;
esac
WORK=$(mktemp -d "${TMPDIR:-/tmp}/ownference-menubar-test.XXXXXX")
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
"$BIN" --screenshot "$WORK/status.png"
sips -g pixelWidth -g pixelHeight "$WORK/status.png" >/dev/null
"$BIN" --ui-smoke "$WORK/menu-icon.png"
sips -g pixelWidth -g pixelHeight "$WORK/menu-icon.png" >/dev/null
printf '%s\n' 'Menu bar behavior tests passed.'
