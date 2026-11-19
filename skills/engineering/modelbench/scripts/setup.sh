#!/usr/bin/env bash
# Install modelbench's tooling into ~/.cache/modelbench (or $MODELBENCH_HOME) and check prerequisites.
set -euo pipefail
HOME_DIR="${MODELBENCH_HOME:-$HOME/.cache/modelbench}"
mkdir -p "$HOME_DIR"
cd "$HOME_DIR"
[ -f package.json ] || npm init -y >/dev/null
npm install --silent --no-audit --no-fund playwright-core@latest pngjs@7 >/dev/null
node -e 'const [maj,min]=process.versions.node.split(".").map(Number); if (maj<22 || (maj===22&&min<5)) { console.error("Node >= 22.5 needed (node:sqlite)"); process.exit(1) }'
CHROME="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
if [ ! -x "$CHROME" ]; then echo "Chrome not found at $CHROME; set CHROME_PATH" >&2; exit 1; fi
echo "{\"tools\": \"$HOME_DIR\", \"playwright\": \"$(node -e "console.log(require('$HOME_DIR/node_modules/playwright-core/package.json').version)")\", \"chrome\": \"$("$CHROME" --version)\", \"sips\": $(command -v sips >/dev/null && echo true || echo false)}"
