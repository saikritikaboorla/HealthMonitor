# SmartCare — Affordable Smart Health Monitoring & Emergency Alert System

> **Prototype & Non-Diagnostic Notice:**  
> SmartCare is an affordable patient-monitoring and caregiver-coordination prototype. It does **not** diagnose disease, recommend treatment, or replace professional medical assessment. All demonstration data is dynamically simulated or replayed from open healthcare datasets. All alerts are prototype alerts only.

**Track 3 — Affordable Health Tech** | **Hardware-Ready Software Prototype (₹0 to demo)**

---

## Table of Contents

1. [Problem Statement & Solution](#1-problem-statement--solution)
2. [Role-Based Login System](#2-role-based-login-system)
3. [Dashboards](#3-dashboards)
4. [AI Layer & Deterministic Fallback Engine](#4-ai-layer--deterministic-fallback-engine)
5. [Technology Stack](#5-technology-stack)
6. [Key System Features](#6-key-system-features)
7. [Architecture & Ingestion Pipeline](#7-architecture--ingestion-pipeline)
8. [Family Notifications & Daily Report](#8-family-notifications--daily-report)
9. [Quick Start Guide](#9-quick-start-guide)
10. [Configuration (config.json)](#10-configuration-configjson)
11. [Demo Credentials](#11-demo-credentials)
12. [3-Minute Live Demo Script](#12-3-minute-live-demo-script)
13. [Evaluation & Metrics (eval_test.py)](#13-evaluation--metrics-eval_testpy)
14. [Cost & Honest Limitations](#14-cost--honest-limitations)
15. [Additional Features (Future Roadmap)](#15-additional-features-future-roadmap)
16. [Dataset Credits](#16-dataset-credits)

---

## 1. Problem Statement & Solution

### Problem Statement
Elderly individuals and patients requiring regular vitals monitoring often lack timely attention when their vital signs fluctuate abnormally or when they need urgent assistance. Commercial remote-monitoring setups are expensive, technically complicated for seniors, and prone to alert fatigue, while family members living remotely lack real-time visibility.

### Solution
SmartCare is an affordable, software-first platform that connects continuous vital-sign monitoring, false-alarm reduction, role-locked multi-user dashboards, generative AI summaries with local offline fallbacks, multi-tier emergency escalation, and automated daily family health reports.

---

## 2. Role-Based Login System

Every user logs in with their own credentials and sees **only their own dashboard** — no role switching, no shared screens.

### Login Screen
- **Two top-level tabs:** Caregiver | Patient
- **Caregiver tab** — chips to select Priya Nair or Amit Kumar → enter password → lands directly on Caregiver Dashboard
- **Patient tab** — chips to select Patient A / B / C / D → enter password → lands directly on their own Patient Dashboard

### Access Control Rules
| Role | Can See |
|---|---|
| Caregiver (Priya / Amit) | Caregiver Dashboard · Judge Metrics · Simulator & Dataset |
| Patient A / B / C / D | Their own Patient Dashboard only |

- Nav tabs, role selector, "Test Emergency" button, and "Switch Patient" dropdown are all **hidden or restricted** based on login role.
- Caregivers only see **their assigned patients** in the dashboard grid (Priya → Patients A & B, Amit → Patients C & D).

### Caregiver Assignments
| Caregiver | Patients | Shift |
|---|---|---|
| Priya Nair | Patient A (Heart), Patient B (Hypertension) | Morning 08:00–16:00 |
| Amit Kumar | Patient C (Diabetic), Patient D (Elderly) | Night 20:00–08:00 |

---

## 3. Dashboards

### 🚨 Patient Dashboard (Elderly-Centric UI)
Designed for seniors with minimal cognitive load and high accessibility:
- **Live Vitals** — Heart Rate, SpO₂, Temperature updated every second via WebSocket with a cyan flash on each update.
- **Giant One-Touch SOS Button** — Instant Critical alert bypassing all threshold delays. Hold 3 seconds or tap.
- **Floating SOS Button** — Fixed red pill button at bottom-right corner that appears whenever the main SOS button scrolls off-screen, so help is always one tap away.
- **"I'm OK" Check-in** — Daily wellness confirmation with one tap.
- **Medication Due Checklist** — Visual reminder cards with "Mark as Taken" button.
- **Caregiver On-Duty Card** — Shows assigned caregiver name, shift, and direct call link.
- **🥗 Today's Diet & Wellness Tip** — Personalised by condition (cardiac diet, low-sodium, diabetic glucose routine, etc.).
- **👨‍👩‍👦 Family Details** — Shows primary and secondary family contacts with call button.

### 🩺 Caregiver Dashboard (Clinical-Telemetry UI)
Designed for nursing staff and home aides managing multiple patients:
- **Multi-Patient Telemetry Grid** — Live monitoring cards showing only the caregiver's assigned patients with colour-coded alerts and Health Scores (0–100).
- **Real-Time Sparklines & Charts** — 1-second live vitals stream.
- **Actionable Alert Queue** — Acknowledge (mutes siren) and Resolve workflows with mandatory care notes.
- **🥗 Diet & Nutrition Guidance** — Per-patient condition-specific diet tip in the detail panel so caregivers know what to serve.
- **Live Threshold Sandbox** — Modify per-patient thresholds and preview alert impact on historical data.
- **Care-Task Checklist & Handover Notes** — Daily task tracking and structured shift handover logs.
- **Escalation Countdown** — Live visual countdown before unacknowledged alerts escalate to secondary family contacts.
- **📲 Family WhatsApp Notification Log** — Colour-coded log of all family notifications (📋 Daily Report · 🚨 Critical · ⚠️ Warning).
- **🆘 Emergency Family Contacts** — Call and WhatsApp buttons for each patient's family.

---

## 4. AI Layer & Deterministic Fallback Engine

SmartCare employs a dual-engine architecture combining generative AI insights with 100% reliable local rule fallbacks:

```
[24h Patient Telemetry & Logs]
              |
              v
   Is Gemini API Key Configured & Online?
        /                       \
     YES                         NO (or Timeout / Rate Limit)
      |                                       |
      v                                       v
[AI Layer: Google Gemini API]        [Deterministic Fallback Layer]
• 24h Plain-Language Summary        • Local Rule-Based Heuristic Engine
• Contextual Caregiver Tips         • Statistical Min/Max/Avg Rollups
• Non-diagnostic Guardrails         • 100% Offline, Zero Latency
```

- **AI Layer (Google Gemini API):** Generates concise, plain-language 24-hour health summaries and tailored caregiver wellness suggestions. Strictly constrained via system prompts to prevent medical diagnosis, drug prescriptions, or dosage advice.
- **Deterministic Fallback Layer (`ai_service.py`):** If the Gemini API key is missing, network is offline, or the API call times out (>5s), the system seamlessly falls back to a built-in statistical heuristic engine without errors or user interruption.
- **Safety Invariant:** **Life-critical alert generation, threshold evaluation, and emergency notifications NEVER depend on AI.** Emergency alerting is 100% deterministic and hardcoded.

---

## 5. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | Python 3.11+ / FastAPI | Async REST API, native WebSocket server, background task scheduler |
| **Database** | SQLite (WAL Mode) | Zero-configuration database with append-only audit trail logging |
| **Frontend** | Vanilla HTML5 / CSS3 / ES6+ JavaScript | Zero-build, single-page web dashboard with role-locked access |
| **Charts** | Chart.js (CDN) | Real-time vitals sparklines, waveform trends, and threshold limit overlays |
| **Real-Time Stream** | Native WebSocket (`/ws`) | 1-second live telemetry broadcasts and instant alert synchronization |
| **AI Layer** | Google Gemini API (`gemini-1.5-flash`) | Non-diagnostic 24h summaries, trend explanations, and caregiver tips |
| **Fallback Engine** | Local Clinical Heuristics Engine | Offline rule-based statistical summarizer ensuring zero-failure continuity |
| **Simulation** | Python (`random`, `math`, `csv`) | Math-based dynamic simulator + 60,000-row Kaggle dataset replayer |
| **Notifications** | Telegram Bot API + WhatsApp Simulated Panel | Real Telegram delivery if configured; WhatsApp-styled simulated panel for demo |
| **Daily Reports** | Background AsyncIO Scheduler | Auto-fires morning health summary to all family contacts at 08:00 daily |
| **Voice Alerts** | Browser SpeechSynthesis API | Loud siren tones and spoken voice alerts for Critical/SOS events |

---

## 6. Key System Features

1. **Role-Based Access Control:** Each user (2 caregivers, 4 patients) has separate login credentials and sees only their own dashboard and data.
2. **Multi-Source Vitals Ingestion:** Tracks Heart Rate (BPM), Temperature (°C), SpO₂ (%), and Blood Pressure (mmHg) from dynamic simulator, CSV replay, or manual entry.
3. **5-Second False-Alarm Filter:** Requires vitals to remain outside boundaries for 5 consecutive seconds before firing an alert.
4. **Condition Threshold Profiles:** Pre-configured profiles for Heart Patient, Diabetic, Hypertension, and Default Elderly, all editable in real time.
5. **Caregiver-to-Patient Assignment:** Each caregiver manages only their assigned patients. Caregiver dashboard grid is filtered by assignment.
6. **Diet & Nutrition Guidance:** Condition-specific daily diet tips shown on both the patient dashboard (patient-facing) and caregiver detail panel (action-facing).
7. **Family Instant Alert Notifications:** Warning alerts → caregiver + primary family. Critical/SOS → caregiver + primary family simultaneously. Escalation (120s unacknowledged) → secondary family contact.
8. **Automated Daily Morning Report:** Every day at 08:00, a full health summary (vitals, medicine adherence, alerts, caregiver on duty) is sent to all family contacts via WhatsApp/Telegram.
9. **Floating SOS Button:** Always-visible SOS button that follows the patient as they scroll, fixed at bottom-right corner.
10. **Live Patient Vitals on WebSocket:** Patient dashboard vitals update every second via WebSocket with a flash animation — no page refresh needed.
11. **Medicine Reminders & "I'm OK" Check-in:** Multi-stage adherence tracking and daily senior wellness check-ins.
12. **Transparent Health Score (0–100):** Compliance indicator based on vitals stability, alert history, medicine adherence, and check-in completion.

---

## 7. Architecture & Ingestion Pipeline

```
[Dynamic Simulator]  [Dataset Replayer]  [Manual Form]  [Patient SOS]  [Future ESP32]
         \                  |                  |               |              /
          +-------------- POST /measurements (HR, Temp, SpO2, BP, Source) ----+
                                               |
                                     FastAPI Backend Core
                                               |
        +-------------------+------------------+-------------------+
        |                   |                  |                   |
   Sanity & Range     False-Alarm        Threshold Rules     AI Summarizer +
   Quarantine Filter  Window (5s)        & Escalation Engine Deterministic Fallback
        |                   |                  |                   |
        +-------------------+------------------+-------------------+
                                               |
                        WebSocket Broadcast (/ws) + Background Scheduler
                                               |
              +--------------------+-----------+------------------+
              |                    |                              |
   [Patient Dashboard]   [Caregiver Dashboard]        [Family WhatsApp/Telegram]
   • Live vitals (WS)    • Assigned patients only      • Instant alert on Warning+
   • Floating SOS        • Diet tip per patient         • Daily 08:00 morning report
   • Diet tip            • WhatsApp notification log    • Escalation on timeout
```

### Key design decision: device-independent ingestion
Every data source posts to the same endpoint:
```json
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
An ESP32 posting with `"source": "device"` flows through the same alert engine, threshold checks, and notifications without code modifications.

---

## 8. Family Notifications & Daily Report

### Instant Alerts to Family
| Alert Severity | Notified |
|---|---|
| Warning | Caregiver (in-app) + Primary family contact (WhatsApp simulated) |
| Critical | Caregiver + Primary family simultaneously |
| SOS (Patient button) | Caregiver + Primary family simultaneously |
| Escalation (120s unacknowledged) | Secondary family contact |

### Automated Daily Morning Report (08:00 AM)
Sent automatically every morning to **all family contacts** (primary + secondary) for every patient. Contains:
- Current vitals (HR, SpO₂, Temperature)
- 24-hour min/max/average summary
- Medicine adherence (taken vs. scheduled)
- Active alert count in last 24 hours
- Assigned caregiver name and shift

### Demo Trigger
Trigger the daily report manually for judges without waiting until 8 AM:
```bash
curl -X POST http://localhost:8000/trigger/daily-report
```
Or click **"📋 Send Morning Health Report to All Families"** in the Simulator & Dataset tab.

---

## 9. Quick Start Guide

### Prerequisites
- Python 3.11+
- Modern Web Browser (Chrome, Firefox, Safari, Edge)
- No physical hardware required (runs fully in software)

### Setup & Run

```bash
# 1. Clone repository and navigate to folder
git clone <repo-url>
cd HealthMonitor

# 2. Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Seed demo patients, caregivers, and medicine schedules
python seed.py

# 5. Launch the FastAPI application
uvicorn main:app --reload
```

Open **`http://localhost:8000`** in your browser and log in using the credentials below.

### Optional: Real Telegram / WhatsApp Notifications
Set in `config.json` (copy from `config.example.json`):
```json
{
  "TELEGRAM_BOT_TOKEN": "your-bot-token",
  "patients": {
    "p1": { "telegram_chat_id": "your-chat-id" }
  }
}
```
If not configured, all notifications are simulated in the WhatsApp notification log panel.

---

## 10. Configuration (`config.json`)

| Key | Default | Description |
|---|---|---|
| `false_alarm_seconds` | `5` | Readings must stay outside a limit for this many seconds before an alert fires |
| `offline_alert_seconds` | `120` | No reading for this long triggers a "Device offline" alert |
| `escalation_timeout_seconds` | `120` | Unacknowledged alert escalates to second family contact after this |
| `missed_checkin_seconds` | `3600` | "I'm OK" missed check-in alert fires after this |
| `simulator_interval_seconds` | `1` | How often the simulator generates a reading per patient |
| `column_mapping` | see docs | Maps CSV column names to the internal schema for dataset replay |

---

## 11. Demo Credentials

### Caregivers
| Name | Username | Password | Assigned Patients |
|---|---|---|---|
| Priya Nair | `priya.nair` | `caregiver123` | Patient A, Patient B |
| Amit Kumar | `amit.kumar` | `caregiver123` | Patient C, Patient D |

### Patients
| Patient | Username | Password | Condition |
|---|---|---|---|
| Demo Patient A | `patient.a` | `patient123` | Heart Patient, Age 72 |
| Demo Patient B | `patient.b` | `patient123` | Hypertension, Age 68 |
| Demo Patient C | `patient.c` | `patient123` | Diabetic, Age 74 |
| Demo Patient D | `patient.d` | `patient123` | Healthy Elderly, Age 80 |

---

## 12. 3-Minute Live Demo Script

| Time | Action | Demonstration Highlight |
|---|---|---|
| **0:00** | Log in as **Priya Nair** (Caregiver) | Show 2 assigned patient cards (A & B) updating live. Vitals are green. |
| **0:20** | Click **Simulator & Dataset** tab | Click **"Send Morning Health Report"** button. Show WhatsApp log filling with family messages for all patients. |
| **0:40** | Back to **Caregiver Dashboard** → Trigger tachycardia | `curl -X POST http://localhost:8000/trigger/tachycardia` — HR spikes. Show **5-second false-alarm filter** holding before alert fires. WhatsApp notification log shows family notified. |
| **1:10** | **Acknowledge** the alert | Siren stops, status shifts to Acknowledged, audit timestamp logged. |
| **1:30** | Log out → Log in as **Patient A** (`patient.a`) | Show patient-only view: live vitals updating every second, giant SOS button. |
| **1:50** | Scroll down on Patient Dashboard | **Floating SOS button** appears at bottom-right. Tap it to show it works from anywhere on the screen. |
| **2:10** | Press **SOS Button** | Bypasses threshold. Instant Critical alert fires. Caregiver + family notified simultaneously. |
| **2:30** | Log out → Log in as **Amit Kumar** | Show his dashboard with only Patients C & D — Patients A & B not visible. |
| **2:50** | Open **Judge Metrics** tab | Show alert latency, false-alarm suppressions, medicine adherence rates. |
| **3:00** | Wrap Up | Zero-cost operation, ESP32 hardware ready, family always informed. |

---

## 13. Evaluation & Metrics (`eval_test.py`)

```bash
python eval_test.py
```

Outputs:
- **Average Alert Latency:** Telemetry ingestion to notification dispatch time (in ms).
- **Suppressed False Alarms:** Count of transient spikes filtered by the 5-second persistence window.
- **Sensor Errors Quarantined:** Count of impossible readings safely quarantined without triggering alarms.
- **Medication Adherence:** Ratio of taken vs. missed medication events.

---

## 14. Cost & Honest Limitations

### Cost Breakdown
| Component | Prototype Cost | Future Production Cost |
|---|---|---|
| Backend & Server (FastAPI + SQLite) | **₹0** (Runs on localhost) | ~₹250/mo (Basic VPS) |
| Frontend Dashboard (Vanilla HTML/CSS/JS) | **₹0** (No build step) | ₹0 (Static hosting) |
| Notification Gateway (Telegram Bot) | **₹0** (Free API) | ₹0 (Free tier) |
| WhatsApp Business API | **₹0** (Simulated in demo) | ~₹500/mo (Meta pricing) |
| Public Dataset & Math Simulator | **₹0** (Open license) | ₹0 |
| ESP32 + MAX30102 + DS18B20 (Hardware node) | ₹0 (Simulated) | ~₹800–1,200 per patient |
| **Total Cost to Run Prototype** | **₹0** | **~₹1,000 one-time hardware** |

### Honest Prototype Disclosures
- **Software Prototype:** The live demonstration uses a mathematical simulator and replayed Kaggle dataset. No physical sensors are connected.
- **WhatsApp Notifications:** Shown as simulated in the demo. Production would use WhatsApp Business Cloud API (Meta) or Twilio.
- **ESP32 Integration:** Architecture is device-independent (`POST /measurements`). Reference sketch in `firmware/esp32_example.ino`.
- **Simulated Verifications:** Caregiver document verification and fee negotiation are mock UI workflows.
- **Non-Diagnostic Tool:** SmartCare monitors threshold compliance; it does not replace certified clinical diagnosis.

---

## 15. Additional Features (Future Roadmap)

1. **Physical ESP32 Wearable Node:** Connect MAX30102 (pulse oximeter/HR) and DS18B20 (body temperature) sensors via Wi-Fi/MQTT.
2. **Hardware Fall Detection:** Integrate MPU-6050 6-axis accelerometer on ESP32 to automatically set the `fall_detected` flag.
3. **Multilingual Regional Voice Support:** Add Hindi, Telugu, and Tamil voice announcements and UI toggles.
4. **Production WhatsApp & SMS Gateways:** Integrate WhatsApp Business Cloud API and Twilio SMS for real delivery.
5. **Emergency Services Webhook:** Automated payload dispatch to municipal ambulance dispatch centers on escalated emergencies.
6. **Edge AI Anomaly Detection:** Deploy TinyML models to the ESP32 for offline cardiac arrhythmia detection.
7. **ABDM & FHIR Integration:** Support Ayushman Bharat Digital Mission and HL7 FHIR standards for health record export.
8. **Health Score Breakdown Panel:** Visual breakdown of the 0–100 score (vitals 40%, medicines 30%, check-ins 20%, alerts 10%).
9. **Patient Check-in History Strip:** 7-day calendar strip showing daily "I'm OK" check-in status (green/red).
10. **OTP-based Family Access:** Family members enter phone number → receive OTP → view read-only patient summary.

---

## 16. Dataset Credits

| Item | Detail |
|---|---|
| **Name** | Synthetic Patient Healthcare Monitoring Dataset |
| **Source** | Kaggle |
| **Records** | 60,000 rows, 13 columns |
| **License** | Open license for educational and research prototyping |
| **Used for** | Optional dataset replay source (`simulator.py` dataset-replay mode). Not used for model training. |
| **Columns used** | Heart Rate (bpm), SpO2 Level (%), Body Temperature (°C), Fall Detection, Data Accuracy (%) |
| **Not used** | Predicted Disease is strictly isolated and never shown on any user-facing screen |

The dynamic simulator is the default and primary data source. The app runs fully without requiring the CSV file.
