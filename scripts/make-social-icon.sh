#!/usr/bin/env bash
# Make a social icon in the signature's house style: a white glyph on a
# black circle, the glyph 54/96 of the circle's width (as in the existing
# LinkedIn, Instagram, Facebook and X icons), saved as a 58x58 PNG so it
# shows sharp at 29x29 on high-density screens.
#
#   scripts/make-social-icon.sh <name> <glyph.svg>
#   scripts/make-social-icon.sh bluesky ~/Downloads/bluesky.svg
#
# The glyph should be a single-path icon on a 24x24 viewBox, which is what
# Simple Icons (https://simpleicons.org, CC0) provides for most brands.
# Writes brand/social/<name>.svg (the editable master) and
# assets/img/<name>.png (what signatures load). Needs ImageMagick 7.
#
# Then add the network to `socials` in config.js.
set -euo pipefail

name=${1:?usage: $0 <name> <glyph.svg>}
glyph=${2:?usage: $0 <name> <glyph.svg>}
root=$(cd "$(dirname "$0")/.." && pwd)

if ! grep -q 'viewBox="0 0 24 24"' "$glyph"; then
  echo "$glyph: expected a 24x24 viewBox (a Simple Icons-style SVG)" >&2
  exit 1
fi
d=$(sed -n 's/.*<path[^>]* d="\([^"]*\)".*/\1/p' "$glyph")
if [ -z "$d" ] || [ "$(grep -o '<path' "$glyph" | wc -l)" -ne 1 ]; then
  echo "$glyph: expected exactly one <path d=\"...\">" >&2
  exit 1
fi

mkdir -p "$root/brand/social"
master="$root/brand/social/$name.svg"
# 24 * 2.25 = 54, centred: (96 - 54) / 2 = 21
cat >"$master" <<EOF
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <circle cx="48" cy="48" r="48" fill="#000"/>
  <path transform="translate(21 21) scale(2.25)" fill="#fff" d="$d"/>
</svg>
EOF

# Render at 10x, then scale down, for clean anti-aliased edges
magick -background none -density 960 "$master" \
  -filter Lanczos -resize 58x58 -strip "PNG32:$root/assets/img/$name.png"

echo "Wrote brand/social/$name.svg and assets/img/$name.png"
