# SmartCare — Affordable Smart Health Monitoring & Emergency Alert System

> **Prototype & Non-Diagnostic Notice:**  
> SmartCare is an affordable patient-monitoring and caregiver-coordination prototype. It does **not** diagnose disease, recommend treatment, or replace professional medical assessment. All demonstration data is dynamically simulated or replayed from open healthcare datasets. All alerts are prototype alerts only.

**Track 3 — Affordable Health Tech** | **Hardware-Ready Software Prototype (₹0 to demo)**

---

## Table of Contents

1. [Problem Statement & Solution](#1-problem-statement--solution)
2. [Dual Login Dashboards (Patient vs. Caregiver)](#2-dual-login-dashboards-patient-vs-caregiver)
3. [AI Layer & Deterministic Fallback Engine](#3-ai-layer--deterministic-fallback-engine)
4. [Technology Stack](#4-technology-stack)
5. [Key System Features](#5-key-system-features)
6. [Architecture & Ingestion Pipeline](#6-architecture--ingestion-pipeline)
7. [Quick Start Guide](#7-quick-start-guide)
8. [Configuration (config.json)](#8-configuration-configjson)
9. [3-Minute Live Demo Script](#9-3-minute-live-demo-script)
10. [Evaluation & Metrics (eval_test.py)](#10-evaluation--metrics-eval_testpy)
11. [Cost & Honest Limitations](#11-cost--honest-limitations)
12. [Additional Features (Future Roadmap)](#12-additional-features-future-roadmap)
13. [Dataset Credits](#13-dataset-credits)

---

## 1. Problem Statement & Solution

### Problem Statement
Elderly individuals and patients requiring regular vitals monitoring often lack timely attention when their vital signs fluctuate abnormally or when they need urgent assistance. Commercial remote-monitoring setups are expensive, technically complicated for seniors, and prone to alert fatigue, while family members living remotely lack real-time visibility.

### Solution
SmartCare is an affordable, software-first platform that connects continuous vital-sign monitoring, false-alarm reduction, dual specialized dashboards, generative AI summaries with local offline fallbacks, and multi-tier emergency escalation across caregivers and families.

---

## 2. Dual Login Dashboards (Patient vs. Caregiver)

Upon logging in or switching roles, users access one of two purpose-built dashboards:

### 🚨 Patient Dashboard (Elderly-Centric UI)
Designed specifically for seniors and vulnerable patients with minimal cognitive load and high accessibility:
- **Giant One-Touch SOS Button:** Instant Critical alert broadcast bypassing all threshold delays.
- **One-Touch "I'm OK" Check-in:** Simple daily wellness confirmation without requiring typing.
- **Calm, High-Contrast Vitals:** Giant-font vitals with reassuring status chips (e.g., `Heart Rate: 74 BPM (Normal)`).
- **Medication Due Checklist:** Visual reminder cards with a one-tap "Taken" button and browser voice prompts.
- **Caregiver On-Duty Status:** Clear display of active caregiver presence with one-tap emergency call link.

### 🩺 Caregiver Dashboard (Clinical-Telemetry UI)
Designed for nursing staff, home aides, and family caregivers managing multiple patients:
- **Multi-Patient Telemetry Grid:** Live monitoring cards with color-coded alerts and Health Scores (0–100).
- **Real-Time Sparklines & Charts:** 1-second live vitals stream powered by Chart.js.
- **Actionable Alert Queue:** Alert timeline with Acknowledge (mutes siren) and Resolve workflows with mandatory care notes.
- **Live Threshold Sandbox:** Modify per-patient condition thresholds and preview alert impact on historical data before saving.
- **Care-Task Checklist & Handover Notes:** Daily task tracking (vitals check, meals, mobility) and structured handover logs between shifts.
- **Escalation Countdown:** Live visual countdown before unacknowledged alerts escalate to secondary family contacts.

---

## 3. AI Layer & Deterministic Fallback Engine

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

## 4. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | Python 3.11+ / FastAPI | Async REST API, native WebSocket server, background task manager |
| **Database** | SQLite (WAL Mode) | Zero-configuration database with append-only audit trail logging |
| **Frontend** | Vanilla HTML5 / CSS3 / ES6+ JavaScript | Zero-build, single-page web dashboard with responsive, high-contrast layouts |
| **Charts** | Chart.js (CDN) | Real-time vitals sparklines, waveform trends, and threshold limit overlays |
| **Real-Time Stream** | Native WebSocket (`/ws`) | 1-second live telemetry broadcasts and instant alert synchronization |
| **AI Layer** | Google Gemini API (`gemini-1.5-flash`) | Non-diagnostic 24h summaries, trend explanations, and caregiver tips |
| **Fallback Engine** | Local Clinical Heuristics Engine | Offline rule-based statistical summarizer ensuring zero-failure continuity |
| **Simulation** | Python (`random`, `math`, `csv`) | Math-based dynamic simulator (`simulator.py`) + 60,000-row Kaggle dataset replayer |
| **Notifications** | Telegram Bot API + Simulated SMS Panel | Real-world Telegram bot messaging; in-dashboard SMS toast panel |
| **Voice Alerts** | Browser SpeechSynthesis API | Loud siren tones and spoken voice alerts for Critical/SOS events |

---

## 5. Key System Features

1. **Multi-Source Vitals Ingestion:** Tracks Heart Rate (BPM), Temperature (°C), SpO₂ (%), and Blood Pressure (mmHg) from dynamic simulator, CSV replay, or manual entry.
2. **5-Second False-Alarm Filter:** Requires vitals to remain outside boundaries for 5 consecutive seconds before firing an alert, filtering noisy sensor spikes.
3. **Condition Threshold Profiles:** Pre-configured profiles for Heart Patient, Diabetic, Hypertension, and Default Elderly, all editable in real time.
4. **Caregiver Module:** Skill matching, shifts, care task checklists, daily notes, and structured handover logs between shifts.
5. **Family Connectivity:** Mandatory family contact on registration, masked phone display, direct alerts on Critical/SOS, and read-only family view.
6. **Instant Emergency Escalation:** Warning alerts notify caregivers; Critical & SOS alerts notify caregivers and family simultaneously. Unacknowledged alerts auto-escalate to secondary contacts after 120 seconds.
7. **Medicine Reminders & "I'm OK" Check-in:** Multi-stage adherence tracking (Due → Caregiver Alert → Family Escalation) and daily senior wellness check-ins.
8. **Transparent Health Score (0–100):** Clear compliance indicator based on vitals stability, alert history, medicine adherence, and check-in completion.

---

## 6. Architecture & Ingestion Pipeline

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
                               WebSocket Broadcast (/ws)
                                               |
                   +---------------------------+---------------------------+
                   |                                                       |
        [Patient Dashboard]                                     [Caregiver Dashboard]
        • Large SOS Panic Button                                • Multi-Patient Telemetry
        • "I'm OK" Check-in                                     • Live Charts & Alerts
        • Simple Vitals & Meds                                  • Tasks & Handover Notes
```

### Key design decision: device-independent ingestion
Every data source — simulator, dataset replayer, manual form, and a future hardware device — posts to the same endpoint:
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
The backend processes readings identically regardless of source. An ESP32 posting with `"source": "device"` flows through the same alert engine, threshold checks, and notifications without code modifications.

---

## 7. Quick Start Guide

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

Open **`http://localhost:8000`** in your browser.

### Optional: Telegram Notifications
Set in `config.json` (copy from `config.example.json`):
```json
{
  "TELEGRAM_BOT_TOKEN": "your-bot-token",
  "patients": {
    "p1": { "telegram_chat_id": "your-chat-id" }
  }
}
```
If not configured, the system logs notifications to the console and displays a "Telegram (simulated)" toast on the dashboard.

---

## 8. Configuration (`config.json`)

All configurable operational values live in `config.json`. Copy `config.example.json` to get started:

| Key | Default | Description |
|---|---|---|
| `false_alarm_seconds` | `5` | Readings must stay outside a limit for this many seconds before an alert fires |
| `offline_alert_seconds` | `120` | No reading for this long triggers a "Device offline" alert |
| `escalation_timeout_seconds` | `120` | Unacknowledged alert escalates to second family contact after this |
| `missed_checkin_seconds` | `3600` | "I'm OK" missed check-in alert fires after this |
| `simulator_interval_seconds` | `1` | How often the simulator generates a reading per patient |
| `column_mapping` | see docs | Maps CSV column names to the internal schema for dataset replay |

---

## 9. 3-Minute Live Demo Script

Follow this script to demonstrate the complete monitoring, alerting, acknowledging, and escalation cycle to judges:

| Time | Action | Demonstration Highlight |
|---|---|---|
| **0:00** | Open Dashboard & Log in as **Caregiver (Priya)** | Point out 4 patient cards updating every second via WebSocket. Vitals are green, baseline is stable. |
| **0:30** | Run `curl -X POST http://localhost:8000/trigger/tachycardia` | Heart rate spikes to 135 BPM. Show the **5-second false-alarm filter** holding before raising the alert. |
| **1:00** | Alert sounds siren + banner | Click **Acknowledge** on the alert. Siren stops, status shifts to Acknowledged, audit timestamp is logged. |
| **1:30** | Switch to **Patient View (Demo Patient A)** | Point out senior-friendly UI. Press the giant **SOS Button**. Bypasses threshold checks and fires immediate Critical alert. |
| **2:00** | Switch back to **Caregiver View** | Point out the SOS banner and the **120-second escalation countdown timer** ticking toward secondary contact notification. |
| **2:30** | Open **Metrics & Evaluation View** | Show judges real-time metrics: sub-second alert latency, false-alarm suppressions, and medicine adherence rates. |
| **3:00** | Wrap Up | Conclude demo showing zero-cost operation and ESP32 hardware readiness. |

---

## 10. Evaluation & Metrics (`eval_test.py`)

Run the automated evaluation test to independently verify system performance:

```bash
python eval_test.py
```

This simulates a 5-minute fixed-seed scenario and outputs:
- **Average Alert Latency:** Telemetry ingestion to notification dispatch time (in ms).
- **Suppressed False Alarms:** Count of transient spikes filtered by the 5-second persistence window.
- **Sensor Errors Quarantined:** Count of impossible readings safely quarantined without triggering alarms.
- **Medication Adherence:** Ratio of taken vs. missed medication events.

---

## 11. Cost & Honest Limitations

### Cost Breakdown
| Component | Prototype Cost | Future Production Cost |
|---|---|---|
| Backend & Server (FastAPI + SQLite) | **₹0** (Runs on localhost) | ~₹250/mo (Basic VPS) |
| Frontend Dashboard (Vanilla HTML/CSS/JS) | **₹0** (No build step) | ₹0 (Static hosting) |
| Notification Gateway (Telegram Bot) | **₹0** (Free API) | ₹0 (Free tier) |
| Public Dataset & Math Simulator | **₹0** (Open license) | ₹0 |
| ESP32 + MAX30102 + DS18B20 (Hardware node) | ₹0 (Simulated) | ~₹800–1,200 per patient |
| **Total Cost to Run Prototype** | **₹0** | **~₹1,000 one-time hardware** |

### Honest Prototype Disclosures
- **Software Prototype:** The live demonstration uses a mathematical simulator and replayed Kaggle dataset. No physical sensors are connected during the demo.
- **ESP32 Integration:** Ingestion architecture is device-independent (`POST /measurements`). A reference sketch is provided in `firmware/esp32_example.ino` as future hardware work.
- **Simulated Verifications:** Caregiver document verification and fee negotiation are mock UI demonstration workflows, not connected to government or banking databases.
- **Non-Diagnostic Tool:** SmartCare monitors threshold compliance; it does not replace certified clinical diagnosis.

---

## 12. Additional Features (Future Roadmap)

Features planned for post-prototype development:

1. **Physical ESP32 Wearable Node:** Connect MAX30102 (pulse oximeter/HR) and DS18B20 (body temperature) sensors via Wi-Fi/MQTT.
2. **Hardware Fall Detection:** Integrate MPU-6050 6-axis accelerometer on ESP32 to automatically set the `fall_detected` flag.
3. **Multilingual Regional Voice Support:** Add Hindi, Telugu, and Tamil voice announcements and UI toggles.
4. **Production SMS & WhatsApp Gateways:** Integrate Twilio SMS and WhatsApp Business Cloud API for automated messaging.
5. **Emergency Services Webhook:** Automated payload dispatch to municipal ambulance dispatch centers upon escalated emergencies.
6. **Edge AI Anomaly Detection:** Deploy TinyML models directly to the ESP32 for offline cardiac arrhythmia detection.
7. **ABDM & FHIR Integration:** Support Ayushman Bharat Digital Mission and HL7 FHIR standards for electronic health record export.

---

## 13. Dataset Credits

| Item | Detail |
|---|---|
| **Name** | Synthetic Patient Healthcare Monitoring Dataset |
| **Source** | Kaggle |
| **Records** | 60,000 rows, 13 columns |
| **License** | Open license for educational and research prototyping |
| **Used for** | Optional dataset replay source (`replayer.py`). Not used for model training. |
| **Columns used** | Heart Rate (bpm), SpO2 Level (%), Body Temperature (°C), Fall Detection, Data Accuracy (%) |
| **Not used** | Predicted Disease is strictly isolated and never shown on any user-facing screen |

The dynamic simulator is the default and primary data source. The app runs fully without requiring the CSV file.
