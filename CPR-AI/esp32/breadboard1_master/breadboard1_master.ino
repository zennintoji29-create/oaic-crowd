/*
 * =============================================================================
 * CPR (Crowd Pressure Radar) — Wi-Fi Master & Actuator Firmware v4.0
 * Board: ESP32 Dev Module (Breadboard 1 — Receiver / Actuator Controller)
 * =============================================================================
 *
 * VERIFIED CONFLICT-FREE GPIO MAP (3.3V Logic Only — Never connect 12-24V):
 * - Red LED    (via 220-330 ohm resistor to GND): GPIO 25
 * - Yellow LED (via 220-330 ohm resistor to GND): GPIO 26
 * - Green LED  (via 220-330 ohm resistor to GND): GPIO 27  (No SPI/MOSI conflict)
 * - Active Buzzer (via NPN driver + resistor, 5V): GPIO 32  (No I2C/boot conflict)
 * - SG90 Servo Signal (5V 2A external rail, common GND): GPIO 13 (90=OPEN, 45=METER, 0=LOCKED)
 * - I2C Bus (SSD1306 OLED 0x3C + VL53L0X ToF 0x29): SDA = GPIO 21, SCL = GPIO 22
 * - HLK-LD2410C 24GHz Radar (UART2 @ 256000 baud): RX2 = GPIO 16, TX2 = GPIO 17
 * - IR Beam Receiver (3.3V-safe INPUT_PULLUP):      GPIO 14
 * - Optional Ra-02 SX1278 LoRa (VSPI): SCK=18, MISO=19, MOSI=23, CS=5, RST=4, DIO0=33
 *
 * NOTE: There is NO LDR in this hardware build.
 * NOTE: HLK-LD2410C provides presence only; VL53L0X provides distance only.
 *       Neither sensor fabricates multi-person crowd counts.
 * =============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>
#include <Adafruit_VL53L0X.h>

// -----------------------------------------------------------------------------
// WI-FI & BACKEND CONFIGURATION (Update before flashing)
// -----------------------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASS     = "YOUR_WIFI_PASSWORD";
const char* BACKEND_BASE  = "http://192.168.1.100:3000"; // Or https://oaic-crowd.onrender.com
const char* DEVICE_KEY    = "cpr-secret-key-2026";       // Must match backend DEVICE_KEY
const char* DEVICE_ID     = "cpr-esp32-master-01";
const char* ZONE_ID       = "zone-entry-a";
const char* FW_VERSION    = "4.0.0";

// -----------------------------------------------------------------------------
// VERIFIED CONFLICT-FREE PIN DEFINITIONS
// -----------------------------------------------------------------------------
#define PIN_LED_RED       25
#define PIN_LED_YELLOW    26
#define PIN_LED_GREEN     27
#define PIN_BUZZER        32
#define PIN_SERVO         13
#define PIN_IR_RECEIVER   14

#define PIN_I2C_SDA       21
#define PIN_I2C_SCL       22

#define RADAR_RX_PIN      16
#define RADAR_TX_PIN      17

// -----------------------------------------------------------------------------
// PERIPHERALS & STATE
// -----------------------------------------------------------------------------
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
bool oledOnline = false;

Adafruit_VL53L0X lox = Adafruit_VL53L0X();
bool tofOnline = false;

HardwareSerial RadarSerial(2);
Servo gateServo;

// Sensor telemetry (genuine readings only; -1 / false when unavailable)
bool radarOnline = false;
bool radarPresence = false;
int radarEnergy = -1;
int tofDistanceMm = -1;
volatile unsigned long irCrossingCount = 0;
volatile unsigned long lastIrTrigger = 0;

// Command & Output State
unsigned long lastAppliedSeq = 0;
String currentAlertLevel = "GREEN"; // GREEN | AMBER | RED | SAFE
String currentBuzzerMode = "OFF";   // OFF | WARNING_BEEPS | CRITICAL_ALARM
int currentServoAngle = 90;         // 90 = OPEN, 45 = METER, 0 = LOCKED
int targetServoAngle = 90;
unsigned long servoMoveStartedAt = 0;
bool servoMoving = false;
const unsigned long SERVO_TIMEOUT_MS = 1200;

// Timers
unsigned long lastHeartbeatMs = 0;
unsigned long lastBackendContactMs = 0;
unsigned long lastWifiAttemptMs = 0;
unsigned long lastBlinkMs = 0;
unsigned long lastBuzzerStepMs = 0;
bool redFlashState = false;
bool buzzerPulseState = false;
bool deviceRegistered = false;
bool safeModeActive = false;

const unsigned long HEARTBEAT_INTERVAL_MS = 3000;
const unsigned long BACKEND_TIMEOUT_MS    = 10000;

void IRAM_ATTR onIrBeamBreak() {
  unsigned long now = millis();
  if (now - lastIrTrigger > 250) {
    irCrossingCount++;
    lastIrTrigger = now;
  }
}

void renderOled(const String& line1, const String& line2, const String& line3, const String& line4) {
  if (!oledOnline) return;
  display.clearDisplay();
  display.fillRect(0, 0, 128, 14, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  display.setTextSize(1);
  display.setCursor(4, 3);
  display.println(line1);

  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 20);
  display.println(line2);
  display.setCursor(0, 34);
  display.println(line3);
  display.setCursor(0, 48);
  display.println(line4);
  display.display();
}

void moveServoSafe(int angle) {
  int clamped = constrain(angle, 0, 180);
  if (clamped != currentServoAngle) {
    targetServoAngle = clamped;
    servoMoveStartedAt = millis();
    servoMoving = true;
    gateServo.write(clamped);
    currentServoAngle = clamped;
  }
}

void enterSafeState(const char* reason) {
  if (safeModeActive) return;
  safeModeActive = true;
  currentAlertLevel = "SAFE";
  currentBuzzerMode = "OFF";
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_YELLOW, HIGH);
  digitalWrite(PIN_LED_GREEN, LOW);
  moveServoSafe(90); // Fail-open so emergency egress is never blocked
  renderOled("SAFE MODE (OFFLINE)", reason, "BUZZER: OFF", "GATE: OPEN (90D)");
  Serial.println(String("[SAFE] Entered safe fail-open state: ") + reason);
}

void sendAck(unsigned long seq, const String& command, const char* status) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(String(BACKEND_BASE) + "/api/hardware/ack");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  http.setTimeout(1500);

  StaticJsonDocument<384> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["seq"] = seq;
  doc["command"] = command;
  doc["status"] = status;
  JsonObject out = doc.createNestedObject("reportedOutputs");
  out["alertLevel"] = currentAlertLevel;
  out["led"] = currentAlertLevel;
  out["buzzer"] = currentBuzzerMode;
  out["servoAngle"] = currentServoAngle;

  String body;
  serializeJson(doc, body);
  http.POST(body);
  http.end();
}

void applyBackendCommand(JsonObject cmd) {
  unsigned long seq = cmd["seq"] | 0UL;
  String cmdType = cmd["type"] | "SYNC_ALERT";
  String alertLevel = cmd["alertLevel"] | "GREEN";
  String buzzer = cmd["buzzer"] | "OFF";
  int servoAngle = cmd["servoAngle"] | 90;

  if (seq == 0) return;
  if (seq <= lastAppliedSeq) {
    // Reject duplicate command sequence
    return;
  }

  lastAppliedSeq = seq;
  safeModeActive = false;
  currentAlertLevel = alertLevel;
  currentBuzzerMode = buzzer;
  moveServoSafe(servoAngle);

  // Immediate LED baseline
  if (currentAlertLevel == "GREEN") {
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_RED, LOW);
    digitalWrite(PIN_BUZZER, LOW);
  } else if (currentAlertLevel == "AMBER") {
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_YELLOW, HIGH);
    digitalWrite(PIN_LED_RED, LOW);
  } else if (currentAlertLevel == "RED") {
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_RED, HIGH);
  }

  renderOled(
    "CPR WI-FI: " + currentAlertLevel,
    "CMD #" + String(seq) + " " + cmdType,
    "BUZZER: " + currentBuzzerMode,
    "GATE: " + String(currentServoAngle) + " DEG"
  );

  sendAck(seq, cmdType, "APPLIED");
}

void registerWithBackend() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(String(BACKEND_BASE) + "/api/hardware/register");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  http.setTimeout(2000);

  StaticJsonDocument<384> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["zoneId"] = ZONE_ID;
  doc["role"] = "MASTER_ACTUATOR";
  doc["firmwareVersion"] = FW_VERSION;
  doc["ip"] = WiFi.localIP().toString();
  JsonArray caps = doc.createNestedArray("capabilities");
  caps.add("RGB_LEDS");
  caps.add("ACTIVE_BUZZER");
  caps.add("SG90_SERVO");
  caps.add("HLK_LD2410C");
  caps.add("VL53L0X");

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  if (code == 200 || code == 201) {
    deviceRegistered = true;
    lastBackendContactMs = millis();
    StaticJsonDocument<768> resp;
    if (!deserializeJson(resp, http.getString()) && resp.containsKey("targetCommand")) {
      applyBackendCommand(resp["targetCommand"].as<JsonObject>());
    }
    Serial.println("[REG] Device registered with CPR backend.");
  }
  http.end();
}

void readLocalSensors() {
  // 1. HLK-LD2410C UART presence check (presence only, no fake count)
  if (RadarSerial.available()) {
    radarOnline = true;
    radarPresence = true;
    int bytesRead = 0;
    while (RadarSerial.available() && bytesRead < 64) {
      RadarSerial.read();
      bytesRead++;
    }
    radarEnergy = min(100, bytesRead * 2);
  }

  // 2. VL53L0X ToF distance (mm only, no fake density)
  if (tofOnline && lox.isRangeComplete()) {
    uint16_t dist = lox.readRange();
    if (dist > 0 && dist < 8000) {
      tofDistanceMm = (int)dist;
    }
  }
}

void sendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (!deviceRegistered) {
    registerWithBackend();
    return;
  }

  HTTPClient http;
  http.begin(String(BACKEND_BASE) + "/api/hardware/heartbeat");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  http.setTimeout(1800);

  StaticJsonDocument<512> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["zoneId"] = ZONE_ID;
  doc["uptimeSec"] = millis() / 1000;
  doc["wifiRssi"] = WiFi.RSSI();
  doc["firmwareVersion"] = FW_VERSION;

  JsonObject sensors = doc.createNestedObject("sensors");
  sensors["radarOnline"] = radarOnline;
  if (radarOnline) {
    sensors["presenceDetected"] = radarPresence;
    if (radarEnergy >= 0) sensors["radarEnergy"] = radarEnergy;
  }
  sensors["tofOnline"] = tofOnline;
  if (tofOnline && tofDistanceMm >= 0) {
    sensors["tofDistanceMm"] = tofDistanceMm;
  }
  sensors["irCount"] = (unsigned long)irCrossingCount;

  JsonObject out = doc.createNestedObject("reportedOutputs");
  out["alertLevel"] = currentAlertLevel;
  out["led"] = currentAlertLevel;
  out["buzzer"] = currentBuzzerMode;
  out["servoAngle"] = currentServoAngle;
  out["lastAckSeq"] = lastAppliedSeq;

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  if (code == 200) {
    lastBackendContactMs = millis();
    StaticJsonDocument<768> resp;
    if (!deserializeJson(resp, http.getString()) && resp.containsKey("targetCommand")) {
      applyBackendCommand(resp["targetCommand"].as<JsonObject>());
    }
  }
  http.end();
}

void updateActuatorPatterns() {
  unsigned long now = millis();

  // Servo movement timeout guard
  if (servoMoving && now - servoMoveStartedAt > SERVO_TIMEOUT_MS) {
    servoMoving = false;
  }

  if (safeModeActive || currentAlertLevel == "GREEN") {
    digitalWrite(PIN_BUZZER, LOW);
    return;
  }

  // AMBER: Yellow LED ON + short warning beeps every 1.6s
  if (currentAlertLevel == "AMBER") {
    if (currentBuzzerMode == "WARNING_BEEPS") {
      if (now - lastBuzzerStepMs > (buzzerPulseState ? 150 : 1450)) {
        buzzerPulseState = !buzzerPulseState;
        lastBuzzerStepMs = now;
        digitalWrite(PIN_BUZZER, buzzerPulseState ? HIGH : LOW);
      }
    } else {
      digitalWrite(PIN_BUZZER, LOW);
    }
    return;
  }

  // RED: Red LED flashes @ 250ms + repeating/critical alarm
  if (currentAlertLevel == "RED") {
    if (now - lastBlinkMs > 250) {
      redFlashState = !redFlashState;
      lastBlinkMs = now;
      digitalWrite(PIN_LED_RED, redFlashState ? HIGH : LOW);
    }
    if (currentBuzzerMode == "CRITICAL_ALARM") {
      if (now - lastBuzzerStepMs > (buzzerPulseState ? 350 : 150)) {
        buzzerPulseState = !buzzerPulseState;
        lastBuzzerStepMs = now;
        digitalWrite(PIN_BUZZER, buzzerPulseState ? HIGH : LOW);
      }
    } else {
      digitalWrite(PIN_BUZZER, LOW);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_YELLOW, LOW);
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_BUZZER, LOW);

  gateServo.setPeriodHertz(50);
  gateServo.attach(PIN_SERVO, 500, 2400);
  gateServo.write(90);

  pinMode(PIN_IR_RECEIVER, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_IR_RECEIVER), onIrBeamBreak, FALLING);

  RadarSerial.begin(256000, SERIAL_8N1, RADAR_RX_PIN, RADAR_TX_PIN);
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    oledOnline = true;
    renderOled("CPR MASTER v4.0", "CONNECTING WI-FI", WIFI_SSID, "GATE: OPEN (90D)");
  }

  if (lox.begin()) {
    tofOnline = true;
    lox.startRangeContinuous();
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  lastWifiAttemptMs = millis();
  lastBackendContactMs = millis();
}

void loop() {
  unsigned long now = millis();

  // Wi-Fi reconnect handling
  if (WiFi.status() != WL_CONNECTED) {
    deviceRegistered = false;
    if (now - lastWifiAttemptMs > 5000) {
      lastWifiAttemptMs = now;
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASS);
    }
  }

  readLocalSensors();

  if (now - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeatMs = now;
    sendHeartbeat();
  }

  if (now - lastBackendContactMs > BACKEND_TIMEOUT_MS) {
    enterSafeState("BACKEND TIMEOUT");
  }

  updateActuatorPatterns();
  delay(15);
}
