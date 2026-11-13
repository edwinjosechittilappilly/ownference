#!/bin/sh
set -eu
ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd -P)
OUT=${OWNMODE_MENUBAR_OUTPUT:-"$ROOT/build"}
mkdir -p "$OUT"
OUT=$(CDPATH='' cd -- "$OUT" && pwd -P)
WORK=$(mktemp -d "${TMPDIR:-/tmp}/ownmode-menubar.XXXXXX")
trap 'rm -rf "$WORK"' EXIT HUP INT TERM
APP="$WORK/OwnMode Connect.app"
CONTENTS="$APP/Contents"
mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Resources/runtime"
for arch in arm64 x86_64; do
  xcrun swiftc -swift-version 5 -O -target "$arch-apple-macosx13.0" "$ROOT/menubar/Main.swift" -o "$WORK/menu-$arch"
done
xcrun lipo -create "$WORK/menu-arm64" "$WORK/menu-x86_64" -output "$CONTENTS/MacOS/OwnModeConnect"
cp -R "$ROOT/src" "$CONTENTS/Resources/runtime/src"
cp "$ROOT/package.json" "$CONTENTS/Resources/runtime/package.json"
if [ -f "$ROOT/bin/ownmode-apple" ]; then
  mkdir -p "$CONTENTS/Resources/runtime/bin"
  cp "$ROOT/bin/ownmode-apple" "$CONTENTS/Resources/runtime/bin/ownmode-apple"
fi
# The common family asset is supplied by the repository, not redrawn here.
cp "$ROOT/docs/assets/menu-icon.png" "$CONTENTS/Resources/menu-icon.png"
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
<key>CFBundleExecutable</key><string>OwnModeConnect</string>
<key>CFBundleIdentifier</key><string>com.ownmode.bridge.menubar</string>
<key>CFBundleName</key><string>OwnMode Connect</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.3.0</string>
<key>CFBundleVersion</key><string>0.3.0</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>LSUIElement</key><true/>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
codesign --force --deep --sign - "$APP"
rm -rf "$OUT/OwnMode Connect.app"
ditto "$APP" "$OUT/OwnMode Connect.app"
ditto -c -k --sequesterRsrc --keepParent "$APP" "$OUT/OwnMode-Connect-MenuBar.zip"
mkdir "$WORK/dmg"
ditto "$APP" "$WORK/dmg/OwnMode Connect.app"
ln -s /Applications "$WORK/dmg/Applications"
rm -f "$OUT/OwnMode-Connect-MenuBar.dmg"
hdiutil create -quiet -volname "OwnMode Connect" -srcfolder "$WORK/dmg" -format UDZO "$OUT/OwnMode-Connect-MenuBar.dmg"
printf 'Built %s\n' "$OUT/OwnMode Connect.app"
