# oaic-crowd — Crowd Pressure Radar (CPR)

> **Odisha AI Hackathon 2026: An autonomous, hybrid Edge AI & IoT crowd-safety early-warning system for festival, temple, and mass gathering corridors combining YOLO11n Computer Vision with 24 GHz mmWave radar and IoT telemetry.**

---

## 📚 Theoretical Citations & Mathematical Grounding

The CPR safety engine is grounded strictly in academic crowd science and pedestrian transport engineering:

1. **Walkway Level of Service (LoS)**:
   - **Primary Citation**: John J. Fruin, *"Pedestrian Planning and Design"*, Metropolitan Association of Urban Designers and Environmental Planners (MAUDEP), 1971.
   - **Industry Standard**: Transportation Research Board (TRB), *"Highway Capacity Manual"* (HCM 2010), Chapter 23: Off-Street Pedestrian Facilities.
   - **Walkway LoS Scale**:
     - **LoS A**: $> 3.24\text{ m}^2/\text{p}\ (< 0.31\text{ p/m}^2)$ — Free pedestrian flow.
     - **LoS B**: $2.32 - 3.24\text{ m}^2/\text{p}\ (0.31 - 0.43\text{ p/m}^2)$ — Fluid flow, minor conflicts.
     - **LoS C**: $1.39 - 2.32\text{ m}^2/\text{p}\ (0.43 - 0.72\text{ p/m}^2)$ — Normal walking speeds.
     - **LoS D**: $0.93 - 1.39\text{ m}^2/\text{p}\ (0.72 - 1.08\text{ p/m}^2)$ — Flow restricted, bypasses difficult (**C/D Boundary: GREEN $\to$ AMBER**).
     - **LoS E**: $0.46 - 0.93\text{ m}^2/\text{p}\ (1.08 - 2.17\text{ p/m}^2)$ — Capacity limit, shuffling queue.
     - **LoS F**: $< 0.46\text{ m}^2/\text{p}\ (> 2.17\text{ p/m}^2)$ — Flow breakdown and queue jam.

2. **Compressive Crowd Crush Mechanics**:
   - **Citations**: G. Keith Still, *"Introduction to Crowd Science"*, CRC Press, 2014; Dirk Helbing, Anders Johansson, Habib Zein Al-Abideen, *"Dynamics of crowd disasters: An empirical study"*, Physical Review E 75(4), 046109, 2007.
   - **Two-Tier Safety Scale**: Walkway LoS F ($2.17\text{ p/m}^2$) represents congested slow walking, **not** fatal crowd collapse. True compressive physical forces start emerging at $3.50\text{ p/m}^2$ and become critical at $4.0 - 5.0+\text{ p/m}^2$.
   - **CPR Thresholds**:
     - **GREEN $\to$ AMBER Warning**: Governed by Fruin Walkway LoS ($0.72 - 1.08\text{ p/m}^2$).
     - **AMBER $\to$ RED Emergency**: Governed by Compressive Hazard Scale ($\ge 3.50\text{ p/m}^2$ or severe stall with high density).

---

## 🔬 Hardware Specifications & Degraded Mode Fallback

### Sensor Inventory & Limitations
- **Primary AI Vision**: USB / IP Camera streaming at $640 \times 480$ @ 30 FPS with YOLO11n + ByteTrack and 4-point planar floor homography.
- **Radar Hardware**: Confirmed **HLK-LD2410C** 24 GHz FMCW radar (Breadboard 1). It detects human presence, moving/stationary distance, and energy gates across a single-file zone. **It cannot count dense crowds in an open plaza.**
- **Optical Sensors**: VL53L0X Time-of-Flight distance sensor ($< 1.2\text{ m}$ reliable range) + IR break-beam counter (Breadboard 2).

### Degraded Mode Architecture ("Stall Detection + Metering")
When camera vision collapses or disconnects, the system switches to **Degraded Mode** tailored for a single-file corridor bottleneck ($60 - 90\text{ cm}$ gate aperture):
- **Throughput ($PPM$)**: Measured continuously by IR break-beam triggers and ToF distance fluctuations (people per minute).
- **Stall & Dwell ($s$)**: Measured by the HLK-LD2410C radar monitoring stationary presence at the gate aperture.
- **Rolling Baseline ($PPM$)**: A rolling EMA baseline ($\alpha = 0.05$) adapts to natural flow during GREEN. **Crucially, baseline updates are frozen during non-GREEN states.** An absolute floor ($< 2.0\text{ PPM}$) ensures near-zero throughput with stationary dwell is always flagged as a bottleneck stall.

### Gate Safety & Fail-Open Philosophy
- **Hub Loss / Wi-Fi Disconnect**: The ESP32 node **MUST NOT fail open**. If network link to the dashboard drops, the ESP32 autonomously executes its local state machine and continues metering the gate.
- **Fail-Open Triggers**: Gate actuator immediately opens upon:
  1. Firmware crash or Hardware Watchdog (WDT) reset.
  2. Local sensor bus failure (I2C/UART bus fault).
  3. Manual emergency stop (E-stop).
- **Physical Actuator Disclaimer**: The bench demonstration utilizes an SG90 micro-servo (which holds last position when unpowered). In production, an electromagnetic latch with a **spring- or gravity-loaded drop-arm barrier** is mandatory to ensure mechanical fail-open upon total electrical power loss.

---

## ⚠️ Crucial Safety & Demonstration Disclaimer

**THIS SYSTEM IS A FUNCTIONAL PROTOTYPE DESIGNED FOR DEMONSTRATION, RESEARCH, AND EDUCATIONAL PURPOSES ONLY.**

- **Not Life-Safety Certified**: It has **not** been tested, certified, or approved under NFPA 101, EN 13200, ISO 22398, or OSHA standards for life-safety critical evacuation or crowd crush containment.
- **Kinematic Proxy Only**: Crowd crush phenomena involve multi-directional bio-mechanical compressive forces exceeding thousands of Newtons. This radar system measures anonymous position coordinates and Doppler radial velocity; it **does not and cannot measure physical mechanical force** between human bodies.
- **Never Rely Solely on Automated Actuators**: This system must **never** be used as a standalone or primary safety barrier, nor replace trained crowd marshals, free physical egress avenues, or official disaster mitigation protocols.

---

## 🔒 Privacy-First Architecture

Unlike traditional computer-vision solutions:
- **Zero Optical Sensors / No Cameras**: Relies strictly on millimeter-wave RF reflections (24 GHz FMCW).
- **No Facial Recognition or Biometric Capture**: Radar targets consist only of relative $X, Y$ coordinates (in mm) and Doppler radial speed (in cm/s).
- **All-Weather & Dust Resilient**: Unaffected by smoke, festival dust, low-light night conditions, or monsoon rain.
- **Ephemeral Point Processing**: Raw coordinates are converted into statistical density metrics and discarded immediately. No raw tracking histories are preserved beyond the 10-minute sliding dashboard buffer.

---

## 📁 Project Repository Structure

```
crowd-pressure-radar/
├── firmware/                        # ESP32 Arduino/PlatformIO Embedded Firmware
│   ├── platformio.ini              # Build configuration & exact dependency versions
│   ├── wokwi.toml                  # Wokwi simulation descriptor
│   ├── diagram.json                # Complete virtual circuit wiring schematic
│   ├── wokwi_sketch.ino            # Complete single-file sketch for Wokwi Web IDE
│   ├── include/
│   │   ├── pins.h                  # Hardware pin mappings (GPIOs)
│   │   ├── config.h                # System weights, calibration, and network settings
│   │   ├── radar_driver.h          # Real HLK-LD2450 UART frame parser interface
│   │   ├── mock_radar.h            # Synthetic crowd simulation driver
│   │   ├── analytics.h             # Pure mathematical crowd analytics functions
│   │   ├── state_machine.h         # 3-state hysteresis queue engine
│   │   ├── actuators.h             # LED indicators, buzzer alarm & servo barrier
│   │   ├── display.h               # SSD1306 OLED 3-page rotary view
│   │   └── network.h               # WiFi, HTTP telemetry POST & command polling
│   └── src/
│       ├── radar_driver.cpp        # LD2450 protocol decoder (AA FF 03 00 ... 55 CC)
│       ├── mock_radar.cpp          # Crowd flow, stall event & recovery simulator
│       ├── analytics.cpp           # Density, speed, stop-go stddev & clustering
│       ├── state_machine.cpp       # GREEN -> AMBER -> RED state machine
│       ├── actuators.cpp           # Non-blocking LED strobe & servo actuation
│       ├── display.cpp             # 128x64 I2C OLED rotary screens
│       ├── network.cpp             # Resilient telemetry ring-buffer & flush
│       └── main.cpp                # Non-blocking event loop & Serial CLI
├── backend/                         # Node.js 20 + Express Telemetry & Command Server
│   ├── package.json                # Server dependencies & scripts
│   ├── .env.example                # Port, CORS, and device authentication keys
│   └── src/
│       ├── config.js               # Environment config & constants
│       ├── schema.js               # Zod validation schemas for telemetry & commands
│       ├── storage.js              # Ring-buffer (1000 pts), alerts log & command queue
│       ├── simulator.js            # Synthetic multi-zone queue telemetry generator
│       └── index.js                # Express REST API & WebSocket broadcast server
├── frontend/                        # Next-gen React + Vite + Tailwind + Recharts
│   ├── package.json                # Dashboard dependencies & scripts
│   ├── vite.config.ts              # Vite & Vitest configuration
│   ├── tailwind.config.js          # Design system color and surface tokens
│   ├── tokens.json                 # Exported design tokens (WCAG AA high-contrast)
│   └── src/
│       ├── types.ts                # TypeScript interfaces
│       ├── lib/
│       │   ├── tokens.ts           # Design tokens helper & risk score formula
│       │   ├── api.ts              # REST & WebSocket client calls
│       │   └── analytics.test.ts   # Vitest unit tests (6 passing tests)
│       └── components/
│           ├── Navbar.tsx          # Status banner, live WS indicator, tabs
│           ├── Gauge.tsx           # Semicircular SVG Risk Score meter
│           ├── ZoneCard.tsx        # High-visibility card with tablet-sized text
│           ├── ConfirmModal.tsx    # Safety confirmation dialog for gate operations
│           ├── OverviewTab.tsx     # Global status banner & multi-zone overview
│           ├── ZoneDetailTab.tsx   # Live Recharts time-series & actuator commands
│           ├── AlertsTab.tsx       # Filterable table & CSV audit trail export
│           ├── SetupTab.tsx        # Zone geometry editor & C++ snippet generator
│           └── AboutTab.tsx        # Full safety disclaimer & mathematical formula
├── STEPS.md                         # Detailed step-by-step execution & testing guide
├── TEST_CHECKLIST.md                # Verification checklist for bench & field testing
└── README.md                        # Project documentation
```

---

## ⚡ Quick Start: 3 Ways to Run

### Method 0: Master CPR Launcher (macOS / Linux)
```bash
# Run one script to start Telemetry Server (Port 5050), Browser Dashboards, and AI Vision Engine:
./start_cpr.sh
```

### Video Dataset Replay Mode & Bench Geometry
```bash
# Replay video dataset with calibrated metric ground plane (e.g. PETS 2009 Benchmark - CC BY 4.0):
python3 CPR-AI/main.py --video path/to/dataset.mp4 --ground-width 2.0 --ground-length 3.0

# Replay video dataset with unknown floor geometry (reports "Relative Density (norm)"):
python3 CPR-AI/main.py --video path/to/dataset.mp4 --uncalibrated

# Run with bench demo zone (1.5m x 2.0m = 3.0 m²):
python3 CPR-AI/main.py --bench

# Run unit tests:
cd CPR-AI && python3 -m unittest discover -s tests -v
```

### Method 1: Instant Browser Simulation on Wokwi (No Hardware)
1. Open [Wokwi ESP32 Simulator](https://wokwi.com/projects/new/esp32).
2. Replace `diagram.json` with the contents of [`firmware/diagram.json`](file:///Users/subhadip/subhansu'/oaic-crowd/firmware/diagram.json).
3. Replace `sketch.ino` with [`firmware/wokwi_sketch.ino`](file:///Users/subhadip/subhansu'/oaic-crowd/firmware/wokwi_sketch.ino).
4. In `libraries.txt`, add:
   ```text
   ArduinoJson
   Adafruit SSD1306
   Adafruit GFX Library
   ESP32Servo
   ```
5. Click **Play**! Watch the synthetic crowd enter free flow, stall, trigger the 90° servo gate lockout, and recover.

### Method 2: Run Backend & Dashboard Locally
```bash
# Terminal 1: Backend
cd backend
npm install
npm start

# Terminal 2: Frontend Dashboard
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` and click the **Simulate** button on the navbar to see live animated charts and alerts.

### Method 3: Connect Wokwi to Local Dashboard via Tunnel
Because Wokwi runs in the cloud and cannot reach `http://localhost:3000`, tunnel your local backend:
```bash
# In another terminal:
ngrok http 3000
# or: cloudflared tunnel --url http://localhost:3000
```
Copy the `https://...` forwarding URL into `SERVER_URL` in `firmware/include/config.h` (or in Wokwi's `sketch.ino`). Now Wokwi streams live telemetry straight into your web dashboard!

---

## 📐 Mathematical Formulation of Risk Score

The composite risk score ($0 - 100$) is calculated at 5 Hz from 4 weighted variables:

$$\text{Risk Score} = (0.40 \times S_{\text{density}}) + (0.30 \times S_{\text{speed}}) + (0.20 \times S_{\text{stop-go}}) + (0.10 \times S_{\text{clustering}})$$

Where:
- $S_{\text{density}} = \min\left(100, \frac{\text{Density}}{4.0} \times 100\right)$ (critical density baseline: 4.0 ppl/m²)
- $S_{\text{speed}} = \min\left(100, \max\left(0, \frac{1.3 - v_{\text{avg}}}{1.3 - 0.15} \times 100\right)\right)$ (stall speed: $\le 0.15$ m/s)
- $S_{\text{stop-go}} = \min\left(100, \frac{\sigma_v}{0.60} \times 100\right)$ (velocity standard deviation window of 20 samples)
- $S_{\text{clustering}} = \min(100, \text{pairs}_{<0.5m} \times 50)$ (inter-person compression proxy)

### Hysteresis State Machine
- **GREEN $\to$ AMBER**: Score $\ge 50$ for $\ge 5$ seconds
- **AMBER $\to$ RED**: Score $\ge 75$ for $\ge 3$ seconds
- **RED $\to$ AMBER**: Score $< 65$ for $\ge 10$ seconds
- **AMBER $\to$ GREEN**: Score $< 40$ for $\ge 10$ seconds
- **Gate Barrier (Servo)**: Deploys to 90° immediately at RED; automatically resets to 0° only after **30 seconds of continuous GREEN**.

---

## 📦 Exact Software & Library Dependencies

### Embedded Firmware (PlatformIO / Arduino)
- **Framework**: Arduino ESP32 (`espressif32@6.5.0`)
- **ArduinoJson**: `^7.0.4` (telemetry serialization)
- **Adafruit SSD1306**: `^2.5.10` (I2C OLED driver)
- **Adafruit GFX**: `^1.11.9` (graphics primitives)
- **ESP32Servo**: `^3.0.5` (PWM barrier control)

### Backend (Node.js 20+)
- **express**: `^4.19.2` (REST server)
- **ws**: `^8.17.0` (WebSocket broadcast server)
- **zod**: `^3.23.8` (runtime telemetry validation)
- **cors**: `^2.8.5` (CORS policies)
- **dotenv**: `^16.4.5` (environment variables)

### Frontend Dashboard
- **react**: `^18.3.1`
- **react-dom**: `^18.3.1`
- **recharts**: `^2.12.7` (real-time telemetry graphs)
- **lucide-react**: `^0.395.0` (accessible state icons)
- **tailwindcss**: `^3.4.3` (design system tokens)
- **vitest**: `^1.6.0` (unit test suite)

