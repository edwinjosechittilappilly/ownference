#!/bin/sh
set -eu
ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd -P)
OUT=${OWNFERENCE_MENUBAR_OUTPUT:-"$ROOT/build"}
mkdir -p "$OUT"
OUT=$(CDPATH='' cd -- "$OUT" && pwd -P)
WORK=$(mktemp -d "${TMPDIR:-/tmp}/ownference-menubar.XXXXXX")
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
APP="$WORK/Ownference-Bridge-MenuBar.app"
CONTENTS="$APP/Contents"
mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Resources/runtime"
for arch in arm64 x86_64; do
  xcrun swiftc -swift-version 5 -O -target "$arch-apple-macosx13.0" "$ROOT/menubar/Main.swift" -o "$WORK/menu-$arch"
done
xcrun lipo -create "$WORK/menu-arm64" "$WORK/menu-x86_64" -output "$CONTENTS/MacOS/Ownference-Bridge-MenuBar"
cp -R "$ROOT/src" "$CONTENTS/Resources/runtime/src"
cp "$ROOT/package.json" "$CONTENTS/Resources/runtime/package.json"
if [ -d "$ROOT/bin" ]; then cp -R "$ROOT/bin" "$CONTENTS/Resources/runtime/bin"; fi
# The common family asset is supplied by the repository, not redrawn here.
cp "$ROOT/docs/assets/icon-32.png" "$CONTENTS/Resources/menu-icon.png"
mkdir "$WORK/AppIcon.iconset"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$ROOT/docs/assets/icon-1024.png" --out "$WORK/AppIcon.iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" "$ROOT/docs/assets/icon-1024.png" --out "$WORK/AppIcon.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$WORK/AppIcon.iconset" -o "$CONTENTS/Resources/AppIcon.icns"
cat > "$CONTENTS/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>Ownference-Bridge-MenuBar</string>
<key>CFBundleIdentifier</key><string>com.ownference.bridge.menubar</string>
<key>CFBundleName</key><string>Ownference Bridge</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.2.0</string>
<key>CFBundleVersion</key><string>2</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>LSUIElement</key><true/>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
codesign --force --deep --sign - "$APP"
rm -rf "$OUT/Ownference-Bridge-MenuBar.app"
ditto "$APP" "$OUT/Ownference-Bridge-MenuBar.app"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$OUT/Ownference-Bridge-MenuBar.zip"
printf 'Built %s\n' "$OUT/Ownference-Bridge-MenuBar.app"
