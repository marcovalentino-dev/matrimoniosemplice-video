#!/bin/sh
# Build di "Dal caos all'RSVP": sh engine/dal-caos-allrsvp/build.sh [preview]
# Richiede la libreria Lemo-Opuscar (render + mux) e ffmpeg/ffprobe nel PATH.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
LIB=${LIB:-/c/Users/Marco/lemo-opuscar}
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "imposta LIB sulla cartella di lemo-opuscar"; exit 1; }
PY="$LIB/.venv/bin/python"
mkdir -p "$HERE/fonts" "$HERE/out" "$ROOT/out"
# font locali (OFL) dalla cartella assets/fonts, nomi senza parentesi
cp "$ROOT/assets/fonts/playfair-display/PlayfairDisplay[wght].ttf" "$HERE/fonts/playfair.ttf"
cp "$ROOT/assets/fonts/playfair-display/PlayfairDisplay-Italic[wght].ttf" "$HERE/fonts/playfair-italic.ttf"
cp "$ROOT/assets/fonts/inter/Inter[opsz,wght].ttf" "$HERE/fonts/inter.ttf"
cp "$ROOT/assets/logo/icon.svg" "$HERE/logo.svg"
cd "$LIB"
node core/render/events.mjs "$HERE" --size 1080x1920
if [ "$1" = "preview" ]; then
  node core/render/video.mjs "$HERE" --fps 15 --size 540x960 --workers 3 --out "$HERE/out/preview.mp4"
  echo "anteprima: $HERE/out/preview.mp4"; exit 0
fi
node core/render/video.mjs "$HERE" --fps 30 --size 1080x1920 --workers 3 --out "$HERE/out/video.mp4"
"$PY" "$HERE/mix.py"
LEMO_COLOR=bt709 sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$ROOT/out/dal-caos-allrsvp.mp4" 30 0
