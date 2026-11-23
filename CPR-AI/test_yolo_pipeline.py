"""
CPR AI - YOLO to Dashboard Pipeline Test
Simulates YOLO live detections and verifies real-time status transitions.
"""
import time
import json
import urllib.request

import os
PORT = os.getenv("CPR_PORT", "5050")
TELEMETRY_URL = f"http://localhost:{PORT}/api/telemetry"
STATUS_URL = f"http://localhost:{PORT}/api/esp32/status"

def send_yolo_detection(count, state_label, density, score):
    payload = {
        "deviceId": "cpr-vision-gate-01",
        "zoneId": "zone-entry-a",
        "timestamp": int(time.time()),
        "source": "computer_vision",
        "state": state_label,
        "score": score,
        "density": density,
        "avgSpeed": 45.0,
        "stopGoIndex": 0.1,
        "targetCount": count,
        "entryCount": 10,
        "exitCount": 8,
        "activeAlerts": [],
        "firmwareVersion": "cpr-ai-v2.4-cuda"
    }
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        TELEMETRY_URL,
        data=data,
        headers={
            'Content-Type': 'application/json',
            'x-device-key': 'cpr-secret-key-2026',
            'x-source': 'cpr-ai-vision'
        }
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get_esp32_status():
    with urllib.request.urlopen(STATUS_URL) as resp:
        return json.loads(resp.read().decode('utf-8'))

def run_test():
    print("=" * 65)
    print("  CPR — Testing YOLO -> Dashboard -> ESP32 Status Pipeline")
    print("=" * 65)

    test_cases = [
        {"count": 3, "label": "GREEN", "density": 0.15, "score": 0.2, "expected_led": "GREEN", "expected_angle": 90},
        {"count": 7, "label": "AMBER", "density": 0.45, "score": 0.5, "expected_led": "YELLOW", "expected_angle": 45},
        {"count": 14, "label": "RED", "density": 0.85, "score": 0.9, "expected_led": "RED", "expected_angle": 0}
    ]

    all_passed = True
    for tc in test_cases:
        print(f"\n[Test] Sending YOLO detection: {tc['count']} People ({tc['label']})...")
        send_yolo_detection(tc['count'], tc['label'], tc['density'], tc['score'])
        time.sleep(0.5)
        status = get_esp32_status()
        
        led = status.get('led')
        angle = status.get('servoAngle')
        rgb = status.get('rgb')
        oled = status.get('oled', {})

        print(f"  -> ESP32 Mode:   {status.get('mode')}")
        print(f"  -> Count:        {status.get('count')} PPL")
        print(f"  -> LED Output:   {led} (RGB: {rgb})")
        print(f"  -> Servo Angle:  {angle}° ({status.get('servoStatus')})")
        print(f"  -> OLED Screen:  Line 2='{oled.get('line2')}' | Line 3='{oled.get('line3')}'")

        if led == tc['expected_led'] and angle == tc['expected_angle']:
            print(f"  >>> PASS: Correctly transitioned to {led} light & {angle}° gate!")
        else:
            print(f"  >>> FAIL: Expected {tc['expected_led']}/{tc['expected_angle']}°, got {led}/{angle}°")
            all_passed = False

    print("\n" + "=" * 65)
    if all_passed:
        print("  ALL PIPELINE TESTS PASSED SUCCESSFULLY! (100% READY)")
    else:
        print("  SOME TESTS FAILED - CHECK OUTPUT ABOVE")
    print("=" * 65)

if __name__ == "__main__":
    run_test()
