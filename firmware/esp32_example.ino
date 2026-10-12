/**
 * SmartCare CareBeat — ESP32 Reference Sketch
 * ============================================
 * Hardware-ready placeholder for future ESP32 wearable node integration.
 *
 * Target hardware:
 *   - ESP32 DevKit (Wi-Fi enabled)
 *   - MAX30102 Pulse Oximeter / Heart Rate Sensor (I2C)
 *   - DS18B20 Digital Body Temperature Sensor (1-Wire)
 *   - MPU-6050 6-Axis Accelerometer/Gyro for fall detection (I2C) [optional]
 *
 * This sketch reads vitals and POSTs them to the CareBeat backend at
 * POST /measurements — the same device-independent ingestion endpoint
 * used by the simulator and dataset replayer. No backend code changes needed.
 *
 * NOTE: This is a PLACEHOLDER sketch. Sensor library integration and
 * calibration are required before deploying on real hardware.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --------------------------------------------------------------------------
// Configuration — update before flashing
// --------------------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "http://YOUR_SERVER_IP:8000/measurements";
const char* PATIENT_ID    = "p1";  // Must match a registered patient_id in CareBeat

// Reading interval (milliseconds)
const unsigned long INTERVAL_MS = 1000;

unsigned long lastSendTime = 0;

// --------------------------------------------------------------------------
// Setup
// --------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Serial.println("[CareBeat ESP32] Booting...");

  // Connect to Wi-Fi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[CareBeat ESP32] Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("[CareBeat ESP32] Connected. IP: ");
  Serial.println(WiFi.localIP());

  // TODO: Initialize MAX30102 sensor (Wire.begin(), sensor.begin())
  // TODO: Initialize DS18B20 sensor (OneWire, DallasTemperature)
  // TODO: Initialize MPU-6050 for fall detection (optional)
}

// --------------------------------------------------------------------------
// Main Loop
// --------------------------------------------------------------------------
void loop() {
  unsigned long now = millis();
  if (now - lastSendTime >= INTERVAL_MS) {
    lastSendTime = now;

    // TODO: Replace placeholder values with real sensor readings
    float heartRate  = readHeartRate();   // BPM from MAX30102
    float spo2       = readSpO2();        // % from MAX30102
    float temperature = readTemperature(); // °C from DS18B20
    int   fallDetected = detectFall();    // 0 or 1 from MPU-6050

    // Send reading to CareBeat backend
    sendMeasurement(heartRate, temperature, spo2, fallDetected);
  }
}

// --------------------------------------------------------------------------
// Sensor Reading Stubs — replace with real library calls
// --------------------------------------------------------------------------
float readHeartRate() {
  // TODO: return sensor.getHeartRate();
  return 75.0;
}

float readSpO2() {
  // TODO: return sensor.getSpO2();
  return 98.0;
}

float readTemperature() {
  // TODO: sensors.requestTemperatures(); return sensors.getTempCByIndex(0);
  return 36.6;
}

int detectFall() {
  // TODO: read MPU-6050 acceleration magnitude; return 1 if sudden impact threshold exceeded
  return 0;
}

// --------------------------------------------------------------------------
// POST /measurements to CareBeat Backend
// --------------------------------------------------------------------------
void sendMeasurement(float hr, float temp, float spo2, int fall) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[CareBeat ESP32] WiFi disconnected, skipping send.");
    return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  // Build JSON payload matching CareBeat MeasurementInput schema
  StaticJsonDocument<256> doc;
  doc["patient_id"]    = PATIENT_ID;
  doc["heart_rate"]    = hr;
  doc["temperature"]   = temp;
  doc["spo2"]          = spo2;
  doc["fall_detected"] = fall;
  doc["source"]        = "device";

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  if (httpCode == 200) {
    Serial.printf("[CareBeat ESP32] Reading sent OK (HR: %.0f, Temp: %.1f°C, SpO2: %.0f%%)\n", hr, temp, spo2);
  } else {
    Serial.printf("[CareBeat ESP32] POST failed, HTTP code: %d\n", httpCode);
  }

  http.end();
}
