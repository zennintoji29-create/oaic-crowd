/*
 * =============================================================================
 * CPR (Crowd Pressure Radar) — ESP32 #1: TRANSMITTER (Wi-Fi + Sensors + LoRa)
 * =============================================================================
 * Exact Pin Map:
 *   LoRa SX1278 : SCK=18, MISO=19, MOSI=23, NSS=13, RST=27, DIO0=26 (3.3V)
 *   OLED 0x3C   : SDA=21, SCL=22 (3.3V)
 *   VL53L0X ToF : SDA=21, SCL=22 (3.3V)
 *   HLK-LD2410C : TX->16, RX->17, OUT=32 (5V VCC, Common GND)
 *   LDR Analog  : AO=34
 *
 * Features:
 *   1. Reads HLK-LD2410C presence, VL53L0X ToF distance (mm), and LDR light level
 *   2. Shows live status + dashboard alert level on SSD1306 OLED
 *   3. Connects to Wi-Fi and sends /api/hardware/register + /api/hardware/heartbeat
 *      every 3 seconds to your CPR Backend (local PC IP or Render URL)
 *   4. Broadcasts LoRa packet ("CPR,<seq>,<ldr>,<distance>,<presence>,<alert>")
 *      for ESP32 #2 (Receiver)
 * =============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <SPI.h>
#include <LoRa.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_VL53L0X.h>

// -----------------------------------------------------------------------------
// 1. WI-FI & BACKEND CONFIG (EDIT THESE BEFORE UPLOADING)
// -----------------------------------------------------------------------------
const char* WIFI_SSID    = "YOUR_WIFI_SSID";
const char* WIFI_PASS    = "YOUR_WIFI_PASSWORD";

// Use your PC's local IP when testing locally (e.g. "http://192.168.1.105:3000")
// OR your Render HTTPS URL (e.g. "https://oaic-crowd.onrender.com")
const char* BACKEND_BASE = "https://oaic-crowd.onrender.com";
const char* DEVICE_KEY   = "cpr-secret-key-2026";
const char* DEVICE_ID    = "cpr-esp32-tx-01";
const char* ZONE_ID      = "zone-entry-a";
const char* FW_VERSION   = "4.1.0";

// -----------------------------------------------------------------------------
// 2. HARDWARE PINS (MATCHING YOUR WIRING)
// -----------------------------------------------------------------------------
#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23
#define LORA_SS    13
#define LORA_RST   27
#define LORA_DIO0  26

#define HLK_OUT    32
#define HLK_RX     16
#define HLK_TX     17
#define LDR_PIN    34

#define OLED_ADDR  0x3C

Adafruit_SSD1306 display(128, 64, &Wire, -1);
Adafruit_VL53L0X tof = Adafruit_VL53L0X();

bool oledReady = false;
bool tofReady  = false;
bool loraReady = false;
bool registeredWithBackend = false;

unsigned long sequenceNumber = 0;
unsigned long lastLoopMs = 0;
unsigned long lastBackendMs = 0;
String dashboardAlertLevel = "GREEN";

// Helper for HTTP or HTTPS POST
int postJson(const String& url, const String& payload, String& responseOut) {
  HTTPClient http;
  WiFiClientSecure secureClient;
  bool isHttps = url.startsWith("https://");

  if (isHttps) {
    secureClient.setInsecure(); // Allow Render/cloud HTTPS without cert bundle
    if (!http.begin(secureClient, url)) return -1;
  } else {
    if (!http.begin(url)) return -1;
  }

  http.setTimeout(6000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  int code = http.POST(payload);
  if (code > 0) {
    responseOut = http.getString();
  }
  http.end();
  return code;
}

void registerDevice() {
  if (WiFi.status() != WL_CONNECTED) return;

  String caps = "[\"HLK-LD2410C\",\"VL53L0X\",\"LDR\",\"SSD1306\"";
  if (loraReady) caps += ",\"SX1278_LORA\"";
  caps += "]";

  String body = "{";
  body += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  body += "\"zoneId\":\"" + String(ZONE_ID) + "\",";
  body += "\"role\":\"TRANSMITTER_SENSOR\",";
  body += "\"firmwareVersion\":\"" + String(FW_VERSION) + "\",";
  body += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  body += "\"capabilities\":" + caps;
  body += "}";

  String resp;
  int code = postJson(String(BACKEND_BASE) + "/api/hardware/register", body, resp);
  if (code >= 200 && code < 300) {
    registeredWithBackend = true;
    Serial.println("[WIFI] Registered with CPR Backend!");
  } else {
    Serial.printf("[WIFI] Register failed (HTTP %d)\n", code);
  }
}

void sendHeartbeat(int presence, int distanceMm, int ldrRaw) {
  if (WiFi.status() != WL_CONNECTED) return;
  if (!registeredWithBackend) {
    registerDevice();
  }

  String tofVal = (distanceMm >= 0) ? String(distanceMm) : "null";
  String body = "{";
  body += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  body += "\"zoneId\":\"" + String(ZONE_ID) + "\",";
  body += "\"uptimeSec\":" + String(millis() / 1000) + ",";
  body += "\"wifiRssi\":" + String(WiFi.RSSI()) + ",";
  body += "\"firmwareVersion\":\"" + String(FW_VERSION) + "\",";
  body += "\"sensors\":{";
  body += "\"presenceDetected\":" + String(presence == 1 ? "true" : "false") + ",";
  body += "\"radarEnergy\":" + String(presence ? 75 : 5) + ",";
  body += "\"radarOnline\":true,";
  body += "\"tofDistanceMm\":" + tofVal + ",";
  body += "\"tofOnline\":" + String(tofReady ? "true" : "false");
  body += "}}";

  String resp;
  int code = postJson(String(BACKEND_BASE) + "/api/hardware/heartbeat", body, resp);
  if (code >= 200 && code < 300) {
    if (resp.indexOf("\"alertLevel\":\"RED\"") >= 0) {
      dashboardAlertLevel = "RED";
    } else if (resp.indexOf("\"alertLevel\":\"AMBER\"") >= 0) {
      dashboardAlertLevel = "AMBER";
    } else if (resp.indexOf("\"alertLevel\":\"GREEN\"") >= 0) {
      dashboardAlertLevel = "GREEN";
    }
    Serial.printf("[WIFI] Heartbeat OK (%d) | Alert=%s\n", code, dashboardAlertLevel.c_str());
  } else {
    Serial.printf("[WIFI] Heartbeat error: HTTP %d\n", code);
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== CPR ESP32 #1 TRANSMITTER BOOTING ===");

  pinMode(HLK_OUT, INPUT);
  pinMode(LDR_PIN, INPUT);
  Wire.begin(21, 22);

  // 1. OLED
  oledReady = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);
  if (oledReady) {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println("CPR TRANSMITTER");
    display.println("Connecting Wi-Fi...");
    display.display();
  }
  Serial.println(oledReady ? "[OK] OLED 0x3C" : "[WARN] OLED not found");

  // 2. VL53L0X ToF
  tofReady = tof.begin();
  Serial.println(tofReady ? "[OK] VL53L0X ToF" : "[WARN] VL53L0X not found");

  // 3. LoRa SX1278 (433 MHz)
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);
  loraReady = LoRa.begin(433E6);
  if (loraReady) {
    LoRa.setTxPower(17);
    LoRa.setSpreadingFactor(7);
    LoRa.setSignalBandwidth(125E3);
    LoRa.setCodingRate4(5);
    Serial.println("[OK] LoRa SX1278 433MHz");
  } else {
    Serial.println("[WARN] LoRa not detected (Wi-Fi telemetry will still run)");
  }

  // 4. Wi-Fi Connection
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[WIFI] Connecting");
  unsigned long startWait = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startWait < 12000) {
    delay(400);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[WIFI] Connected! IP: ");
    Serial.println(WiFi.localIP());
    registerDevice();
  } else {
    Serial.println("[WARN] Wi-Fi not connected yet (will retry automatically)");
  }

  Serial.println("CPR HARDWARE READY");
}

void loop() {
  if (millis() - lastLoopMs < 1000) return;
  lastLoopMs = millis();

  // Read Sensors
  int presence = digitalRead(HLK_OUT);
  int ldrRaw   = analogRead(LDR_PIN);
  int distance = -1;

  if (tofReady) {
    VL53L0X_RangingMeasurementData_t measurement;
    tof.rangingTest(&measurement, false);
    if (measurement.RangeStatus != 4) {
      distance = measurement.RangeMilliMeter;
    }
  }

  sequenceNumber++;

  // Serial Debug
  Serial.println("----------------------");
  Serial.printf("Seq: %lu | HLK: %s | ToF: %d mm | LDR: %d | WiFi: %s\n",
                sequenceNumber,
                presence ? "PRESENT" : "CLEAR",
                distance,
                ldrRaw,
                WiFi.status() == WL_CONNECTED ? "OK" : "OFF");

  // Update OLED
  if (oledReady) {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.printf("CPR TX | %s\n", WiFi.status() == WL_CONNECTED ? "WIFI OK" : "NO WIFI");
    display.println("---------------------");
    display.setTextSize(2);
    display.printf("RADAR:%s\n", presence ? "1+" : "0");
    display.setTextSize(1);
    display.printf("ToF : %s\n", distance >= 0 ? (String(distance) + " mm").c_str() : "N/A");
    display.printf("LDR : %d | LoRa:%s\n", ldrRaw, loraReady ? "OK" : "NO");
    display.printf("GATE: %s\n", dashboardAlertLevel.c_str());
    display.display();
  }

  // Send LoRa Packet for ESP32 #2 Receiver (every 1s)
  if (loraReady) {
    String packet =
      "CPR," +
      String(sequenceNumber) + "," +
      String(ldrRaw) + "," +
      String(distance) + "," +
      String(presence) + "," +
      dashboardAlertLevel;

    LoRa.beginPacket();
    LoRa.print(packet);
    int res = LoRa.endPacket();
    Serial.printf("[LORA] %s -> %s\n", packet.c_str(), res == 1 ? "TX OK" : "TX FAIL");
  }

  // Send Wi-Fi Heartbeat to CPR Backend (every 3s)
  if (millis() - lastBackendMs >= 3000) {
    lastBackendMs = millis();
    if (WiFi.status() != WL_CONNECTED) {
      WiFi.reconnect();
    } else {
      sendHeartbeat(presence, distance, ldrRaw);
    }
  }
}
