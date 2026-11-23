#!/usr/bin/env bash
# CPR AI Demo Launcher for macOS / Linux
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "================================================================="
echo "  CPR (Crowd Pressure Radar) — Exhibition Demo Launcher"
echo "================================================================="
echo ""

cleanup() {
    echo ""
    echo "[CPR] Stopping dashboard server..."
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        kill "$SERVER_PID" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo "[1/3] Starting Telemetry Hub on http://localhost:5050..."
node "$SCRIPT_DIR/dashboard/server.js" &
SERVER_PID=$!
sleep 2

echo "[2/3] Opening Dashboards in browser..."
if command -v open >/dev/null 2>&1; then
    open "http://localhost:5050"
    open "http://localhost:5050/demo"
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:5050"
    xdg-open "http://localhost:5050/demo"
fi

echo "[3/3] Launching AI Vision Engine..."
python3 "$SCRIPT_DIR/main.py"
