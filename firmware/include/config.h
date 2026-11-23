#pragma once

#include <Arduino.h>

/**
 * ============================================================================
 * CROWD PRESSURE RADAR - SYSTEM CONFIGURATION & CALIBRATION
 * ============================================================================
 * 
 * THEORETICAL CITATIONS & FORMULA GROUNDING:
 * 1. Walkway Level of Service (LoS):
 *    John J. Fruin, "Pedestrian Planning and Design", Metropolitan Association of
 *    Urban Designers and Environmental Planners (MAUDEP), 1971.
 *    TRB Highway Capacity Manual (HCM 2010), Chapter 23.
 *    - LoS C/D boundary: 0.72 p/m² (normal flow begins to restrict)
 *    - LoS D/E boundary: 1.08 p/m² (queue shuffling)
 * 2. Crowd Crush Hazard (Compressive Mechanics):
 *    G. Keith Still, "Introduction to Crowd Science", CRC Press, 2014.
 *    Dirk Helbing et al., "Dynamics of crowd disasters", Phys. Rev. E, 2007.
 *    - Walkway LoS F (2.17 p/m²) is slow queuing, NOT physical crush hazard.
 *    - Mechanical crush forces occur at 3.50 - 4.50+ p/m².
 * 
 * SENSOR HARDWARE SPECIFICATION & DEGRADED MODE:
 * - Bench Hardware: HLK-LD2410C 24GHz FMCW Radar (single-target presence, distance, energy)
 *   combined with VL53L0X ToF (depth < 1.2m) and IR break-beam counter.
 * - Degraded Mode Topology: Single-file corridor gate aperture (60-90 cm width).
 * - Degraded Logic: IR beam + ToF provide throughput (PPM: people/min).
 *   LD2410C radar detects stationary dwell time at the bottleneck gate.
 *   Throughput collapse while dwell rises indicates a physical stall -> AMBER, then RED.
 * 
 * GATE SAFETY & FAIL-OPEN SPECIFICATION:
 * - Hub Heartbeat Loss: ESP32 MUST NOT fail open. A Wi-Fi drop or hub loss maintains
 *   autonomous local state machine and metering to preserve crowd safety.
 * - Fail-Open Paths: Immediate unpowered/open state on:
 *     (a) Hardware Watchdog Timeout (WDT) or kernel panic reset
 *     (b) Unrecoverable local sensor bus failure (I2C/UART fault)
 *     (c) Manual Emergency Stop (E-Stop)
 * - Industrial Actuation Note: An SG90 micro-servo holds last position upon power cut.
 *   In production installations, an electromagnetic latch with spring- or gravity-loaded
 *   drop-arm barrier is utilized to achieve fail-open by default upon total power loss.
 */

// ----------------------------------------------------------------------------
// Network & Server Connectivity
// ----------------------------------------------------------------------------
#ifndef WIFI_SSID
#define WIFI_SSID "Wokwi-GUEST"
#endif

#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD ""
#endif

// Server base URL without trailing slash.
// For local testing: "http://10.0.2.2:3000" or your computer's LAN IP e.g. "http://192.168.1.100:3000"
// For Wokwi cloud simulation reaching a local or deployed backend:
// Replace with your public URL (ngrok, cloudflared, Railway, or Render)
#ifndef SERVER_URL
#define SERVER_URL "http://10.0.2.2:3000"
#endif

#define DEVICE_ID        "esp32-radar-01"
#define ZONE_ID          "zone-entry-a"
#define DEVICE_KEY       "cpr-secret-key-2026"
#define FIRMWARE_VERSION "1.0.0"

// ----------------------------------------------------------------------------
// Zone Geometry & Radar Specs
// ----------------------------------------------------------------------------
// LD2450 coordinates: X from -3000 mm to +3000 mm (6 m span), Y from 0 to 6000 mm (6 m depth)
constexpr float DEFAULT_ZONE_AREA_SQM = 24.0f;  // 6m length x 4m effective corridor width = 24 m²
constexpr float CORRIDOR_WIDTH_M     = 4.0f;
constexpr uint32_t LD2450_BAUD_RATE   = 256000;

// Compile-time Mock mode fallback if hardware switch is open or undefined
#ifndef DEFAULT_MOCK_MODE
#define DEFAULT_MOCK_MODE true
#endif

// ----------------------------------------------------------------------------
// Analytics Weighting & Calibration Parameters
// ----------------------------------------------------------------------------
// Risk Score (0 - 100) = (W_DENSITY * S_d) + (W_LOW_SPEED * S_s) + 
//                        (W_STOP_GO * S_sg) + (W_CLUSTERING * S_c)
// Total weights sum strictly to 1.0
constexpr float WEIGHT_DENSITY      = 0.40f; // Critical factor: excessive crowd concentration
constexpr float WEIGHT_LOW_SPEED    = 0.30f; // Movement cessation: crowd stagnation / bottleneck
constexpr float WEIGHT_STOP_AND_GO  = 0.20f; // Turbulence proxy: jerky, stop-start shockwaves
constexpr float WEIGHT_CLUSTERING   = 0.10f; // Inter-target compression: pair distance < 0.5 m

// Dynamic Metric Normalization Baselines
constexpr float DENSITY_CRITICAL_THRESHOLD = 4.0f;  // 4.0 persons / m² equates to 100% density risk
constexpr float SPEED_NORMAL_MPS           = 1.30f; // Nominal walking speed: 1.3 m/s
constexpr float SPEED_STALL_MPS            = 0.15f; // Critical crawl/stall speed: <= 0.15 m/s (100% risk)
constexpr float STOP_GO_MAX_STDDEV         = 0.60f; // Standard deviation of speed >= 0.6 m/s is maximum shock
constexpr float CLUSTERING_DISTANCE_M      = 0.50f; // Proximity threshold for pair compression: 0.5 m (500 mm)
constexpr uint8_t SPEED_WINDOW_SIZE        = 20;    // Number of historical speed samples for std-dev

// ----------------------------------------------------------------------------
// State Machine & Hysteresis Timing (ms)
// ----------------------------------------------------------------------------
constexpr float SCORE_AMBER_THRESHOLD = 50.0f;
constexpr float SCORE_RED_THRESHOLD   = 75.0f;
constexpr float HYSTERESIS_MARGIN     = 10.0f; // Score must stay below (Threshold - 10) to de-escalate

constexpr uint32_t DURATION_ESCALATE_AMBER_MS = 5000;  // Must exceed AMBER score for 5 s
constexpr uint32_t DURATION_ESCALATE_RED_MS   = 3000;  // Must exceed RED score for 3 s
constexpr uint32_t DURATION_DEESCALATE_MS     = 10000; // Must stay below threshold - 10 for 10 s

// Gate Barrier Servo Angles & Cooldown
constexpr int SERVO_OPEN_ANGLE           = 0;     // Unobstructed flow
constexpr int SERVO_CLOSED_ANGLE         = 90;    // Barrier deployed across queue
constexpr uint32_t SERVO_RESET_DELAY_MS  = 30000; // 30 seconds of continuous GREEN before gate resets

// ----------------------------------------------------------------------------
// Degraded Mode (LD2410C + ToF + IR Beam) Calibration Constants
// ----------------------------------------------------------------------------
constexpr uint32_t DEGRADED_BASELINE_WARMUP_MS   = 60000; // 60s baseline warmup
constexpr float    DEGRADED_BASELINE_INITIAL_PPM = 20.0f; // Nominal baseline before warmup
constexpr float    DEGRADED_ABSOLUTE_MIN_PPM     = 2.0f;  // Throughput below 2 PPM is ALWAYS a stall
constexpr float    DEGRADED_AMBER_RATIO          = 0.40f; // Drop below 40% baseline -> AMBER
constexpr float    DEGRADED_RED_RATIO            = 0.15f; // Drop below 15% baseline -> RED
constexpr uint32_t DEGRADED_AMBER_DWELL_MS       = 3500;  // 3.5s stationary dwell -> AMBER
constexpr uint32_t DEGRADED_RED_DWELL_MS         = 6000;  // 6.0s stationary dwell -> RED

// Fail-Open Safety Definitions
constexpr bool FAIL_OPEN_ON_WDT_PANIC     = true; // WDT timeout or abort() fails open
constexpr bool FAIL_OPEN_ON_SENSOR_FAULT  = true; // Hardware I2C/UART bus fault fails open
constexpr bool FAIL_OPEN_ON_ESTOP         = true; // E-stop triggers fail-open
constexpr bool FAIL_OPEN_ON_HUB_LOSS      = false; // HUB LOSS MUST NOT FAIL OPEN (autonomous metering continues)

// ----------------------------------------------------------------------------
// Periodic Task Timers (ms)
// ----------------------------------------------------------------------------
constexpr uint32_t INTERVAL_ANALYTICS_MS   = 200;   // 5 Hz analytics update
constexpr uint32_t INTERVAL_DISPLAY_PAGE_MS = 3000;  // Rotate OLED screen every 3 s
constexpr uint32_t INTERVAL_TELEMETRY_MS   = 1000;  // Post telemetry every 1 s
constexpr uint32_t INTERVAL_CMD_POLL_MS    = 2000;  // Poll backend commands every 2 s
constexpr size_t   OFFLINE_BUFFER_CAPACITY = 50;    // Queue up to 50 unsent packets when offline

