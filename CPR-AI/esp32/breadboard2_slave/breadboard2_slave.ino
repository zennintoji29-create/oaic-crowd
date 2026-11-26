/*
 * =============================================================================
 * CPR (Crowd Pressure Radar) — Wi-Fi Transmitter / Sensor Node Firmware v4.0
 * Board: ESP32 Dev Module (Breadboard 2 — Perimeter Sensor)
 * =============================================================================
 *
 * VERIFIED CONFLICT-FREE GPIO MAP (3.3V Logic Only):
 * - IR Beam Break Sensor (3.3V-safe INPUT_PULLUP): GPIO 14
 * - Built-in Status LED:                           GPIO 2
 * - Optional Ra-02 SX1278 LoRa (VSPI): SCK=18, MISO=19, MOSI=23, CS=5, RST=4, DIO0=26
 *
 * NOTE: There is NO LDR in this hardware build.
 * =============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID    = "YOUR_WIFI_SSID";
const char* WIFI_PASS    = "YOUR_WIFI_PASSWORD";
const char* BACKEND_BASE = "http://192.168.1.100:3000";
const char* DEVICE_KEY   = "cpr-secret-key-2026";
const char* DEVICE_ID    = "cpr-esp32-tx-01";
const char* ZONE_ID      = "zone-entry-a";
const char* FW_VERSION   = "4.0.0";

#define PIN_IR_BEAM      14
#define PIN_STATUS_LED   2

volatile unsigned long lastTriggerTime = 0;
volatile unsigned long beamBreakCount = 0;
volatile bool beamBrokenFlag = false;
const unsigned long DEBOUNCE_DELAY_MS = 250;

unsigned long lastHeartbeatMs = 0;
unsigned long lastWifiAttemptMs = 0;
bool deviceRegistered = false;

void IRAM_ATTR onBeamBreak() {
  unsigned long now = millis();
  if (now - lastTriggerTime > DEBOUNCE_DELAY_MS) {
    beamBreakCount++;
    beamBrokenFlag = true;
    lastTriggerTime = now;
  }
}

void registerNode() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(String(BACKEND_BASE) + "/api/hardware/register");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  http.setTimeout(2000);

  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["zoneId"] = ZONE_ID;
  doc["role"] = "TRANSMITTER_SENSOR";
  doc["firmwareVersion"] = FW_VERSION;
  doc["ip"] = WiFi.localIP().toString();
  JsonArray caps = doc.createNestedArray("capabilities");
  caps.add("IR_BEAM");

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  if (code == 200 || code == 201) {
    deviceRegistered = true;
    Serial.println("[TX] Registered with CPR backend.");
  }
  http.end();
}

void sendTelemetry() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (!deviceRegistered) {
    registerNode();
    return;
  }

  HTTPClient http;
  http.begin(String(BACKEND_BASE) + "/api/hardware/heartbeat");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_KEY);
  http.setTimeout(1500);

  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["zoneId"] = ZONE_ID;
  doc["uptimeSec"] = millis() / 1000;
  doc["wifiRssi"] = WiFi.RSSI();
  doc["firmwareVersion"] = FW_VERSION;
  JsonObject sensors = doc.createNestedObject("sensors");
  sensors["irCount"] = (unsigned long)beamBreakCount;

  String body;
  serializeJson(doc, body);
  http.POST(body);
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  pinMode(PIN_IR_BEAM, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_IR_BEAM), onBeamBreak, FALLING);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  lastWifiAttemptMs = millis();
}

void loop() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED) {
    deviceRegistered = false;
    if (now - lastWifiAttemptMs > 5000) {
      lastWifiAttemptMs = now;
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASS);
    }
  }

  if (beamBrokenFlag) {
    beamBrokenFlag = false;
    digitalWrite(PIN_STATUS_LED, HIGH);
    sendTelemetry();
    delay(40);
    digitalWrite(PIN_STATUS_LED, LOW);
  }

  if (now - lastHeartbeatMs >= 3000) {
    lastHeartbeatMs = now;
    sendTelemetry();
  }

  delay(10);
}
