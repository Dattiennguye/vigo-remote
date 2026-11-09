#!/usr/bin/env bash
# Sao chép giao diện web/ vào assets của dự án Android (web/ là nguồn duy nhất).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/android/app/src/main/assets/web"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$ROOT/web/." "$DEST/"
echo "Đã đồng bộ web/ -> $DEST"
