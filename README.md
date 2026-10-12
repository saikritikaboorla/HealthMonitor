# SmartCare — Affordable Smart Health Monitoring & Emergency Alert System

> **Prototype & Non-Diagnostic Notice:**  
> SmartCare is an affordable patient-monitoring and caregiver-coordination prototype. It does **not** diagnose disease, recommend treatment, or replace professional medical assessment. All demonstration data is dynamically simulated or replayed from open healthcare datasets. All alerts are prototype alerts only.

**Track 3 — Affordable Health Tech** | **Hardware-Ready Software Prototype (₹0 to demo)**  
**Live Production URL:** [https://carebeat-health-monitor.vercel.app](https://carebeat-health-monitor.vercel.app)

---

## Table of Contents

1. [Problem Statement & Solution](#1-problem-statement--solution)
2. [Dual Login Dashboards (Patient vs. Caregiver)](#2-dual-login-dashboards-patient-vs-caregiver)
3. [AI Layer — Three-Tier LLM Architecture](#3-ai-layer--three-tier-llm-architecture)
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
SmartCare is an affordable, software-first platform that connects continuous vital-sign monitoring, false-alarm reduction, dual specialized dashboards, generative AI summaries with a three-tier LLM fallback chain, simulated WhatsApp & SMS family emergency channels, and multi-tier emergency escalation across caregivers and families.

---

## 2. Dual Login Dashboards (Patient vs. Caregiver)

Upon logging in, users access one of two purpose-built dashboards:

### 🚨 Patient Dashboard (Elderly-Centric UI)
Designed specifically for seniors and vulnerable patients with minimal cognitive load and high accessibility:
- **Giant One-Touch SOS Button:** Instant Critical alert broadcast bypassing all threshold delays.
- **One-Touch "I'm OK" Check-in:** Simple daily wellness confirmation without requiring typing.
- **Calm, High-Contrast Vitals:** Giant-font vitals with reassuring status chips (Heart Rate, SpO₂, Temperature, and Blood Pressure).
- **Medication Due Checklist:** Visual reminder cards with a one-tap "Taken" button and browser voice prompts.
- **Caregiver On-Duty & Family Speed-Dial:** Clear display of active caregiver and family contacts with masked phone numbers (`+91 9XXXXXX10`).
- **1-Tap Feeling Check & Hydration Tracker:** Senior wellness tracker with voice responses and 6-glass water logging.

### 🩺 Caregiver Dashboard (Clinical-Telemetry UI)
Designed for nursing staff, home aides, and family caregivers. The dashboard locks to a single patient per login session — to switch patients, the caregiver signs out and logs back in:
- **Dedicated Single-Patient Session:** Dashboard locks to the patient selected at login; no in-session patient switching.
- **Real-Time Sparklines & Charts:** 1-second live vitals stream powered by Chart.js with warning and critical limit overlays.
- **Actionable Alert Queue:** Alert timeline with Acknowledge (mutes siren) and Resolve workflows with mandatory care notes.
- **Live Threshold Sandbox:** Modify per-patient condition thresholds and preview alert impact on historical data before saving.
- **AI Insights Tab:** On-demand 24-hour AI health briefings powered by the three-tier LLM chain (Groq → Gemini → Local Heuristics).
- **Care-Task Checklist & Medication Adherence:** Routine nursing task checklist and adherence tracking with fast-forward demo capability.
- **Family Shift Handover & Dual Device Mockup:** Shift handover notes alongside simulated WhatsApp and SMS phone inboxes.

---

## 3. AI Layer — Three-Tier LLM Architecture

SmartCare's AI layer (`ai_service.py`) uses a **three-tier resolution chain** to guarantee a summary is always generated — whether or not external API keys are configured:

```
[24-Hour Patient Telemetry + Alert Logs + Medicine Adherence]
                          |
                          v
            ┌─────────────────────────┐
            │  Tier 1: Groq API       │  ← Primary LLM
            │  llama-3.1-8b-instant   │    Ultra-fast inference
            │  (OpenAI-compatible)    │    Free tier available
            └────────────┬────────────┘
                         │ Key missing or call fails
                         v
            ┌─────────────────────────┐
            │  Tier 2: Gemini API     │  ← Secondary LLM
            │  gemini-1.5-flash       │    Google Generative AI
            └────────────┬────────────┘
                         │ Key missing or call fails
                         v
            ┌─────────────────────────┐
            │  Tier 3: Local Engine   │  ← Final Fallback
            │  CareBeat Heuristics    │    100% offline
            │  v1.2                   │    Zero latency
            └─────────────────────────┘
```

### Where AI analysis is used in the product

| Feature | Location in UI | AI involvement |
|---|---|---|
| **24-Hour Health Briefing** | Caregiver Dashboard → AI Insights tab | Groq/Gemini generates 2–3 sentence plain-language summary of vitals, alerts, and medicine adherence over the past 24 hours |
| **Daily Caregiver Tips** | Caregiver Dashboard → AI Insights tab | Local heuristic engine generates condition-aware wellness suggestions (e.g., cardiac, hypertension, diabetic profiles) — no external API call |
| **Threshold Sandbox Analysis** | Caregiver Dashboard → AI Insights tab | Deterministic local engine computes historical breach impact when thresholds are modified |
| **Emergency Alert Generation** | All views (siren banner, alert queue) | **AI is never involved** — all alerts are 100% deterministic threshold rules |

### What the AI layer does and does not do

- ✅ Generates concise plain-language 24-hour caregiver briefings
- ✅ Provides contextual wellness suggestions tailored to patient condition profiles
- ✅ Degrades gracefully through three tiers — always returns a response
- ❌ Does **not** diagnose disease, suggest treatments, or recommend dosages
- ❌ Does **not** generate or influence life-critical alerts — those are hardcoded rules

### Groq API — Why it's the primary LLM

[Groq](https://groq.com) provides an OpenAI-compatible REST API backed by custom LPU (Language Processing Unit) hardware, delivering sub-second inference latency. The `llama-3.1-8b-instant` model is available on Groq's free tier, making it zero-cost for prototype and demo use.

```python
# ai_service.py — Groq API call (OpenAI-compatible format)
payload = {
    "model": "llama-3.1-8b-instant",
    "messages": [
        {"role": "system", "content": "<strict non-diagnostic system prompt>"},
        {"role": "user",   "content": "<24h patient vitals context>"}
    ],
    "temperature": 0.2,
    "max_tokens": 220
}
headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
# POST https://api.groq.com/openai/v1/chat/completions
```

### Safety Invariant

> **Life-critical alert generation, threshold evaluation, and emergency notifications NEVER depend on AI.** The entire alert engine, escalation logic, and SOS pipeline are deterministic and run without any external API dependency.

---

## 4. Technology Stack

| Layer | Technology | Purpose & Implementation Details |
|---|---|---|
| **Full-Stack Deployment** | **Vercel Serverless Platform** | Single unified production deployment hosting both frontend SPA and FastAPI serverless backend on one URL. Configured via `vercel.json` with `@vercel/python` builder. |
| **Backend Framework** | **Python 3.11+ / FastAPI** | High-performance asynchronous REST API, Uvicorn server, WebSocket communication layer, and background task management. |
| **Database** | **SQLite (WAL Mode)** | Lightweight relational database with automatic `/tmp` synchronization on serverless runtime and append-only audit trail logging. |
| **Frontend Architecture** | **Vanilla HTML5, CSS3, ES6+ JS** | Zero-build single-page application (SPA), eliminating npm/Node build overhead. High contrast, senior-accessible, responsive UI. |
| **Data Visualization** | **Chart.js (CDN)** | Hardware-accelerated canvas charts rendering live heart rate waveforms, warning bounds, and critical threshold limits. |
| **Real-Time Communication** | **FastAPI WebSocket (`/ws`) + Cloud Polling Fallback** | Native persistent WebSocket for local execution, automatically paired with an intelligent sub-second polling fallback on Vercel serverless. |
| **Emergency Channels** | **WhatsApp & SMS Mockup Inboxes** | Simulated WhatsApp alert dispatches with masked phone numbers (`+91 9XXXXXX10`), interactive 2-way messaging, Telegram bot integration, and SMS delivery logs. |
| **Primary LLM (AI Tier 1)** | **Groq API — `llama-3.1-8b-instant`** | Primary AI engine for 24-hour caregiver briefings. OpenAI-compatible REST endpoint. Ultra-fast LPU inference, free tier available at [groq.com](https://groq.com). |
| **Secondary LLM (AI Tier 2)** | **Google Gemini API — `gemini-1.5-flash`** | Secondary AI fallback if Groq key is unavailable or call fails. Google Generative AI REST API. |
| **AI Fallback Engine (Tier 3)** | **CareBeat Local Clinical Heuristics v1.2** | 100% offline rule-based statistical summarizer. Guaranteed response with zero latency. No external dependency. |
| **HTTP Client (AI calls)** | **httpx (async)** | Async HTTP client used for both Groq and Gemini API calls with 10-second timeout and graceful error handling. |
| **Simulation & Replay** | **Python (`random`, `math`, `csv`)** | Mathematical Gaussian drift generator (`simulator.py`) + 60,000-row Kaggle healthcare dataset replayer. |
| **Auditory & Voice Alerts** | **Browser SpeechSynthesis API** | Spoken vital sign readouts ("Read Vitals Aloud"), audible emergency sirens, and medication speech prompts. |

---

## 5. Key System Features

1. **Multi-Source Vitals Ingestion:** Tracks 4 primary vitals — Heart Rate (BPM), Temperature (°C), SpO₂ (%), and Blood Pressure (mmHg) — from dynamic simulator, CSV replay, or manual entry.
2. **Dedicated Single-Patient Caregiver Sessions:** Dashboard locks to the patient selected at login. Switching patients requires signing out and back in, ensuring focused attention per session.
3. **Simulated WhatsApp Emergency Alerts:** Real-time WhatsApp alert dispatches sent to caregiver and primary family contacts on Critical & SOS events, with strict phone masking (`+91 9XXXXXX10`).
4. **5-Second False-Alarm Persistence Filter:** Requires vitals to breach threshold boundaries for 5 consecutive seconds before firing an alert, filtering transient sensor spikes.
5. **Condition-Based Threshold Sandbox:** Custom limits per condition profile with client-side historical replay preview before saving.
6. **Instant Emergency Escalation:** Warning alerts notify caregivers; Critical & SOS alerts notify caregivers, WhatsApp, and family simultaneously. Unacknowledged alerts auto-escalate after 120 seconds.
7. **Three-Tier AI Summaries:** On-demand 24-hour briefings resolved via Groq → Gemini → local heuristics, always returning a non-diagnostic caregiver summary.
8. **Medicine Adherence & Daily Check-In:** Adherence logs with fast-forward demo capability and 1-tap "I'm OK" senior wellness confirmation.
9. **Transparent Health Score (0–100):** Real-time algorithm scoring vitals stability, alert penalty, medicine completion, and daily check-ins.

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
   Sanity & Range     False-Alarm        Threshold Rules     AI Summarizer
   Quarantine Filter  Window (5s)        & Escalation Engine (Groq → Gemini → Heuristics)
        |                   |                  |                   |
        +-------------------+------------------+-------------------+
                                               |
                               WebSocket Broadcast (/ws)
                                               |
                   +---------------------------+---------------------------+
                   |                                                       |
        [Patient Dashboard]                                     [Caregiver Dashboard]
        • Large SOS Panic Button                                • Dedicated Patient Telemetry
        • "I'm OK" Check-in                                     • Live Charts & Alerts
        • Simple Vitals & Meds                                  • AI Insights & Threshold Sandbox
                                                                • Tasks & Handover Notes
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

An ESP32 posting with `"source": "device"` flows through the same alert engine, threshold checks, and notifications without code modifications.

---

## 7. Quick Start Guide

### Prerequisites
- Python 3.11+
- Modern web browser (Chrome, Firefox, Safari, Edge)
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

### Deploy to Vercel (Unified Frontend + Backend)

```bash
vercel --prod
```

**Live Deployment URL:** [https://carebeat-health-monitor.vercel.app](https://carebeat-health-monitor.vercel.app)

### Optional: Enable AI Summaries

Set API keys in `config.json` (copy from `config.example.json`). The system tries Groq first, then Gemini — if neither key is set, the local heuristics engine runs automatically with no configuration required.

```json
{
  "GROQ_API_KEY": "gsk_your_groq_key_here",
  "GROQ_MODEL": "llama-3.1-8b-instant",
  "GEMINI_API_KEY": "your_gemini_key_here",
  "GEMINI_MODEL": "gemini-1.5-flash"
}
```

Get a free Groq API key at [console.groq.com](https://console.groq.com).

### Optional: Telegram Notifications

```json
{
  "TELEGRAM_BOT_TOKEN": "your-bot-token",
  "patients": {
    "p1": { "telegram_chat_id": "your-chat-id" }
  }
}
```

---

## 8. Configuration (`config.json`)

All configurable operational values live in `config.json`. Copy `config.example.json` to get started:

| Key | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | `""` | Groq Cloud API key — primary LLM for AI summaries. Free tier at [console.groq.com](https://console.groq.com). |
| `GROQ_MODEL` | `llama-3.1-8b-instant` | Groq model ID. Alternatives: `mixtral-8x7b-32768`, `llama3-70b-8192`. |
| `GEMINI_API_KEY` | `""` | Google Gemini API key — secondary LLM fallback. Optional. |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Gemini model ID used when Groq is unavailable. |
| `TELEGRAM_BOT_TOKEN` | `""` | Telegram Bot token for push notifications. |
| `false_alarm_seconds` | `5` | Readings must stay outside a limit for this many seconds before an alert fires. |
| `offline_alert_seconds` | `120` | No reading for this long triggers a "Device offline" alert. |
| `escalation_timeout_seconds` | `120` | Unacknowledged alert escalates to second family contact after this. |
| `missed_checkin_seconds` | `3600` | "I'm OK" missed check-in alert fires after this. |
| `simulator_interval_seconds` | `1` | How often the simulator generates a reading per patient. |
| `column_mapping` | see docs | Maps CSV column names to the internal schema for dataset replay. |

---

## 9. 3-Minute Live Demo Script

| Time | Action | Demonstration Highlight |
|---|---|---|
| **0:00** | Open Dashboard & Log in as **Caregiver (Priya)** — select Patient 1 | Show dedicated patient telemetry cards updating every second via WebSocket. Vitals are green and stable. |
| **0:30** | Run `curl -X POST http://localhost:8000/trigger/tachycardia` | Heart rate spikes to 135 BPM. Show the **5-second false-alarm filter** holding before raising the alert. |
| **1:00** | Alert sounds siren + banner | Click **Acknowledge** on the alert. Siren stops, status shifts to Acknowledged, audit timestamp is logged. |
| **1:30** | Switch to **Patient View (Demo Patient A)** | Point out senior-friendly UI. Press the giant **SOS Button**. Bypasses threshold checks and fires immediate Critical alert. |
| **2:00** | Switch back to **Caregiver View → AI Insights tab** | Click **Generate Summary** to trigger the Groq AI briefing. Show the 24-hour plain-language summary and the AI source badge. |
| **2:30** | Open **System Metrics tab** | Show judges real-time metrics: sub-second alert latency, false-alarm suppressions, and medicine adherence rates. |
| **3:00** | Wrap Up | Conclude demonstrating the three-tier AI fallback, zero-cost operation, and ESP32 hardware readiness. |

---

## 10. Evaluation & Metrics (`eval_test.py`)

```bash
python eval_test.py
```

Simulates a 5-minute fixed-seed scenario and outputs:
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
| AI Summaries — Groq API (Free tier) | **₹0** | ₹0 (Free tier: 14,400 req/day) |
| AI Summaries — Gemini API (Fallback) | **₹0** | ₹0–₹500/mo (pay-as-you-go) |
| Public Dataset & Math Simulator | **₹0** (Open license) | ₹0 |
| ESP32 + MAX30102 + DS18B20 (Hardware node) | ₹0 (Simulated) | ~₹800–1,200 per patient |
| **Total Cost to Run Prototype** | **₹0** | **~₹1,000 one-time hardware** |

### Honest Prototype Disclosures
- **Software Prototype:** The live demonstration uses a mathematical simulator and replayed Kaggle dataset. No physical sensors are connected during the demo.
- **ESP32 Integration:** Ingestion architecture is device-independent (`POST /measurements`). A reference sketch is provided in `firmware/esp32_example.ino` as future hardware work.
- **AI Non-Diagnostic Guardrail:** The AI summary layer is strictly constrained via system prompts to describe observed readings only, never diagnose or prescribe.
- **Non-Diagnostic Tool:** SmartCare monitors threshold compliance; it does not replace certified clinical diagnosis.

---

## 12. Additional Features (Future Roadmap)

1. **Physical ESP32 Wearable Node:** Connect MAX30102 (pulse oximeter/HR) and DS18B20 (body temperature) sensors via Wi-Fi/MQTT.
2. **Hardware Fall Detection:** Integrate MPU-6050 6-axis accelerometer on ESP32 to automatically set the `fall_detected` flag.
3. **Multilingual Regional Voice Support:** Add Hindi, Telugu, and Tamil voice announcements and UI toggles.
4. **Production SMS & WhatsApp Gateways:** Integrate Twilio SMS and WhatsApp Business Cloud API for automated messaging.
5. **Emergency Services Webhook:** Automated payload dispatch to municipal ambulance dispatch centers upon escalated emergencies.
6. **Edge AI Anomaly Detection:** Deploy TinyML models directly to the ESP32 for offline cardiac arrhythmia detection.
7. **ABDM & FHIR Integration:** Support Ayushman Bharat Digital Mission and HL7 FHIR standards for electronic health record export.
8. **Enhanced LLM Analysis:** Extend Groq-powered AI to trend detection, anomaly explanations, and proactive deterioration warnings across multi-day rolling windows.

---

## 13. Dataset Credits

| Item | Detail |
|---|---|
| **Name** | Synthetic Patient Healthcare Monitoring Dataset |
| **Source** | Kaggle |
| **Records** | 60,000 rows, 13 columns |
| **License** | Open license for educational and research prototyping |
| **Used for** | Optional dataset replay source (`simulator.py` dataset-replay mode). Not used for model training. |
| **Columns used** | Heart Rate (bpm), SpO₂ Level (%), Body Temperature (°C), Fall Detection, Data Accuracy (%) |
| **Not used** | Predicted Disease is strictly isolated and never shown on any user-facing screen |

The dynamic math simulator is the default and primary data source. The app runs fully without the CSV file.
