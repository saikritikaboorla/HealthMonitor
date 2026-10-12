/*
 * CareBeat — ESP32 Reference Sketch
 * ===========================================================================
 * UNTESTED REFERENCE SKETCH. This file has NOT been compiled or run on
 * hardware. It exists to show the integration design is concrete: an ESP32
 * posts the same JSON to the same POST /measurements endpoint that the
 * software simulator already uses. No backend changes are needed.
 *
 * What is real in this sketch:
 *   - Wi-Fi connection and reconnect logic
 *   - HTTP POST to POST /measurements with the correct JSON schema
 *   - Timing loop (one reading per second)
 *   - Struct layout matching the backend API contract
 *
 * What is a placeholder (marked PLACEHOLDER below):
 *   - MAX30102 sensor initialisation and read (SpO2, heart rate)
 *   - DS18B20 sensor initialisation and read (temperature)
 *   - Any error/quality handling that depends on real sensor libraries
 *
 * Hardware this sketch targets (not tested, component list only):
 *   - ESP32 DevKit v1 (or any ESP32 board with Wi-Fi)
 *   - MAX30102 pulse oximeter / heart-rate sensor (I2C, SDA=21, SCL=22)
 *   - DS18B20 waterproof temperature sensor (OneWire, DATA=4, 4.7 kΩ pull-up)
 *
 * Estimated component cost: ₹800–1,200 (ESP32 ~₹350, MAX30102 ~₹250,
 *   DS18B20 ~₹150, breadboard + wires + resistor ~₹100).
 *
 * Libraries needed (install via Arduino Library Manager):
 *   - WiFi.h          (bundled with ESP32 Arduino core)
 *   - HTTPClient.h    (bundled with ESP32 Arduino core)
 *   - ArduinoJson     (Benoit Blanchon, v6+)
 *   - PLACEHOLDER: SparkFun MAX3010x Sensor Library  (for MAX30102)
 *   - PLACEHOLDER: DallasTemperature + OneWire       (for DS18B20)
 *
 * To actually use this sketch:
 *   1. Install the libraries above.
 *   2. Fill in WIFI_SSID, WIFI_PASSWORD, SERVER_URL, and PATIENT_ID below.
 *   3. Wire up the sensors and replace every PLACEHOLDER section with
 *      real sensor initialisation and read calls.
 *   4. Flash to the ESP32 and verify readings in the CareBeat dashboard.
 * ===========================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

/* --------------------------------------------------------------------------
 * Configuration — edit these before flashing
 * -------------------------------------------------------------------------- */
const char* WIFI_SSID      = "YOUR_WIFI_SSID";       // <- edit
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";    // <- edit
const char* SERVER_URL     = "http://192.168.1.100:8000/measurements"; // <- edit: IP of the laptop running CareBeat
const char* PATIENT_ID     = "p1";                    // <- edit: must match a patient_id in the CareBeat database
const int   READING_INTERVAL_MS = 1000;               // one reading per second

/* --------------------------------------------------------------------------
 * PLACEHOLDER: MAX30102 (SpO2 + heart rate) sensor setup
 *
 * Replace this block with real initialisation once the library is installed:
 *
 *   #include <SparkFun_MAX3010x_Sensor_Algorithm.h>
 *   #include <SparkFun_MAX3010x_Sensor_Library.h>
 *   MAX30105 particleSensor;
 *   int32_t spo2;
 *   int8_t  validSPO2;
 *   int32_t heartRate;
 *   int8_t  validHeartRate;
 * -------------------------------------------------------------------------- */
// (no real MAX30102 includes here — this sketch does not compile as-is)

/* --------------------------------------------------------------------------
 * PLACEHOLDER: DS18B20 (temperature) sensor setup
 *
 * Replace this block with real initialisation once the libraries are installed:
 *
 *   #include <OneWire.h>
 *   #include <DallasTemperature.h>
 *   #define ONE_WIRE_BUS 4
 *   OneWire oneWire(ONE_WIRE_BUS);
 *   DallasTemperature tempSensor(&oneWire);
 * -------------------------------------------------------------------------- */
// (no real DS18B20 includes here — this sketch does not compile as-is)


/* --------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

// Returns a timestamp string "YYYY-MM-DDTHH:MM:SS" using millis() as a
// stand-in. On real hardware replace this with an NTP-synchronised clock
// or an RTC module so timestamps align with the server.
String isoTimestamp() {
  // PLACEHOLDER: replace with NTP or RTC time
  // Example with NTP (configTime must be called in setup()):
  //   time_t now;
  //   struct tm timeinfo;
  //   if (!getLocalTime(&timeinfo)) return "1970-01-01T00:00:00";
  //   char buf[20];
  //   strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S", &timeinfo);
  //   return String(buf);
  unsigned long s = millis() / 1000;
  char buf[20];
  snprintf(buf, sizeof(buf), "1970-01-01T%02lu:%02lu:%02lu",
           (s / 3600) % 24, (s / 60) % 60, s % 60);
  return String(buf);
}

// Connect to Wi-Fi. Blocks until connected or retries indefinitely.
void connectWiFi() {
  Serial.print("Connecting to Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempts++;
    if (attempts > 40) {
      Serial.println("\nWi-Fi timeout. Restarting...");
      ESP.restart();
    }
  }
  Serial.println();
  Serial.print("Connected. IP: ");
  Serial.println(WiFi.localIP());
}

// Post one reading to POST /measurements.
// Returns true on HTTP 200/201, false otherwise.
bool postReading(float heartRate, float temperature, float spo2) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi disconnected. Reconnecting...");
    connectWiFi();
  }

  // Build the JSON payload matching the CareBeat API schema
  StaticJsonDocument<256> doc;
  doc["patient_id"]  = PATIENT_ID;
  doc["heart_rate"]  = (int)round(heartRate);    // BPM, integer
  doc["temperature"] = round(temperature * 10.0) / 10.0; // °C, 1 decimal
  doc["spo2"]        = (int)round(spo2);         // %, integer
  doc["timestamp"]   = isoTimestamp();
  doc["source"]      = "device";

  String payload;
  serializeJson(doc, payload);

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  int statusCode = http.POST(payload);

  if (statusCode == 200 || statusCode == 201) {
    Serial.printf("POST OK (%d): HR=%d bpm  Temp=%.1f°C  SpO2=%d%%\n",
                  statusCode, (int)round(heartRate), temperature, (int)round(spo2));
    http.end();
    return true;
  } else {
    Serial.printf("POST failed (%d): %s\n", statusCode, http.getString().c_str());
    http.end();
    return false;
  }
}


/* --------------------------------------------------------------------------
 * setup()
 * -------------------------------------------------------------------------- */
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("CareBeat ESP32 node starting...");

  connectWiFi();

  /* PLACEHOLDER: initialise MAX30102
   *
   * if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
   *   Serial.println("MAX30102 not found. Check wiring.");
   *   while (true) delay(1000);
   * }
   * particleSensor.setup();
   * particleSensor.setPulseAmplitudeRed(0x0A);
   * particleSensor.setPulseAmplitudeGreen(0);
   * Serial.println("MAX30102 ready.");
   */

  /* PLACEHOLDER: initialise DS18B20
   *
   * tempSensor.begin();
   * Serial.printf("DS18B20 found: %d device(s).\n", tempSensor.getDeviceCount());
   */

  Serial.println("Setup complete. Posting readings every second.");
}


/* --------------------------------------------------------------------------
 * loop()
 * -------------------------------------------------------------------------- */
void loop() {
  unsigned long loopStart = millis();

  /* ------------------------------------------------------------------
   * PLACEHOLDER: read heart rate and SpO2 from MAX30102
   *
   * This is where you call the MAX30102 algorithm library.
   * The real call looks like:
   *
   *   // Collect ~100 samples first (bufferLength = 100)
   *   maxim_heart_rate_and_oxygen_saturation(
   *     irBuffer, bufferLength, redBuffer,
   *     &spo2, &validSPO2, &heartRate, &validHeartRate);
   *
   *   float heartRateValue  = validHeartRate ? (float)heartRate : -1.0f;
   *   float spo2Value       = validSPO2      ? (float)spo2      : -1.0f;
   *
   * For now, use fixed placeholder values so the rest of the loop runs:
   * ------------------------------------------------------------------ */
  float heartRateValue = 75.0f;   // PLACEHOLDER: replace with sensor read
  float spo2Value      = 98.0f;   // PLACEHOLDER: replace with sensor read
  bool  hrValid        = false;   // PLACEHOLDER: set true when real sensor confirms valid reading
  bool  spo2Valid      = false;   // PLACEHOLDER: set true when real sensor confirms valid reading

  /* ------------------------------------------------------------------
   * PLACEHOLDER: read temperature from DS18B20
   *
   * Real calls:
   *   tempSensor.requestTemperatures();
   *   float temperatureValue = tempSensor.getTempCByIndex(0);
   *   bool  tempValid = (temperatureValue != DEVICE_DISCONNECTED_C);
   * ------------------------------------------------------------------ */
  float temperatureValue = 36.6f; // PLACEHOLDER: replace with sensor read
  bool  tempValid        = false; // PLACEHOLDER: set true when real sensor confirms valid reading

  /* ------------------------------------------------------------------
   * Post only if at least one real sensor value is available.
   * While all three are placeholders (hrValid/spo2Valid/tempValid all
   * false), the sketch still posts to let you verify Wi-Fi and HTTP
   * plumbing before soldering sensors. Remove this override once real
   * sensor reads are in place.
   * ------------------------------------------------------------------ */
  bool anyValid = hrValid || spo2Valid || tempValid;
  if (!anyValid) {
    Serial.println("WARNING: all readings are placeholders. "
                   "Replace PLACEHOLDER sections with real sensor reads.");
    // Post anyway for integration testing — remove this block once sensors are wired.
    postReading(heartRateValue, temperatureValue, spo2Value);
  } else {
    postReading(heartRateValue, temperatureValue, spo2Value);
  }

  // Maintain a consistent posting interval even if the HTTP call was slow
  unsigned long elapsed = millis() - loopStart;
  if (elapsed < (unsigned long)READING_INTERVAL_MS) {
    delay(READING_INTERVAL_MS - elapsed);
  }
}
