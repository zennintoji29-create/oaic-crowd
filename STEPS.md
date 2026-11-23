# Step-by-Step Implementation & Operation Guide

This guide provides end-to-end instructions for running the **Crowd Pressure Radar** prototype across simulation, local development, cloud tunneling, and physical hardware assembly.

---

## Part 1: Simulate in Wokwi (Zero Hardware Needed)

Wokwi lets you simulate the full ESP32 circuit, SSD1306 OLED, LEDs, active buzzer, SG90 servo, and synthetic radar queue flow directly inside any modern web browser.

### 1.1 Create the Wokwi Project
1. Open [https://wokwi.com](https://wokwi.com) and click **ESP32** -> **ESP32 DevKit v4** (or open [https://wokwi.com/projects/new/esp32](https://wokwi.com/projects/new/esp32)).
2. Click the **diagram.json** tab on the top-right of the code editor.
3. Replace the contents of `diagram.json` completely with the contents of [`firmware/diagram.json`](file:///Users/subhadip/subhansu'/oaic-crowd/firmware/diagram.json).
4. In the code tab (`sketch.ino`), you can either:
   - **Option A (Instant Single-File Run)**: Paste the contents of [`firmware/wokwi_sketch.ino`](file:///Users/subhadip/subhansu'/oaic-crowd/firmware/wokwi_sketch.ino).
   - **Option B (Multi-File Modular Run)**: Use Wokwi's tab menu (+) to add `pins.h`, `config.h`, `radar_driver.h`, `mock_radar.h`, `analytics.h`, `state_machine.h`, `actuators.h`, `display.h`, `network.h`, and paste `main.cpp` into `sketch.ino`.
5. Open the library manager tab (`libraries.txt`) in Wokwi and paste:
   ```text
   ArduinoJson
   Adafruit SSD1306
   Adafruit GFX Library
   ESP32Servo
   ```

### 1.2 Run & Verify Simulation
1. Click the green **Play / Start Simulation** button.
2. In the Serial Monitor panel at the bottom (115200 baud), observe the boot sequence:
   ```text
   ========================================================
      CROWD PRESSURE RADAR - EMBEDDED NODE INITIALIZING   
      Privacy-First mmWave Queue Early Warning System     
   ========================================================
   [OLED] SSD1306 display initialized successfully.
   [ACTUATORS] Hardware initialized (LEDs, Buzzer, SG90 Servo on GPIO13).
   [STATE] Initialized at GREEN [time=420 ms]
   [NETWORK] Connecting to WiFi SSID: 'Wokwi-GUEST'...
   [SYS] Selected Initial Radar: Synthetic Mock (Wokwi/Demo)
   ```
3. **What You Should See in the Simulator**:
   - **OLED Display**: Alternates every 3 seconds between:
     - *Page 1*: Zone status banner, numerical Risk Score, progress bar, and target count.
     - *Page 2*: Real-time analytics breakdown: Density (ppl/m²), Avg Speed (m/s), Stop&Go index, Clustering count.
     - *Page 3*: IR Entry counter, Exit counter, Net Flow, Gate barrier state.
   - **LEDs & Buzzer Cycle**:
     - *Phase 1 (Normal flow)*: Green LED remains solidly lit. Buzzer is silent. Servo barrier at 0° (open).
     - *Phase 2 (Buildup)*: After ~15s, yellow LED lights up (AMBER state). Buzzer emits a short 200ms warning beep.
     - *Phase 3 (Stall & Compression)*: Red LED begins flashing at 2 Hz. Buzzer sounds an urgent intermittent alarm. The SG90 servo immediately sweeps to 90° (closed barrier).
     - *Phase 4 (Recovery)*: After the synthetic bottleneck disperses, state transitions back to GREEN. The servo stays safely at 90° until 30 seconds of continuous GREEN have elapsed.
4. **Interactive Simulation Controls**:
   - Click the green button labelled **"IR Entry (32)"** to simulate a person crossing the corridor entrance beam. Watch the IR In count increment on the OLED.
   - Click the red button labelled **"IR Exit (33)"** to simulate someone leaving the corridor.
   - In the Serial Monitor input field, type:
     ```text
     status
     ```
     Press Enter to inspect the live radar coordinates, dropped frames, and queue state.
     Try `force red` or `force green` to test emergency actuator overrides.

---

## Part 2: Run the Backend & Dashboard Locally

### 2.1 Start the Node.js Telemetry & Command Backend
Open a terminal in the project directory:
```bash
cd backend
npm install
cp .env.example .env
npm start
```
The server starts at `http://localhost:3000` with WebSocket support enabled.

### 2.2 Start the Frontend Dashboard
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.

### 2.3 Verify Local Operation
1. The dashboard opens in dark mode with high-contrast WCAG AA state indicators.
2. Click the **Simulate** button on the top-right navbar.
3. Observe:
   - The global status banner updates in real-time.
   - The Zone cards update with animated risk score gauges, live crowd density, and average velocity.
   - Click into the **Zone Detail** tab to view the live Recharts time-series graphs for Risk Score (with Amber & Red reference thresholds) and Speed vs Density.
   - Click **Deploy Gate** or **Release Gate**; test the confirmation modal requiring operator justification before dispatching.
   - Switch to the **Alerts** tab and click **Export CSV** to verify the alert audit trail.

---

## Part 3: Connect Wokwi to the Web Dashboard

> [!IMPORTANT]
> Wokwi's virtual ESP32 runs in a sandboxed cloud environment. It **cannot** connect to `http://localhost:3000` directly. You must expose your local backend or deploy it publicly.

### Option A: Tunnel with ngrok or Cloudflare Tunnel (Fastest)
1. In a terminal, run ngrok:
   ```bash
   ngrok http 3000
   ```
   Or using Cloudflare tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
2. Copy the generated HTTPS public forwarding URL (e.g. `https://cpr-demo-123.ngrok-free.app`).
3. In `firmware/include/config.h` (or in Wokwi's `sketch.ino`), update `SERVER_URL`:
   ```cpp
   #define SERVER_URL "https://cpr-demo-123.ngrok-free.app"
   ```
4. Restart the Wokwi simulation.
5. In Wokwi's Serial Monitor, confirm:
   ```text
   [NETWORK] WiFi Connected! IP: 10.0.2.15 | Server Target: https://cpr-demo-123.ngrok-free.app
   ```
6. Open your local dashboard (`http://localhost:5173`). The dashboard now receives live telemetry from the simulated ESP32 in Wokwi!

### Option B: Deploy Backend to Railway or Render
1. Push the `backend/` directory to GitHub.
2. In [Railway.app](https://railway.app) or [Render.com](https://render.com), create a new Web Service from your repository.
3. Set Environment Variable: `DEVICE_KEY=cpr-secret-key-2026`.
4. Copy the production URL and place it in `config.h`.

---

## Part 4: Physical Hardware Prototype Build

### 4.1 Bill of Materials (BOM)
1. **ESP32 DevKit Board (30-pin, CP2102)** – 1 Pc
2. **HLK-LD2450 24 GHz mmWave Radar Sensor** – 1 Pc
3. **IR Break-Beam Sensor Pairs (Emitter + Receiver)** – 2 Pairs
4. **0.96-inch OLED Display (I2C, 128×64, SSD1306)** – 1 Pc
5. **RGB / Individual LEDs (Green, Yellow, Red)** – 1 Set
6. **220 Ω Resistors (for LEDs)** – 3 Pcs
7. **5V Active Buzzer Module** – 1 Pc
8. **SG90 Micro Servo (9g, 180°)** – 1 Pc
9. **Regulated 5V 2A DC Power Supply** – 1 Pc
10. **Solderless Breadboard & Jumper Wires** – 1 Set
11. **Pushbutton (Mock Mode toggle switch)** – 1 Pc

### 4.2 Wiring Table

| Module / Component | Component Pin | ESP32 GPIO / Rail | Notes |
| :--- | :--- | :--- | :--- |
| **HLK-LD2450 Radar** | VCC | External 5V Rail | Radar requires stable 5V |
| | GND | Common GND Rail | Must share common GND |
| | TX | GPIO16 (RX2) | Radar TX -> ESP32 RX |
| | RX | GPIO17 (TX2) | Radar RX -> ESP32 TX |
| **SSD1306 OLED** | VCC | 3.3V Pin | Power from ESP32 3V3 |
| | GND | Common GND Rail | |
| | SCL | GPIO22 | I2C Clock |
| | SDA | GPIO21 | I2C Data |
| **Green LED** | Anode (+) | GPIO25 via 220Ω | Active HIGH indicator |
| | Cathode (-) | Common GND Rail | |
| **Yellow LED** | Anode (+) | GPIO26 via 220Ω | Active HIGH indicator |
| | Cathode (-) | Common GND Rail | |
| **Red LED** | Anode (+) | GPIO27 via 220Ω | Active HIGH indicator |
| | Cathode (-) | Common GND Rail | |
| **Active Buzzer** | VCC / Signal | GPIO14 | Active HIGH alert |
| | GND | Common GND Rail | |
| **SG90 Servo** | PWM Signal | GPIO13 | PWM barrier control |
| | V+ (Red) | External 5V Rail | **NEVER** power from 3.3V |
| | GND (Brown) | Common GND Rail | |
| **IR Beam A (Entry)** | Receiver Signal | GPIO32 | Internal pullup (INPUT_PULLUP) |
| | GND & VCC | GND & 5V Rail | Emitter powered from 5V/GND |
| **IR Beam B (Exit)** | Receiver Signal | GPIO33 | Internal pullup (INPUT_PULLUP) |
| | GND & VCC | GND & 5V Rail | Emitter powered from 5V/GND |
| **Mock Toggle Switch**| Pin 1 / Pin 2 | GPIO4 to GND | LOW = Mock, OPEN/HIGH = Real Radar |

### 4.3 ASCII Wiring & Architecture Diagram
```
                     +---------------------------------------+
                     |        REGULATED 5V 2A POWER SUPPLY   |
                     +-------------------+-------------------+
                                         | 5V (+)      | GND (-)
                        +----------------+             +----------------+
                        |                                               |
                        v                                               v
                 +--------------+                                +--------------+
                 | 5V DC RAIL   |                                | COMMON GND   |
                 +-------+------+                                +-------+------+
                         |                                               |
       +-----------------+-----------------+                             |
       | 5V              | 5V              | 5V                          |
       v                 v                 v                             |
+--------------+  +--------------+  +--------------+                     |
|  HLK-LD2450  |  |  SG90 SERVO  |  | IR EMITTERS  |                     |
| mmWave Radar |  | Gate Barrier |  |  A & B       |                     |
+-------+------+  +-------+------+  +--------------+                     |
        | TX (to GPIO16)  | PWM (to GPIO13)                              |
        | RX (from GPIO17)|                                              |
        v                 v                                              |
+--------------------------------------------------------------+         |
|                     ESP32 DEVKIT C V4                        |         |
|                                                              |         |
|  GPIO21 (SDA) ------> OLED SDA                               |         |
|  GPIO22 (SCL) ------> OLED SCL                               |         |
|  GPIO25 ------------> Green LED (via 220R)                   |         |
|  GPIO26 ------------> Yellow LED (via 220R)                  |         |
|  GPIO27 ------------> Red LED (via 220R)                     |         |
|  GPIO14 ------------> Active Buzzer                          |         |
|  GPIO32 ------------> IR Beam A (Entry Receiver)             |         |
|  GPIO33 ------------> IR Beam B (Exit Receiver)              |         |
|  GPIO4 -------------> Mock/Real Toggle Switch                |         |
|  3.3V Pin ----------> OLED VCC                               |         |
|  GND Pin -----------> Connects to COMMON GND <---------------+---------+
+--------------------------------------------------------------+
```

### 4.4 Physical Sensor Mounting Instructions
1. **Height & Angle**: Mount the HLK-LD2450 at a height of **2.0 to 2.5 meters** above the corridor floor, angled downwards at approximately **15° to 20°**.
2. **Field of View**: Ensure the radar's 60° azimuth cone looks down the corridor lengthwise (depth up to 6.0 m, width up to 4.0 m). Keep metallic scaffolding or large vibrating air ducts outside the primary cone.
3. **IR Break-Beams**: Place Beam Pair A at the corridor entrance at waist height (~1.0 m from ground). Place Beam Pair B at the corridor exit.

---

## Part 5: Calibration & Verification Testing

| Test Step | Procedure | Expected Radar & Analytics Output | Expected Actuator Output | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1. Free Flow Walk** | 1 person walks through at normal walking pace (~1.2 - 1.4 m/s). | Target detected: X: -300mm, Y: 3500mm, Speed ~1.3 m/s. Score &lt; 20. | Green LED ON. Buzzer silent. Gate barrier at 0° (open). | PASS |
| **2. Multi-Person Walk** | 3 persons enter corridor spaced &gt; 1 meter apart. | 3 targets tracked. Density ~0.15 p/m², Speed ~1.1 m/s. Score ~25. | Green LED ON. No alert triggered. | PASS |
| **3. Queue Buildup** | 3 persons slow down and stop walking at Y=2.5m for 6 seconds. | Density rises, average velocity drops below 0.6 m/s. Score exceeds 50. | Transition to AMBER after 5s. Yellow LED turns ON. Single 200ms beep. | PASS |
| **4. Bottleneck Crush Stall** | 3 persons pack tightly together (&lt;0.5m apart) and come to a complete standstill. | Velocity drops &lt; 0.15 m/s. Clustering = 2 pairs. Score exceeds 75. | Transition to RED after 3s. Red LED blinks at 2 Hz. Alarm buzzer sounds. Servo deploys to 90°. | PASS |
| **5. Gate Safety Lockout** | Keep persons stationary. Verify gate remains at 90°. | Score remains &gt; 75. Gate command locked. | Inflow blocked. Gate remains rigidly closed at 90°. | PASS |
| **6. Dispersal & Reset** | Persons disperse and exit corridor. Corridors clear for 30s. | Score drops below 40. Transition back to GREEN. | Green LED ON. Gate automatically returns to 0° after 30s continuous GREEN. | PASS |

---

## Part 6: Troubleshooting Matrix

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **No radar frames parsed / Dropped frames incrementing** | TX and RX crossed or incorrect baud rate. | Ensure radar TX connects to ESP32 GPIO16 (RX2) and radar RX connects to GPIO17 (TX2). Confirm baud is set to `256000`. |
| **Radar drops offline during motor movement** | Brownout caused by servo power spikes. | **Never power SG90 servo from ESP32 3.3V or 5V pin.** Power servo and radar from external regulated 5V supply with shared common GND. |
| **OLED display stays completely black** | I2C address mismatch or loose wiring. | Check SDA (GPIO21) and SCL (GPIO22). In `display.cpp`, the code tests primary address `0x3C` then automatically falls back to `0x3D`. |
| **Servo chatters or vibrates violently** | Floating signal pin or PWM timer conflict. | Ensure `ESP32PWM::allocateTimer()` is called prior to `servo.attach()`. Confirm common ground between ESP32 and external 5V supply. |
| **WiFi connection fails in Wokwi** | Incorrect virtual SSID. | In Wokwi simulation, SSID must strictly be `"Wokwi-GUEST"` with an empty password `""`. |
| **Wokwi reports HTTP POST error (-1 or connection refused)** | ESP32 trying to access `localhost:3000`. | Wokwi is a cloud virtual machine and cannot reach `localhost`. Deploy backend publicly or run an ngrok/Cloudflare tunnel and put the HTTPS URL into `config.h`. |
---

## Part 7: AI Vision Pipeline & Degraded Mode Verification

### 7.1 Run State Machine Unit Tests
Verify all synthetic transition cases, Schmitt-trigger hysteresis, camera health evaluation, measured failover latency, and gate safety logic:
```bash
cd CPR-AI
python3 -m unittest discover -s tests -v
```
All 14 tests should report `OK`.

### 7.2 Run Master Hybrid System
Launch the complete hybrid system:
```bash
# Full stack launch: Node.js server (Port 5050), Dashboards, and AI Vision:
./start_cpr.sh
```

### 7.3 CLI Options for Camera & Video Datasets
```bash
# Replay video dataset with calibrated metric ground plane (e.g. PETS 2009 Benchmark - CC BY 4.0):
python3 CPR-AI/main.py --video path/to/dataset.mp4 --ground-width 2.0 --ground-length 3.0

# Replay video without metric calibration (reports Relative Density):
python3 CPR-AI/main.py --video path/to/dataset.mp4 --uncalibrated

# Run with bench demo zone geometry (1.5m x 2.0m = 3.0 m²):
python3 CPR-AI/main.py --bench
```

