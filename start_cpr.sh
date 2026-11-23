#!/usr/bin/env bash
# CPR - Crowd Pressure Radar Launcher for macOS / Linux
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

echo "================================================================="
echo "  CPR (Crowd Pressure Radar) — macOS / Linux Launcher"
echo "================================================================="
echo "Project Directory: $REPO_DIR"
echo ""

cleanup() {
    echo ""
    echo "[CPR] Shutting down background telemetry server..."
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        kill "$SERVER_PID" 2>/dev/null || true
    fi
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Start Telemetry Hub & Web Dashboard
echo "[1/3] Starting Telemetry Hub & Web Dashboard on http://localhost:5050..."
node "$REPO_DIR/CPR-AI/dashboard/server.js" &
SERVER_PID=$!
sleep 2

# 2. Open Exhibition Dashboards in default browser
echo "[2/3] Opening Dashboards in your default browser..."
echo "  - Live Crowd Monitor:        http://localhost:5050"
echo "  - Interactive Hardware Demo: http://localhost:5050/demo"
if command -v open >/dev/null 2>&1; then
    open "http://localhost:5050"
    open "http://localhost:5050/demo"
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:5050"
    xdg-open "http://localhost:5050/demo"
fi

# 3. Launch Master Computer Vision AI Engine
echo "[3/3] Launching Master Computer Vision AI Engine..."
echo "      (Connecting to Mac Camera / Video Stream)"
python3 "$REPO_DIR/CPR-AI/main.py"
