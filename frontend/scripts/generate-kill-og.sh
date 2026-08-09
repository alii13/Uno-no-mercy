#!/usr/bin/env bash
# Shoot one 1200x630 OG image per kill tier from killOgTemplate.html.
#
# Kill cards reuse a fixed set of tier images rather than rendering per share,
# so this runs by hand whenever the template changes - not in the build. Needs
# `agent-browser` on PATH and network access for the Google webfonts.
#
# Usage: bash frontend/scripts/generate-kill-og.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="file://$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$HERE/killOgTemplate.html")"
OUT="$HERE/../public/og"
SESSION=killog

# Keep in step with KILL_TIERS in src/utils/killCard.ts: every even stack size
# from the brag threshold to the cap, the above-cap fallback, and the legacy
# 26plus slug that pre-exact-number cards still point at.
TIERS=(6 8 10 12 14 16 18 20 22 24 26 28 30 32 34 36 38 40 42 42plus 26plus)

mkdir -p "$OUT"
agent-browser --session "$SESSION" set viewport 1200 630

for tier in "${TIERS[@]}"; do
    agent-browser --session "$SESSION" open "${TEMPLATE}?tier=${tier}"
    # Fonts must be resolved before the shot or a fallback face gets committed.
    agent-browser --session "$SESSION" wait --fn "window.__ready === true"
    agent-browser --session "$SESSION" screenshot "$OUT/kill-${tier}.png"
    # PNG stores this smooth radial gradient badly (~257KB); JPEG q90 is
    # visually identical at ~96KB and link previews re-encode anyway.
    sips -s format jpeg -s formatOptions 90 "$OUT/kill-${tier}.png" \
        --out "$OUT/kill-${tier}.jpg" > /dev/null
    rm "$OUT/kill-${tier}.png"
    echo "rendered kill-${tier}.jpg"
done

agent-browser --session "$SESSION" close
echo "done - ${#TIERS[@]} tier images in $OUT"
