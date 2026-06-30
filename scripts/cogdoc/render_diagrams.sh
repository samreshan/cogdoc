#!/usr/bin/env bash
# Render all Mermaid diagrams to high-resolution PNGs.
set -euo pipefail

DIAG_DIR="/home/z/my-project/scripts/cogdoc/diagrams"
OUT_DIR="/home/z/my-project/scripts/cogdoc/assets"
CFG="/home/z/my-project/scripts/cogdoc/mermaid-config.json"
PUP="/home/z/my-project/scripts/cogdoc/puppeteer-config.json"
export PUPPETEER_EXECUTABLE_PATH=/home/z/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome

mkdir -p "$OUT_DIR"

declare -a DIAGRAMS=(
  "01_usecase:Use Case Diagram:1600"
  "02_architecture:System Architecture:2200"
  "03_seq_interceptor:Interceptor Sequence:1800"
  "04_seq_citation:Citation Sentinel Sequence:1800"
  "05_seq_socratic:Socratic Spacer Sequence:1800"
  "06_er:ER Diagram:1800"
  "07_class:AI Class Diagram:1800"
)

for entry in "${DIAGRAMS[@]}"; do
  IFS=':' read -r name label width <<< "$entry"
  echo ">>> Rendering $name ($label) at width=$width"
  mmdc \
    -i "${DIAG_DIR}/${name}.mmd" \
    -o "${OUT_DIR}/${name}.png" \
    -c "$CFG" \
    -p "$PUP" \
    -w "$width" \
    -b "#eff0f0" \
    --scale 2 2>&1 || echo "!!! FAILED: $name"
  echo "  -> ${OUT_DIR}/${name}.png"
done

echo ""
echo "=== Rendering complete ==="
ls -la "$OUT_DIR"
