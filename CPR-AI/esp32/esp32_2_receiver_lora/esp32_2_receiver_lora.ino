/*
 * =============================================================================
 * CPR (Crowd Pressure Radar) — ESP32 #2: RECEIVER (LoRa + Buzzer + LEDs)
 * =============================================================================
 * Pin Map (Conflict-Free — avoids LoRa VSPI GPIO 18, 19, 23):
 *   LoRa SX1278 : SCK=18, MISO=19, MOSI=23, NSS=13, RST=27, DIO0=26
 *   Buzzer      : GPIO 22
 *   RED LED     : GPIO 21
 *   GREEN LED   : GPIO 25
 *   YELLOW/BLUE : GPIO 14  (moved off GPIO 23 so it doesn't conflict with LoRa MOSI!)
 * =============================================================================
 */

#include <SPI.h>
#include <LoRa.h>

#define LORA_SCK    18
#define LORA_MISO   19
#define LORA_MOSI   23
#define LORA_SS     13
#define LORA_RST    27
#define LORA_DIO0   26

#define BUZZER_PIN  22
#define RED_PIN     21
#define GREEN_PIN   25
#define YELLOW_PIN  14

void setLights(bool r, bool y, bool g) {
  digitalWrite(RED_PIN, r ? HIGH : LOW);
  digitalWrite(YELLOW_PIN, y ? HIGH : LOW);
  digitalWrite(GREEN_PIN, g ? HIGH : LOW);
}

unsigned long lastPacketMs = 0;
bool receivedOnce = false;

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RED_PIN, OUTPUT);
  pinMode(YELLOW_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);

  digitalWrite(BUZZER_PIN, LOW);
  setLights(false, false, false);

  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_SS);
  LoRa.setPins(LORA_SS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(433E6)) {
    Serial.println("[ERROR] LoRa init failed!");
    while (true) {
      setLights(true, false, false);
      delay(300);
      setLights(false, false, false);
      delay(300);
    }
  }

  LoRa.setSpreadingFactor(7);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(5);

  Serial.println("CPR RECEIVER READY (Waiting for LoRa packets)");
  setLights(false, false, true);
}

void loop() {
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String packet = "";
    while (LoRa.available()) {
      packet += (char)LoRa.read();
    }

    unsigned long seq = 0;
    int ldr = 0, distance = -1, presence = 0;
    char alertBuf[16] = "GREEN";

    int parsed = sscanf(
      packet.c_str(),
      "CPR,%lu,%d,%d,%d,%15s",
      &seq, &ldr, &distance, &presence, alertBuf
    );

    if (parsed >= 4) {
      lastPacketMs = millis();
      receivedOnce = true;
      String alertLevel = String(alertBuf);

      Serial.printf("[RX] %s (RSSI: %d dBm)\n", packet.c_str(), LoRa.packetRssi());

      if (alertLevel == "RED" || (presence == 1 && distance >= 0 && distance < 400)) {
        setLights(true, false, false);
        digitalWrite(BUZZER_PIN, HIGH);
      } else if (alertLevel == "AMBER" || presence == 1) {
        setLights(false, true, false);
        digitalWrite(BUZZER_PIN, LOW);
      } else {
        setLights(false, false, true);
        digitalWrite(BUZZER_PIN, LOW);
      }
    }
  }

  if (receivedOnce && millis() - lastPacketMs > 5000) {
    setLights(false, true, false);
    digitalWrite(BUZZER_PIN, LOW);
    Serial.println("[WARN] LoRa link lost (>5s)");
    receivedOnce = false;
  }
}
