#!/bin/sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
ASSETS="$ROOT/docs/assets"
command -v rsvg-convert >/dev/null 2>&1 || { echo 'Install librsvg (rsvg-convert) to render brand assets.' >&2; exit 1; }
for size in 16 32 48 128 256 512 1024; do
  rsvg-convert -w "$size" -h "$size" "$ASSETS/logo.svg" -o "$ASSETS/icon-$size.png"
done
rsvg-convert -w 512 -h 512 "$ASSETS/logo.svg" -o "$ASSETS/logo.png"
rsvg-convert -w 32 -h 32 "$ASSETS/family-mark.svg" -o "$ASSETS/menu-icon.png"
rsvg-convert "$ASSETS/hero.svg" -o "$ASSETS/social-card.png"
