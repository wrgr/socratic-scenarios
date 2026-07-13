#!/usr/bin/env bash
# start.sh — local launch for the TeachMe / EDDIE AJP demo.
# No Docker. Installs deps the first time, then runs the Vite dev server.
#
# Usage:
#   ./start.sh                     # runs on default Vite port (5173)
#   ./start.sh --port 4000         # override the port
#   ./start.sh --host              # bind to 0.0.0.0 (LAN visible)
#
# Optional: export VITE_GEMINI_API_KEY=... before running to skip the
# in-app gear flow. Otherwise the app starts in simulated mode and you
# can paste a key at runtime via the gear icon in the header.

set -euo pipefail

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is not installed. Install Node 20+ and try again." >&2
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Warning: Node $(node -v) detected. Node 20+ is recommended." >&2
fi

if [ ! -d node_modules ]; then
  echo "→ Installing dependencies (first run)…"
  npm install
fi

echo "→ Starting Vite dev server. Press Ctrl+C to stop."
echo "  Open the URL printed below in your browser."
echo
exec npm run dev -- "$@"
