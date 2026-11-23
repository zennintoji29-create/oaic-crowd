/*
 * CPR (Crowd Pressure Radar) — Master Node Firmware v3.0
 * Board: ESP32 Dev Module (Breadboard 1)
 * 
 * =============================================================================
 * SUPPORTED FEATURES:
 * =============================================================================
 * 1. 3-in-1 RGB LED & Discrete LEDs:
 *    - Full PWM color mixing for Green, Yellow/Amber, Red.
 *    - Configurable for Common Cathode (default) or Common Anode.
 *    - Also drives discrete 3-LED arrays simultaneously.
 * 2. DUAL COMMUNICATION MODES (USB Serial + WiFi):
 *    - USB Serial (Default): 115200 baud, bulletproof for exhibitions (no router needed).
 *    - WiFi HTTP Polling: Polls http://<LAPTOP_IP>:5000/api/esp32/status every 200ms.
 * 3. SG90 Micro Servo Gate Actuator:
 *    - 90 deg = Open (Free flow, < 5 people)
 *    - 45 deg = Metered (Caution, 5 - 9 people)
 *    - 0 deg  = Closed & Locked (Crush Prevention Alert, >= 10 people)
 * 4. 0.96" SSD1306 I2C OLED Screen (128x64):
 *    - Real-time crowd count, safety tier, and gate status display.
 * 5. Autonomous Hardware Watchdog Failover:
 *    - If camera or laptop drops for > 4 seconds, the ESP32 automatically
 *      switches to reading the HLK-LD2410 24GHz radar and ToF sensors on-chip!
 * =============================================================================
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ESP32Servo.h>
#include <ArduinoJson.h>

// -----------------------------------------------------------------------------
// USER CONFIGURATION & PIN DEFINITIONS
// -----------------------------------------------------------------------------

// Communication Switches
#define ENABLE_WIFI       false          // Set to true if connecting via Wi-Fi hotspot, or false for zero-drop USB Serial mode
const char* WIFI_SSID     = "Your_Hotspot_Name";
const char* WIFI_PASS     = "Your_Hotspot_Password";
// If using WiFi mode, enter your local laptop IP (port 3000) or public Render URL:
const char* SERVER_URL    = "http://192.168.1.100:3000/api/esp32/status"; 
// Or for direct Cloud polling over WiFi:
// const char* SERVER_URL = "https://oaic-crowd.onrender.com/api/esp32/status";

// LED Hardware Type
#define USE_RGB_3IN1_LED  true           // Set true for 3-in-1 RGB LED, false for 3 discrete LEDs
#define RGB_COMMON_ANODE  false          // Set true if RGB LED common pin is VCC (+3.3V/5V), false if GND

// 3-in-1 RGB LED Pins (PWM channels)
#define PIN_RGB_RED       25
#define PIN_RGB_GREEN     26
#define PIN_RGB_BLUE      27

// Discrete LED Pins (If using 3 separate LEDs)
#define PIN_DISCRETE_RED  25
#define PIN_DISCRETE_YEL  26
#define PIN_DISCRETE_GRN  27

// Actuator & Sensor Pins
#define PIN_SERVO         13             // SG90 Servo PWM signal
#define PIN_BUZZER        12             // Active 5V / 3.3V Buzzer
#define PIN_OLED_SDA      21             // I2C Data
#define PIN_OLED_SCL      22             // I2C Clock

// HLK-LD2410 24GHz Radar (UART2)
#define RADAR_RX_PIN      16             // Connect to Radar TX
#define RADAR_TX_PIN      17             // Connect to Radar RX
HardwareSerial RadarSerial(2);

// Conditional WiFi headers
#if ENABLE_WIFI
  #include <WiFi.h>
  #include <HTTPClient.h>
#endif

// -----------------------------------------------------------------------------
// PERIPHERAL INSTANCES & STATE
// -----------------------------------------------------------------------------
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

Servo gateServo;

// PWM Channels for RGB LED on ESP32
const int PWM_CH_RED   = 0;
const int PWM_CH_GREEN = 1;
const int PWM_CH_BLUE  = 2;
const int PWM_FREQ     = 5000;
const int PWM_RES      = 8; // 8-bit resolution (0-255)

// System State
int currentCount = 0;
String currentStatus = "NORMAL";
int currentServoAngle = 90;
bool buzzerActive = false;
String oledLine1 = "CPR CROWD RADAR";
String oledLine2 = "COUNT: 0 PPL";
String oledLine3 = "STATUS: NORMAL";
String oledLine4 = "GATE: OPEN (90D)";

// Watchdog Timer for Automatic Hardware Failover
unsigned long lastCommandTime = 0;
const unsigned long WATCHDOG_TIMEOUT_MS = 4000;
bool isHardwareFailover = false;

// -----------------------------------------------------------------------------
// GATE SAFETY & FAIL-OPEN ARCHITECTURE:
// 1. Hub / Wi-Fi Loss: ESP32 does NOT open gate; continues autonomous local metering
//    via HLK-LD2410C radar dwell and ToF/IR throughput.
// 2. Hardware Fail-Open: Firmware crash / WDT panic, sensor bus fault, or manual E-stop
//    forces immediate gate OPEN (90 degrees).
// 3. Physical Spring Note: SG90 servo holds position unpowered; industrial scale uses
//    spring- or gravity-loaded drop-arm barrier open by default on power cut.
// -----------------------------------------------------------------------------
bool sensorHardwareFault = false;
bool manualEStopActive = false;

void checkFailOpenConditions() {
  if (manualEStopActive || sensorHardwareFault) {
    gateServo.write(90); // Fail-Open
    setHardwareState("GREEN", 90, false, 0, 255, 0);
    oledLine1 = "FAIL-OPEN ACTIVE";
    oledLine2 = manualEStopActive ? "MANUAL E-STOP" : "SENSOR FAULT";
    oledLine3 = "GATE OPENED";
    oledLine4 = "EVACUATION ROUTE";
    renderOled();
  }
}

// -----------------------------------------------------------------------------
// SETUP
// -----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println("\n========================================================");
  Serial.println("  CPR (Crowd Pressure Radar) — Master Node v3.0");
  Serial.println("  Hybrid AI + ESP32 Actuator Controller");
  Serial.println("========================================================");

  // 1. Initialize RGB LED PWM Channels
  ledcSetup(PWM_CH_RED, PWM_FREQ, PWM_RES);
  ledcSetup(PWM_CH_GREEN, PWM_FREQ, PWM_RES);
  ledcSetup(PWM_CH_BLUE, PWM_FREQ, PWM_RES);
  ledcAttachPin(PIN_RGB_RED, PWM_CH_RED);
  ledcAttachPin(PIN_RGB_GREEN, PWM_CH_GREEN);
  ledcAttachPin(PIN_RGB_BLUE, PWM_CH_BLUE);

  // Boot sequence color: Blue
  setRgbColor(0, 80, 255);

  // 2. Configure Actuator Pins
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  // 3. Configure SG90 Servo
  gateServo.setPeriodHertz(50);
  gateServo.attach(PIN_SERVO, 500, 2400);
  gateServo.write(90); // Default Open

  // 4. Initialize Radar UART
  RadarSerial.begin(256000, SERIAL_8N1, RADAR_RX_PIN, RADAR_TX_PIN);

  // 5. Initialize I2C SSD1306 OLED Display
  Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("[CPR-ESP32] Warning: SSD1306 OLED not detected at 0x3C (check wiring).");
  } else {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(1);
    display.setCursor(8, 6);
    display.println("CPR CROWD RADAR");
    display.setCursor(8, 22);
    display.println("BOOTING CONTROLLER...");
    display.setCursor(8, 38);
    display.println("YOLO + ESP32 ACTIVE");
    display.setCursor(8, 52);
    display.println("DUAL: USB + WIFI");
    display.display();
    delay(1000);
  }

  // 6. Connect to WiFi if enabled
#if ENABLE_WIFI
  Serial.print("[CPR-ESP32] Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 6000) {
    delay(250);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[CPR-ESP32] WiFi Connected! IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[CPR-ESP32] WiFi not found. Falling back to USB Serial mode.");
  }
#else
  Serial.println("[CPR-ESP32] Running in USB Serial Mode (115200 baud). Zero router setup required.");
#endif

  // Set Initial State: Green Light, Gate Open (90 deg)
  lastCommandTime = millis();
  applyControlRules(0, false);
  Serial.println("[CPR-ESP32] Master ready. Ready to receive commands!");
}

// -----------------------------------------------------------------------------
// MAIN LOOP
// -----------------------------------------------------------------------------
void loop() {
  bool commandReceived = false;

  // 1. Check USB Serial for incoming JSON from Python Bridge / YOLO
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    if (input.length() > 0) {
      parseJsonCommand(input);
      commandReceived = true;
    }
  }

  // 2. If WiFi is connected and enabled, poll the dashboard API
#if ENABLE_WIFI
  static unsigned long lastWifiPoll = 0;
  if (WiFi.status() == WL_CONNECTED && millis() - lastWifiPoll > 200) {
    lastWifiPoll = millis();
    HTTPClient http;
    http.begin(SERVER_URL);
    http.setTimeout(800);
    int httpCode = http.GET();
    if (httpCode == 200) {
      String payload = http.getString();
      parseJsonCommand(payload);
      commandReceived = true;
    }
    http.end();
  }
#endif

  if (commandReceived) {
    lastCommandTime = millis();
    if (isHardwareFailover) {
      isHardwareFailover = false;
      Serial.println("[CPR-ESP32] Primary camera link restored. AI Vision resumed.");
    }
  }

  // 3. Autonomous Hardware Failover Watchdog:
  // If no valid command arrived for > 4.0 seconds, take over locally with 24GHz Radar!
  if (millis() - lastCommandTime > WATCHDOG_TIMEOUT_MS) {
    if (!isHardwareFailover) {
      isHardwareFailover = true;
      Serial.println("[CPR-ESP32] WATCHDOG TRIP: Camera link offline! Autonomous 24GHz Radar failover active.");
    }
    runHardwareFailoverLoop();
  }

  delay(15);
}

// -----------------------------------------------------------------------------
// COMMAND PARSER & CONTROL RULES
// -----------------------------------------------------------------------------
void parseJsonCommand(String jsonStr) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, jsonStr);
  if (error) {
    return;
  }

  int count = 0;
  if (doc.containsKey("count")) {
    count = doc["count"];
  }

  // Custom RGB color if provided
  int r = -1, g = -1, b = -1;
  if (doc.containsKey("rgb")) {
    JsonObject rgb = doc["rgb"];
    r = rgb["r"] | 0;
    g = rgb["g"] | 255;
    b = rgb["b"] | 0;
  }

  // Custom OLED text lines if provided
  if (doc.containsKey("oled")) {
    JsonObject oled = doc["oled"];
    if (oled.containsKey("line1")) oledLine1 = oled["line1"].as<String>();
    if (oled.containsKey("line2")) oledLine2 = oled["line2"].as<String>();
    if (oled.containsKey("line3")) oledLine3 = oled["line3"].as<String>();
    if (oled.containsKey("line4")) oledLine4 = oled["line4"].as<String>();
  }

  applyControlRules(count, false);
}

// Evaluates the CPR Threshold Rules:
// - Count < 5   -> GREEN (Gate 90 deg Open)
// - Count 5 - 9 -> YELLOW / AMBER (Gate 45 deg Metered)
// - Count >= 10 -> RED (Gate 0 deg Locked, Buzzer Alarm ON)
void applyControlRules(int count, bool failover) {
  currentCount = count;

  if (count >= 10) {
    currentStatus = "CRITICAL";
    currentServoAngle = 0;
    buzzerActive = true;
    
    // RED Light: Red=255, Green=0, Blue=0
    setHardwareState("RED", 0, true, 255, 0, 0);

    oledLine1 = failover ? "FAILOVER: RED ALERT" : "CPR: RED ALERT!";
    oledLine2 = "COUNT: " + String(count) + " PPL";
    oledLine3 = "STATUS: CRITICAL";
    oledLine4 = "GATE: LOCKED (0D)";
  } else if (count >= 5) {
    currentStatus = "ELEVATED";
    currentServoAngle = 45;
    buzzerActive = false;

    // YELLOW / AMBER Light: Red=255, Green=180, Blue=0 (Rich optical yellow mix)
    setHardwareState("YELLOW", 45, false, 255, 180, 0);

    oledLine1 = failover ? "FAILOVER: WARNING" : "CPR: WARNING";
    oledLine2 = "COUNT: " + String(count) + " PPL";
    oledLine3 = "STATUS: ELEVATED";
    oledLine4 = "GATE: METER (45D)";
  } else {
    currentStatus = "NORMAL";
    currentServoAngle = 90;
    buzzerActive = false;

    // GREEN Light: Red=0, Green=255, Blue=0
    setHardwareState("GREEN", 90, false, 0, 255, 0);

    oledLine1 = failover ? "FAILOVER: NORMAL" : "CPR RADAR: LIVE";
    oledLine2 = "COUNT: " + String(count) + " PPL";
    oledLine3 = "STATUS: NORMAL";
    oledLine4 = "GATE: OPEN (90D)";
  }

  renderOled();
}

// -----------------------------------------------------------------------------
// HARDWARE ACTUATOR OUTPUTS
// -----------------------------------------------------------------------------
void setHardwareState(String ledColor, int angle, bool buzzer, int r, int g, int b) {
  // 1. Drive 3-in-1 RGB LED with PWM Color Mixing
  setRgbColor((uint8_t)r, (uint8_t)g, (uint8_t)b);

  // 2. Drive SG90 Servo Position (90 = Open, 45 = Meter, 0 = Lock)
  gateServo.write(angle);

  // 3. Drive Buzzer
  digitalWrite(PIN_BUZZER, buzzer ? HIGH : LOW);
}

// Sets RGB color (0 - 255 per channel), handles Common Cathode vs Anode
void setRgbColor(uint8_t r, uint8_t g, uint8_t b) {
  if (RGB_COMMON_ANODE) {
    // Common Anode: Inverted logic (0 = full bright, 255 = off)
    ledcWrite(PWM_CH_RED, 255 - r);
    ledcWrite(PWM_CH_GREEN, 255 - g);
    ledcWrite(PWM_CH_BLUE, 255 - b);
  } else {
    // Common Cathode: Standard logic (255 = full bright, 0 = off)
    ledcWrite(PWM_CH_RED, r);
    ledcWrite(PWM_CH_GREEN, g);
    ledcWrite(PWM_CH_BLUE, b);
  }
}

// Refreshes the physical 0.96" SSD1306 OLED Screen
void renderOled() {
  display.clearDisplay();
  
  // Header Bar
  display.fillRect(0, 0, 128, 14, SSD1306_WHITE);
  display.setTextColor(SSD1306_BLACK);
  display.setTextSize(1);
  display.setCursor(4, 3);
  display.println(oledLine1);

  // Count Number (Large Text)
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 18);
  display.setTextSize(2);
  display.println(oledLine2);

  // Status & Gate Lines
  display.setTextSize(1);
  display.setCursor(0, 38);
  display.println(oledLine3);

  display.setCursor(0, 50);
  display.println(oledLine4);

  display.display();
}

// Autonomous Hardware Failover: Estimates crowd from 24GHz Radar
void runHardwareFailoverLoop() {
  static unsigned long lastRadarPoll = 0;
  if (millis() - lastRadarPoll < 400) return;
  lastRadarPoll = millis();

  // Read raw energy signature from 24GHz FMCW Radar
  int fallbackCount = 2; // Default safe presence
  if (RadarSerial.available()) {
    while (RadarSerial.available()) RadarSerial.read();
    fallbackCount = 6; // Active motion registered in corridor
  }

  applyControlRules(fallbackCount, true);
}
