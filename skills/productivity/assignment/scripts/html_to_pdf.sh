#!/bin/zsh
# Print an HTML file to PDF with headless Chrome (macOS install path).
# Usage: html_to_pdf.sh input.html output.pdf
set -u
[ $# -eq 2 ] || { echo "usage: html_to_pdf.sh input.html output.pdf"; exit 2; }
IN="${1:A}"
OUT="${2:A}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="$(mktemp -d)"
PRINT="${IN:r}.print.html"

# wrap long code lines; printed pages otherwise clip them at the right margin
perl -pe 's#</head>#<style>pre, code { white-space: pre-wrap !important; overflow-wrap: anywhere; }</style></head>#' "$IN" > "$PRINT"

rm -f "$OUT"
"$CHROME" --headless=new --disable-gpu --no-sandbox \
  --no-pdf-header-footer --run-all-compositor-stages-before-draw --virtual-time-budget=20000 \
  --user-data-dir="$PROFILE" --print-to-pdf="$OUT" "file://$PRINT" >/dev/null 2>&1 &
CPID=$!
# headless Chrome can hang after writing the PDF, so stop it once the file is complete
for i in $(seq 1 60); do [ -s "$OUT" ] && tail -c 8 "$OUT" | grep -q EOF && break; sleep 1; done
sleep 1; kill $CPID 2>/dev/null; wait $CPID 2>/dev/null; rm -rf "$PROFILE" "$PRINT"

[ -s "$OUT" ] || { echo "pdf missing"; exit 1; }
echo "pdf ok: $OUT"
