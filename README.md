# SmartCare — Affordable Smart Health Monitoring & Emergency Alert System

> **Prototype & Non-Diagnostic Notice:**  
> SmartCare is an affordable patient-monitoring and caregiver-coordination prototype. It does **not** diagnose disease, recommend treatment, or replace professional medical assessment. All demonstration data is dynamically simulated or replayed from open healthcare datasets. All alerts are prototype alerts only.

**Track 3 — Affordable Health Tech** | **Hardware-Ready Software Prototype (₹0 to demo)**  
**Live Production URL (Unified Full-Stack Vercel):** [https://carebeat-health-monitor.vercel.app](https://carebeat-health-monitor.vercel.app)

---

## Table of Contents

1. [Problem Statement & Solution](#1-problem-statement--solution)
2. [Dual Login Dashboards (Patient vs. Caregiver)](#2-dual-login-dashboards-patient-vs-caregiver)
3. [AI Layer & Deterministic Fallback Engine](#3-ai-layer--deterministic-fallback-engine)
4. [Technology Stack](#4-technology-stack)
5. [Key System Features](#5-key-system-features)
6. [Architecture & Ingestion Pipeline](#6-architecture--ingestion-pipeline)
7. [Quick Start & Deployment Guide](#7-quick-start--deployment-guide)
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
SmartCare is an affordable, software-first platform that connects continuous vital-sign monitoring, false-alarm reduction, dual specialized dashboards, generative AI summaries with local offline fallbacks, simulated WhatsApp & SMS family emergency channels, and multi-tier emergency escalation across caregivers and families.

---

## 2. Dual Login Dashboards (Patient vs. Caregiver)

Upon logging in or switching roles, users access one of two purpose-built dashboards:

### 🚨 Patient Dashboard (Elderly-Centric UI)
Designed specifically for seniors and vulnerable patients with minimal cognitive load and high accessibility:
- **Giant One-Touch SOS Button:** Instant Critical alert broadcast bypassing all threshold delays.
- **One-Touch "I'm OK" Check-in:** Simple daily wellness confirmation without requiring typing.
- **Calm, High-Contrast Vitals:** Giant-font vitals with reassuring status chips (Heart Rate, SpO₂, Temperature, and Blood Pressure).
- **Medication Due Checklist:** Visual reminder cards with a one-tap "Taken" button and browser voice prompts.
- **Caregiver On-Duty & Family Speed-Dial:** Clear display of active caregiver and family contacts with masked phone numbers (`+91 9XXXXXX10`).
- **1-Tap Feeling Check & Hydration Tracker:** Senior wellness tracker with voice responses and 6-glass water logging.

### 🩺 Caregiver Dashboard (Clinical-Telemetry UI)
Designed for nursing staff, home aides, and family caregivers managing assigned patients:
- **Separated Dual-Patient Dashboards (Max 2 Patients Capacity):** Neatly structured telemetry cards enforcing a strict 2-patient workload limit per caregiver shift (Patient 1 and Patient 2 in distinct slots).
- **Instant Patient Focus Switcher:** Top bar quick-toggle buttons allowing the caregiver to switch between Patient 1 and Patient 2 effortlessly.
- **Real-Time Sparklines & Charts:** 1-second live vitals stream powered by Chart.js with warning and critical limit overlays.
- **Actionable Alert Queue:** Alert timeline with Claim Lock (60s), Acknowledge (mutes siren), and Resolve workflows with mandatory care notes.
- **Live Threshold Sandbox:** Modify per-patient condition thresholds and preview alert impact on historical data before saving.
- **Care-Task Checklist & Medication Adherence:** Routine nursing task checklist and adherence tracking with fast-forward demo capability.
- **Family Shift Handover & Dual Device Mockup:** Shift handover notes alongside simulated WhatsApp and SMS phone inboxes with real-time text alert dispatches.

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

| Layer | Technology | Purpose & Implementation Details |
|---|---|---|
| **Full-Stack Deployment** | **Vercel Serverless Platform** | Single unified production deployment hosting both frontend SPA and FastAPI serverless backend on one URL (`https://carebeat-health-monitor.vercel.app`). Configured via `vercel.json` with `@vercel/python` builder. |
| **Backend Framework** | **Python 3.11+ / FastAPI** | High-performance asynchronous REST API, Uvicorn server, WebSocket communication layer, and background task management. |
| **Database** | **SQLite (WAL Mode)** | Lightweight relational database with automatic `/tmp` synchronization on serverless runtime and append-only audit trail logging. |
| **Frontend Architecture** | **Vanilla HTML5, CSS3, ES6+ JS** | Zero-build single-page application (SPA), eliminating npm/Node build overhead. High contrast, senior accessible, responsive UI. |
| **Data Visualization** | **Chart.js (CDN)** | Hardware-accelerated canvas charts rendering live heart rate waveforms, warning bounds, and critical threshold limits. |
| **Real-Time Communication** | **FastAPI WebSocket (`/ws`) + Cloud Polling Fallback** | Native persistent WebSocket for local execution, automatically paired with an intelligent sub-second polling fallback on serverless platforms. |
| **Emergency Channels** | **WhatsApp & SMS Mockup Inboxes** | Dedicated WhatsApp alerts section with masked phone numbers (`+91 9XXXXXX10`), interactive 2-way messaging, Telegram bot integration, and SMS delivery. |
| **AI Intelligence Layer** | **Google Gemini API (`gemini-1.5-flash`)** | Generates non-diagnostic 24h summaries, trend explanations, and contextual caregiver wellness suggestions. |
| **Deterministic Engine** | **Local Clinical Heuristics Engine** | 100% offline rule-based statistical summarizer guaranteeing resilience when external AI is offline. |
| **Simulation & Replay** | **Python (`random`, `math`, `csv`)** | Mathematical Gaussian drift generator (`simulator.py`) + 60,000-row Kaggle healthcare dataset replayer. |
| **Auditory & Voice Alerts** | **Browser SpeechSynthesis API** | Spoken vital sign readouts ("Read Vitals Aloud"), audible emergency sirens, and medication speech prompts. |

---

## 5. Key System Features

1. **Multi-Source Vitals Ingestion:** Tracks 4 primary vitals: Heart Rate (BPM), Temperature (°C), SpO₂ (%), and Blood Pressure (mmHg) from dynamic simulator, CSV replay, or manual entry.
2. **Caregiver Cohort Capacity (Max 2 Patients):** Enforces a clean 2-patient active cohort per caregiver shift, presenting Patient 1 and Patient 2 in distinct, organized clinical dashboards.
3. **Simulated WhatsApp Emergency Section:** Real-time WhatsApp emergency alert dispatches sent to caregiver and primary family contacts on Critical & SOS events with strict phone masking with X's (`+91 9XXXXXX10`).
4. **5-Second False-Alarm Persistence Filter:** Requires vitals to breach threshold boundaries for 5 consecutive seconds before firing an alert, filtering noisy sensor spikes.
5. **Condition-Based Threshold Sandbox:** Custom limits per condition profile with client-side historical replay preview before saving.
6. **Instant Emergency Escalation:** Warning alerts notify caregivers; Critical & SOS alerts notify caregivers, WhatsApp, and family simultaneously. Unacknowledged alerts auto-escalate to secondary contacts after 120 seconds.
7. **Medicine Adherence & Daily Check-In:** Adherence logs with fast-forward demo capability and 1-tap "I'm OK" senior wellness confirmation.
8. **Transparent Health Score (0–100):** Real-time algorithm scoring vitals stability, alert penalty, medicine completion, and daily check-ins.

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

### Setup & Run (Localhost)

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

### Deploy to Vercel (Unified Frontend + Backend in One URL)

Both the frontend static client and the FastAPI backend are deployed under a single domain via `vercel.json`:

```bash
# Deploy to Vercel Production
vercel --prod
```

**Live Deployment URL:** [https://carebeat-health-monitor.vercel.app](https://carebeat-health-monitor.vercel.app)

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
| **Used for** | Optional dataset replay source (`simulator.py` dataset-replay mode). Not used for model training. |
| **Columns used** | Heart Rate (bpm), SpO2 Level (%), Body Temperature (°C), Fall Detection, Data Accuracy (%) |
| **Not used** | Predicted Disease is strictly isolated and never shown on any user-facing screen |

The dynamic simulator is the default and primary data source. The app runs fully without requiring the CSV file.
