"""
CPR (Crowd Pressure Radar) — Hardware Serial Bridge
Bridges the Node.js Telemetry Server (http://localhost:5000) with the physical ESP32 Master node over USB Serial.

Features:
- Auto-detects connected ESP32 microcontrollers on Windows COM ports (CH340, CP2102, FTDI, etc.).
- Polls http://localhost:5000/api/esp32/status at 10Hz (every 100ms).
- Transmits compact JSON status packets to ESP32:
  {"count": 2, "led": "GREEN", "angle": 90, "oled": {...}}
- Reads any incoming sensor telemetry from the ESP32 (e.g., radar energy, IR beam interrupts)
  and forwards it to http://localhost:5000/api/telemetry.
"""

import sys
import os
import time
import json
import urllib.request
import serial
import serial.tools.list_ports

SERVER_URL = os.getenv("CPR_SERVER_URL", "http://localhost:5050")
STATUS_ENDPOINT = f"{SERVER_URL}/api/esp32/status"
TELEMETRY_ENDPOINT = f"{SERVER_URL}/api/telemetry"
BAUD_RATE = 115200

def find_esp32_port():
    """Scans system COM ports for likely ESP32 / USB-UART bridges, ignoring Bluetooth."""
    ports = serial.tools.list_ports.comports()
    if not ports:
        return None
    
    print("\n[CPR-Bridge] Scanning available COM ports:")
    candidate = None
    for p in ports:
        desc = (p.description or "").lower()
        print(f"  - {p.device}: {p.description}")
        # Ignore Bluetooth ports
        if "bluetooth" in desc:
            continue
        # Common USB-to-UART identifiers for ESP32
        if any(keyword in desc for keyword in ["ch340", "cp210", "ftdi", "usb serial", "silicon labs", "uart"]):
            return p.device
        if not candidate and "communications port" not in desc:
            candidate = p.device
            
    return candidate

def get_server_status():
    """Fetches the latest calculated LED, servo, and OLED state from server."""
    try:
        req = urllib.request.Request(STATUS_ENDPOINT, headers={'User-Agent': 'CPR-Serial-Bridge'})
        with urllib.request.urlopen(req, timeout=1.0) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        return None
    return None

def forward_sensor_data(raw_line):
    """Sends sensor data received from ESP32 back to the server."""
    try:
        parsed = json.loads(raw_line)
        payload = json.dumps({"source": "esp32", **parsed}).encode('utf-8')
        req = urllib.request.Request(
            TELEMETRY_ENDPOINT,
            data=payload,
            headers={'Content-Type': 'application/json', 'x-source': 'esp32'}
        )
        urllib.request.urlopen(req, timeout=0.8)
    except Exception:
        pass

def run_bridge(preferred_port=None):
    print("=" * 65)
    print("  CPR (Crowd Pressure Radar) — ESP32 USB Hardware Bridge")
    print("=" * 65)

    port = preferred_port or find_esp32_port()
    if not port:
        print("\n[CPR-Bridge] No active COM port detected!")
        print("  Please connect your ESP32 board via USB cable and restart this bridge.")
        print("  Alternatively, specify your COM port: python CPR-AI/integration/serial_bridge.py COM3")
        sys.exit(1)

    print(f"\n[CPR-Bridge] Connecting to ESP32 on port {port} @ {BAUD_RATE} baud...")
    try:
        ser = serial.Serial(port, BAUD_RATE, timeout=0.1)
        time.sleep(1.8) # Allow ESP32 reboot upon DTR toggle
        print("[CPR-Bridge] Serial connection established successfully!\n")
    except Exception as e:
        print(f"[CPR-Bridge] Error opening serial port {port}: {e}")
        sys.exit(1)

    last_sent_state = None
    poll_interval = 0.15 # 150ms

    try:
        while True:
            # 1. Fetch current control state from CPR Server
            status = get_server_status()
            if status:
                # Format compact JSON line for ESP32
                cmd = {
                    "count": status.get("count", 0),
                    "led": status.get("led", "GREEN"),
                    "rgb": status.get("rgb", {"r": 0, "g": 255, "b": 0}),
                    "angle": status.get("servoAngle", 90),
                    "buzzer": status.get("buzzer", False),
                    "oled": status.get("oled", {})
                }
                
                # Transmit if state changed or as periodic heartbeat (every 1s)
                cmd_str = json.dumps(cmd)
                ser.write((cmd_str + "\n").encode('utf-8'))

                # Console log when state changes
                if cmd_str != last_sent_state:
                    print(f"[CPR-Bridge -> ESP32] Count: {cmd['count']} | LED: {cmd['led']} (RGB:{cmd['rgb']['r']},{cmd['rgb']['g']},{cmd['rgb']['b']}) | Servo: {cmd['angle']}° | OLED: {cmd['oled'].get('line3', '')}")
                    last_sent_state = cmd_str

            # 2. Check for sensor packets coming back from ESP32
            if ser.in_waiting > 0:
                try:
                    line = ser.readline().decode('utf-8', errors='ignore').strip()
                    if line:
                        if line.startswith("{") and line.endswith("}"):
                            forward_sensor_data(line)
                            print(f"[ESP32 -> CPR-Bridge] Sensor Data: {line}")
                        else:
                            print(f"[ESP32 Debug]: {line}")
                except Exception:
                    pass

            time.sleep(poll_interval)

    except KeyboardInterrupt:
        print("\n[CPR-Bridge] Disconnecting serial port...")
    finally:
        ser.close()
        print("[CPR-Bridge] Bridge stopped cleanly.")

if __name__ == "__main__":
    target_port = sys.argv[1] if len(sys.argv) > 1 else None
    run_bridge(target_port)
