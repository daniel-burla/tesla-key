#!/usr/bin/env bash
# Overlay a Vite production dist onto this GitHub Pages repo without
# touching Tesla partner-key, CNAME, or .nojekyll.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="${1:-}"

PRESERVE=(
  ".well-known/appspecific/com.tesla.3p.public-key.pem"
  ".nojekyll"
  "CNAME"
)

die() { echo "error: $*" >&2; exit 1; }

[[ -n "$DIST" && -d "$DIST" ]] || die "usage: $0 /path/to/vite/dist"
[[ -f "$DIST/index.html" ]] || die "dist is missing index.html (not a Vite build?)"

for rel in "${PRESERVE[@]}"; do
  [[ -e "$ROOT/$rel" ]] || die "missing preserve path in repo: $rel"
done

# Refuse a dist that would clobber the partner-key path or CNAME.
if [[ -e "$DIST/.well-known" ]]; then
  die "dist contains .well-known; refuse to overlay (would risk rewriting the Tesla PEM)"
fi
if [[ -e "$DIST/CNAME" ]]; then
  existing="$(cat "$ROOT/CNAME")"
  incoming="$(cat "$DIST/CNAME")"
  [[ "$incoming" == "$existing" ]] || die "dist CNAME differs from preserved CNAME"
fi

# Snapshot preserve bytes, then copy dist, then restore.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/.well-known/appspecific"
cp -a "$ROOT/.well-known/appspecific/com.tesla.3p.public-key.pem" \
  "$tmp/.well-known/appspecific/com.tesla.3p.public-key.pem"
cp -a "$ROOT/.nojekyll" "$tmp/.nojekyll"
cp -a "$ROOT/CNAME" "$tmp/CNAME"

# Old Tesla Monitor entrypoints — drop only after a real dist is copied.
# Never leave a live Supabase config.js on Pages.
old_monitor=(
  app.js config.js render.js ui.js styles.css
)
for f in "${old_monitor[@]}"; do
  rm -f "$ROOT/$f"
done

# Copy build (do not delete .git / preserve paths).
shopt -s dotglob
cp -a "$DIST"/* "$ROOT/"
shopt -u dotglob

# Restore preserve paths last so dist cannot win.
mkdir -p "$ROOT/.well-known/appspecific"
cp -a "$tmp/.well-known/appspecific/com.tesla.3p.public-key.pem" \
  "$ROOT/.well-known/appspecific/com.tesla.3p.public-key.pem"
cp -a "$tmp/.nojekyll" "$ROOT/.nojekyll"
cp -a "$tmp/CNAME" "$ROOT/CNAME"

# SPA fallback: GitHub Pages serves 404.html for unknown paths.
# Static files (including .well-known) still win when the path exists.
if [[ ! -f "$ROOT/404.html" ]]; then
  cp -a "$ROOT/index.html" "$ROOT/404.html"
fi

# Sanity checks
[[ -f "$ROOT/.well-known/appspecific/com.tesla.3p.public-key.pem" ]] \
  || die "PEM missing after overlay"
[[ "$(cat "$ROOT/CNAME")" == "$(cat "$tmp/CNAME")" ]] \
  || die "CNAME changed after overlay"
[[ -e "$ROOT/.nojekyll" ]] || die ".nojekyll missing after overlay"

echo "overlay complete. preserved:"
printf '  %s\n' "${PRESERVE[@]}"
echo "PEM public URL: https://car.burla.ca/.well-known/appspecific/com.tesla.3p.public-key.pem"
