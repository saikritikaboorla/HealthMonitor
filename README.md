# SmartCare — Affordable Smart Health Monitoring and Emergency Alert System

> **Prototype notice:** CareBeat is a monitoring and caregiver-coordination prototype.
> It does not diagnose disease, recommend treatment, or replace professional medical assessment.
> All demonstration data is dynamically simulated or replayed from a public dataset.
> All alerts are prototype alerts only.

Track 3 — Affordable Health Tech

---

## Table of Contents

1. [What it does](#1-what-it-does)
2. [Quick start](#2-quick-start)
3. [Architecture](#3-architecture)
4. [Technology stack](#4-technology-stack)
5. [Configuration](#5-configuration)
6. [3-minute demo script](#6-3-minute-demo-script)
7. [Running the evaluation test](#7-running-the-evaluation-test)
8. [Cost](#8-cost)
9. [Honest limits](#9-honest-limits)
10. [Future scope](#10-future-scope)
11. [Dataset credits](#11-dataset-credits)

---

## 1. What it does

CareBeat connects five things in one workflow for elderly and high-needs patient monitoring:

- **Vital-sign monitoring** — heart rate (BPM), body temperature (°C), SpO₂ (%), and blood pressure (mmHg). Readings come from a dynamic simulator by default, or optionally from a replayed public dataset.
- **Configurable threshold alerts** — per-patient condition profiles (heart patient, diabetic, high BP, or custom). All limits are editable live. A value must stay outside the limit for N consecutive seconds before an alert fires, preventing false alarms.
- **Caregiver dashboard** — assigned patients, live readings, alert list with Acknowledge/Resolve, care-task checklists, shift handover notes, daily care logs.
- **Family connectivity** — mandatory family contact on every patient, direct alerts on Critical/SOS, read-only family view, masked phone numbers.
- **Emergency escalation** — SOS button, Telegram + simulated SMS on Critical alerts, automatic escalation to a second contact if unacknowledged within a configurable timeout.

---

## 2. Quick start

### Requirements

- Python 3.11 or later
- A modern browser (Chrome, Firefox, Edge, Safari)
- No hardware required

### Install

```bash
git clone <repo-url>
cd HealthMonitor
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Seed demo data

```bash
python seed.py
```

Creates 4 demo patients, 2 caregivers, 1 admin, family contacts, medicines, and assignments.

### Run

```bash
uvicorn main:app --reload
```

Open `http://localhost:8000` in your browser.

### Optional: Telegram notifications

Set in `config.json` (never commit this file with real tokens):

```json
{
  "TELEGRAM_BOT_TOKEN": "your-bot-token",
  "patients": {
    "p1": { "telegram_chat_id": "your-chat-id" }
  }
}
```

If not set, the system logs to the console and shows a "Telegram (simulated)" toast on the dashboard.

---

## 3. Architecture

```
[Dynamic Simulator]  [Dataset Replayer]  [Manual Form]  [SOS Button]  [I'm OK Check-in]
         \                  |                  |               |               /
          +-------------- POST /measurements (patient_id, heart_rate, temperature, spo2, timestamp, source) ---+
                                               |
                               FastAPI Backend (REST + WebSocket)
                                               |
      +----------------+----------------+------+--------+-------------+------------------+
      |                |                |               |             |                  |
 Alert &          Threshold        Trend &          Medicine     Caregiver          SQLite
 Rules Engine     Profiles         False-alarm       Scheduler    Module             Database
      |                |            Filter            |             |                  |
      +----------------+----------------+------+--------+-------------+------------------+
                                               |
                         React-free Single-Page Dashboard (WebSocket + REST)
                                               |
           +------------------+---------------+----------------+------------------+
           |                  |               |                |                  |
    Caregiver View      Family View     Patient Screen    Admin View        Metrics/Eval Page
```

### Key design decision: device-independent ingestion

Every data source — simulator, dataset replayer, manual form, and a future hardware device — posts to the same endpoint:

```
POST /measurements
{
  "patient_id": "p1",
  "heart_rate": 84,
  "temperature": 36.7,
  "spo2": 97,
  "timestamp": "2026-10-12T12:35:00",
  "source": "simulator"
}
```

The backend does not care where the reading came from. An ESP32 device posting to this endpoint with `"source": "device"` would flow through the same alert engine, threshold checks, and notifications without any backend changes.

---

## 4. Technology stack

| Layer | Technology | Reason |
|---|---|---|
| Backend | Python 3.11 + FastAPI | REST + WebSocket, async, zero-cost |
| Database | SQLite | No server needed, full audit trail |
| Frontend | Plain HTML/CSS/JS | No build step, runs in any browser |
| Charts | Chart.js via CDN | Live trend charts |
| Live updates | FastAPI WebSocket | Real-time readings and alert state |
| Simulation | Python (built-in random, math, csv) | Dynamic simulator + dataset replay |
| Background tasks | FastAPI BackgroundTasks + APScheduler | Escalation timers, medicine reminders |
| Notifications | Telegram Bot API | Real if token set, simulated otherwise |
| Voice alerts | Browser SpeechSynthesis API | In-browser Critical/SOS alert voice |
| Config | config.json + env vars | No secrets in code |

---

## 5. Configuration

All configurable values live in `config.json`. The file is gitignored. Copy `config.example.json` to get started.

Key values:

| Key | Default | Description |
|---|---|---|
| `false_alarm_seconds` | `5` | Readings must stay outside a limit for this many seconds before an alert fires |
| `offline_alert_seconds` | `120` | No reading for this long triggers a "Device offline" alert |
| `escalation_timeout_seconds` | `120` | Unacknowledged alert escalates to second family contact after this |
| `missed_checkin_seconds` | `3600` | "I'm OK" missed check-in alert fires after this |
| `simulator_interval_seconds` | `1` | How often the simulator generates a reading per patient |
| `column_mapping` | see docs | Maps CSV column names to the internal schema for dataset replay |

---

## 6. 3-minute demo script

This script demonstrates the full monitoring → alert → respond → escalate loop. Run it with a judge or reviewer watching the dashboard.

**Before you start:** run `seed.py`, start the server, open the dashboard, log in as "Priya" (caregiver role).

---

**0:00 — Normal readings (30 seconds)**

Point to the four patient cards. All green. Source chip says "Simulated". Readings update every second.

> "The dynamic simulator generates realistic readings every second. No CSV or hardware needed."

---

**0:30 — Trigger a threshold breach**

In a second terminal or via the dashboard's Simulator page:

```bash
curl -X POST http://localhost:8000/trigger/tachycardia
```

Watch Demo Patient A's heart rate climb above 110 BPM. After 5 seconds (the false-alarm filter), an Alert fires.

> "The false-alarm filter prevents a single noisy reading from firing an alert. The reading has to stay outside the limit for 5 consecutive seconds."

Point to the alert explanation: "Heart rate is 126 BPM, above the configured limit of 110 BPM for this patient's heart patient profile."

> "Every alert explains itself in one sentence."

---

**1:00 — Acknowledge and note**

Click Acknowledge on the alert. Siren stops. Type a quick note. Show the state timeline: Active → Acknowledged.

> "Acknowledged means a caregiver has seen it. It's not resolved yet."

---

**1:20 — SOS**

Switch to the Patient screen (log out, log in as "Demo Patient A"). Press and hold the SOS button.

> "The patient presses SOS. This bypasses all threshold checks."

Switch back to the caregiver view. Show the SOS banner, the Telegram simulated toast, and the escalation countdown.

---

**1:50 — Escalation**

Let the acknowledgment timeout expire (or fast-forward in settings). Show "Escalating to second family contact."

> "If no one responds within 2 minutes, the system notifies the backup contact and labels the alert Escalated."

---

**2:10 — Dataset replay (optional, if time)**

On the Simulator page, switch source to "Dataset Replay". Show the source chip change from "Simulated" to "Replay: Synthetic Patient Healthcare Monitoring Dataset". Show a Fall Detection row triggering an automatic Critical alert.

> "We can replay 60,000 records from a public dataset at 1 row per second. Fall Detection in the data auto-triggers the SOS pipeline."

---

**2:40 — Metrics page**

Open the Metrics/Eval page (Admin view). Show alert latency, suppressed alerts count, medicine adherence.

> "Judges can verify these numbers independently with eval_test.py."

---

**3:00 — Done**

---

## 7. Running the evaluation test

```bash
python eval_test.py
```

Runs the simulator for 5 minutes with a fixed seed and prints to the console:

- Average alert latency (reading timestamp → notification sent, in ms)
- Alerts raised (by severity)
- Alerts suppressed by the false-alarm filter
- Sensor errors quarantined
- Medicine taken vs missed (by patient)
- Notification delivery counts (attempted, succeeded, failed, by channel)

---

## 8. Cost

| Component | Cost |
|---|---|
| Python + FastAPI + SQLite | Free |
| HTML/CSS/JS frontend | Free |
| Telegram Bot API | Free |
| Dataset (Kaggle) | Free, open license |
| Hosting (demo on localhost) | Free |
| ESP32 + MAX30102 + DS18B20 (future) | ~₹800–1,200 in components |

**Total cost to run this prototype: ₹0.**

---

## 9. Honest limits

**Software-only prototype.** No hardware is connected. Readings come from a dynamic math-based simulator (default) or from a replayed public dataset. The system has not been tested with real sensors or a real patient.

**ESP32 integration is designed but not implemented.** The backend exposes a plain `POST /measurements` endpoint that the dataset replayer already uses. An ESP32 with a MAX30102 (SpO₂/HR) and DS18B20 (temperature) sensor would post the same JSON to the same endpoint over Wi-Fi. A reference sketch showing this design is in `firmware/esp32_example.ino`. It is clearly labeled an untested reference sketch — sensor reads are marked as placeholders and the sketch has not been run on hardware.

To avoid making a false claim: do not say "ESP32 integrated" or "hardware-ready" in the pitch. The accurate statement is:

> "Software-only prototype. Readings come from a replayed public dataset. The ESP32 + MAX30102 + DS18B20 node is designed to post the same JSON to the same endpoint and is planned as future work."

If a judge asks why no hardware: the dataset gave realistic readings without sensor noise or venue Wi-Fi risk, and the data pipeline is device-independent by design.

**Notifications are partially simulated.** Telegram works if a bot token is configured. SMS is always simulated (a "Family phone" panel in the UI). No real OTP, no real SMS gateway.

**Caregiver verification is a mock.** The admin marks a caregiver verified by clicking a button. There is no connection to any police, government, or background-check database.

**Fee negotiation is a status tracker only.** No payment processing.

**Thresholds are demonstration defaults, not medical limits.** All threshold values are editable and are labeled "editable defaults, not medical advice" throughout the UI.

**The Health Score is a configured-limit compliance indicator, not a clinical assessment.**

**The system does not diagnose disease, recommend treatment, guarantee notification delivery, or replace professional medical care.**

---

## 10. Future scope

These are listed as future work. No code for any of these exists in the prototype.

- **ESP32 + MAX30102 + DS18B20** posting to `POST /measurements` over Wi-Fi or MQTT. No backend changes needed — see `firmware/esp32_example.ino` for the design.
- **Hardware fall detection** — MPU6050 accelerometer on ESP32. The `fall_detected` field is already in the ingestion schema.
- **Telugu / Hindi language toggle** for alerts, tips, and key UI labels. SpeechSynthesis voices exist for both.
- **Gemini AI plain-language daily summary** (stubbed; needs API key and prompt tuning).
- **Mobile app** — React Native or Flutter consuming the same REST + WebSocket API.
- **OTP-based phone verification** via Twilio Verify.
- **Clinically validated threshold profiles** in partnership with a medical institution.
- **Anomaly detection model** trained on consented, properly labelled elderly vital-sign data.

---

## 11. Dataset credits

| Item | Detail |
|---|---|
| Name | Synthetic Patient Healthcare Monitoring Dataset |
| Source | Kaggle |
| Records | 60,000 rows, 13 columns |
| License | Verify on the dataset page before use in a submission |
| Used for | Optional dataset replay source. Not used for training any model. |
| Columns used | Heart Rate (bpm), SpO2 Level (%), Body Temperature (°C), Fall Detection, Data Accuracy (%), Predicted Disease (condition-tag assignment only, never shown on UI) |
| Not used | Predicted Disease is never exposed on any user-facing screen |

The dynamic simulator is the default and primary data source. The app runs fully without the CSV file.
