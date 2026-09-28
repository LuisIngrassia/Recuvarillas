#!/usr/bin/env bash
# Exporta las plantillas de redes a PNG (1080 × 1080 y 1080 × 1920) con Chrome sin ventana.
#
#   bash brand/herramientas/render-plantillas.sh            # todas
#   bash brand/herramientas/render-plantillas.sh producto   # una sola
#
# Los PNG quedan en brand/assets/templates/png/. En Mac o Linux, si Chrome está
# en otro lado, pasalo en la variable CHROME.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/../assets/templates" && pwd)"
OUT="$DIR/png"
mkdir -p "$OUT"

if [ -z "${CHROME:-}" ]; then
  for c in "/c/Program Files/Google/Chrome/Application/chrome.exe" \
           "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
           "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "$(command -v google-chrome 2>/dev/null || true)" \
           "$(command -v chromium 2>/dev/null || true)"; do
    [ -n "$c" ] && [ -x "$c" ] && CHROME="$c" && break
  done
fi
[ -n "${CHROME:-}" ] || { echo "No encontré Chrome. Pasalo así: CHROME=/ruta/a/chrome bash $0"; exit 1; }

# Chrome en Windows necesita rutas de Windows; en el resto, las comunes.
winpath() { if command -v cygpath >/dev/null; then cygpath -w "$1"; else echo "$1"; fi; }
fileurl() { if command -v cygpath >/dev/null; then echo "file:///$(cygpath -m "$1")"; else echo "file://$1"; fi; }

names=("$@")
[ ${#names[@]} -eq 0 ] && names=($(cd "$DIR" && ls *.html | sed 's/\.html$//'))

for n in "${names[@]}"; do
  src="$(fileurl "$DIR/$n.html")"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1080,1080 --virtual-time-budget=4000 \
    --screenshot="$(winpath "$OUT/$n-1080x1080.png")" "$src" >/dev/null 2>&1
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1080,1920 --virtual-time-budget=4000 \
    --screenshot="$(winpath "$OUT/$n-1080x1920.png")" "$src?formato=historia" >/dev/null 2>&1
  echo "listo: $n"
done
