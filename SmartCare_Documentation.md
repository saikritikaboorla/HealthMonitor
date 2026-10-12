# SmartCare: Affordable Smart Health Monitoring and Emergency Alert System

**Document type:** Project and technical documentation  
**Audience:** Clients, reviewers, judges, and developers building the prototype  
**Status:** Hackathon prototype specification (Track 3 — Affordable Health Tech)  

> [!IMPORTANT]
> **Important notice:** SmartCare is a monitoring and caregiver-coordination prototype. It does not diagnose disease, recommend treatment, or replace professional medical assessment. All demonstration data is dynamically simulated or optionally replayed from a public dataset. All alerts are prototype alerts only.

---

## Table of Contents

1. [Overview](#1-overview)
   - 1.1 [Problem](#11-problem)
   - 1.2 [Solution](#12-solution)
   - 1.3 [Objectives](#13-objectives)
2. [Recommended Technology Stack](#2-recommended-technology-stack)
3. [System Architecture](#3-system-architecture)
   - 3.1 [Data Input Layer](#31-data-input-layer)
   - 3.2 [Backend and API Layer](#32-backend-and-api-layer)
   - 3.3 [Alert and Rules Engine](#33-alert-and-rules-engine)
   - 3.4 [Caregiver Module](#34-caregiver-module)
   - 3.5 [Notification Router](#35-notification-router)
   - 3.6 [Database Layer](#36-database-layer)
   - 3.7 [Frontend & Dual-Dashboard Architecture](#37-frontend--dual-dashboard-architecture)
4. [How the Application Works](#4-how-the-application-works)
   - 4.1 [End-to-End Workflow](#41-end-to-end-workflow)
   - 4.2 [Alert States](#42-alert-states)
   - 4.3 [Alert Routing by Severity](#43-alert-routing-by-severity)
5. [Patient Registration and Family Contact](#5-patient-registration-and-family-contact)
   - 5.1 [Registration Form](#51-registration-form)
   - 5.2 [Family Contact Rules](#52-family-contact-rules)
   - 5.3 [Condition-Based Threshold Profiles](#53-condition-based-threshold-profiles)
6. [Caregiver Module](#6-caregiver-module)
   - 6.1 [Caregiver Profile](#61-caregiver-profile)
   - 6.2 [Verification (MOCK)](#62-verification-mock)
   - 6.3 [Fee Negotiation (MOCK)](#63-fee-negotiation-mock)
   - 6.4 [Caregiver Assignment](#64-caregiver-assignment)
   - 6.5 [Caregiver Page (BUILD fully)](#65-caregiver-page-build-fully)
7. [Core Features](#7-core-features)
   - 7.1 [Multi-Source Data Collection](#71-multi-source-data-collection)
   - 7.2 [Alert Engine](#72-alert-engine)
   - 7.3 [SOS Emergency Pipeline](#73-sos-emergency-pipeline)
   - 7.4 [Data Quality and Monitoring Continuity](#74-data-quality-and-monitoring-continuity)
   - 7.5 [Audit Trail](#75-audit-trail)
8. [Advanced Features & AI Intelligence Layer](#8-advanced-features--ai-intelligence-layer)
   - 8.1 [Health Score (0–100)](#81-health-score-0100)
   - 8.2 [Daily Care Tips](#82-daily-care-tips)
   - 8.3 [AI Layer & Deterministic Fallback Engine (Dual-Engine Architecture)](#83-ai-layer--deterministic-fallback-engine-dual-engine-architecture)
   - 8.3a [Live LLM Integration — End-to-End Walkthrough](#83a-live-llm-integration--end-to-end-walkthrough)
   - 8.4 [Threshold Sandbox Preview](#84-threshold-sandbox-preview)
9. [Datasets and Data Strategy](#9-datasets-and-data-strategy)
   - 9.1 [Role of Data](#91-role-of-data)
   - 9.2 [Primary Data Source: Dynamic Simulator](#92-primary-data-source-dynamic-simulator)
   - 9.3 [Secondary Data Source: Synthetic Patient HealthCare Monitoring Dataset](#93-secondary-data-source-synthetic-patient-healthcare-monitoring-dataset)
   - 9.4 [Dataset Replayer Logic](#94-dataset-replayer-logic)
   - 9.5 [Source Switching](#95-source-switching)
   - 9.6 [Data Handling Rules](#96-data-handling-rules)
10. [Database Design](#10-database-design)
11. [API Design](#11-api-design)
    - 11.1 [REST Endpoints](#111-rest-endpoints)
    - 11.2 [WebSocket Channel](#112-websocket-channel)
12. [Notification and Alert Routing](#12-notification-and-alert-routing)
    - 12.1 [Routing Table](#121-routing-table)
    - 12.2 [Channels](#122-channels)
    - 12.3 [Notification Record](#123-notification-record)
13. [Medicine Reminders](#13-medicine-reminders)
    - 13.1 [Reminder Workflow](#131-reminder-workflow)
    - 13.2 [Medicine Log](#132-medicine-log)
    - 13.3 [Demo Helper](#133-demo-helper)
14. [Dashboard Design: Two Specialized Dashboards](#14-dashboard-design-two-specialized-dashboards)
    - 14.1 [Persistent Disclaimer](#141-persistent-disclaimer)
    - 14.2 [Caregiver Dashboard (Clinical-Telemetry UI)](#142-caregiver-dashboard-clinical-telemetry-ui)
    - 14.3 [Patient Dashboard / Screen (Elderly-Centric UI)](#143-patient-dashboard--screen-elderly-centric-ui)
    - 14.4 [Family View (read-only)](#144-family-view-read-only)
    - 14.5 [Admin View](#145-admin-view)
15. [Privacy and Security](#15-privacy-and-security)
16. [Evaluation Page](#16-evaluation-page)
17. [Testing and Evaluation](#17-testing-and-evaluation)
18. [Implementation Roadmap](#18-implementation-roadmap)
19. [Scope and Limitations](#19-scope-and-limitations)
20. [Deliverables](#20-deliverables)
21. [Differentiators](#21-differentiators)
22. [Additional Features (Future Roadmap)](#22-additional-features-future-roadmap)

---

## 1. Overview

### 1.1 Problem

Elderly people and individuals who need regular health monitoring may not receive timely help when their vital signs become abnormal or when they need emergency assistance. Periodic manual checks, limited caregiver availability, and poor family communication leave dangerous gaps in monitoring and delay emergency responses. Family members far from the patient have no visibility into daily health status or missed medicines.

### 1.2 Solution

SmartCare is an affordable, software-first platform that connects five things in one workflow:

1. **Vital-sign monitoring** — heart rate, body temperature, SpO2, and blood pressure (dynamically simulated by default, optionally replayed from a Kaggle dataset, or manually entered).
2. **Alert generation & false-alarm suppression** — configurable threshold profiles per patient condition, trend checks, false-alarm persistence filtering, and SOS emergency pipeline.
3. **Dual login dashboards** — distinct user dashboards tailored for either the **Patient** (large SOS button, daily check-in, calm simplified vitals, and medication checklists) or the **Caregiver** (multi-patient telemetry, live sparklines, alert queue with Acknowledge/Resolve notes, care-task checklists, and shift handover notes).
4. **Caregiver coordination & family connectivity** — a structured caregiver module with assignment, shifts, care tasks, handover notes, mandatory family contact registration, direct alerts on Critical/SOS, masked numbers, and a family read-only view.
5. **Emergency escalation & AI insights** — Telegram + simulated SMS to caregiver and family simultaneously on Critical alerts, with automatic escalation to secondary contacts if unacknowledged, plus a three-tier AI summarizer (Groq → Gemini → local heuristics) backed by a guaranteed offline fallback.

The prototype runs entirely on a standard laptop with zero required hardware. Its architecture is designed so that an ESP32 device with real sensors can be added later without redesigning the backend or ingestion pipelines.

### 1.3 Objectives

1. Build an affordable monitoring prototype that works fully in software at ₹0 cost.
2. Display HR (BPM), body temperature (°C), SpO2 (%), and blood pressure (mmHg) with 1-second live updates.
3. Provide two distinct login dashboards tailored to Patient and Caregiver needs.
4. Support per-patient condition-based threshold profiles, editable live with client-side sandbox previews.
5. Detect threshold breaches, trend spikes, stale data, and device disconnections.
6. Provide a caregiver dashboard for monitoring assigned patients with care-task checklists and shift handover notes.
7. Support mandatory family contact registration with phone verification (simulated).
8. Route alerts to the right people: caregiver for Warning, caregiver + family for Critical/SOS.
9. Demonstrate Telegram notifications, acknowledgment timeouts, and escalation to a second family contact.
10. Support medicine reminders with Taken/Missed tracking and auditory voice prompts.
11. Show a Health Score (0–100) per patient with complete formula transparency.
12. Integrate an AI Layer (three-tier: Groq API primary → Google Gemini secondary → local heuristics fallback) for 24-hour plain-language summaries and care tips with strict non-diagnostic guardrails.
13. Integrate an offline Deterministic Fallback Layer (CareBeat Clinical Heuristics v1.2) ensuring zero crashes and zero latency when both external AI APIs are unavailable.
14. Provide a Caregiver Module with profile, verification (mocked), fee negotiation (mocked), and max-2 patient cohort assignment.
15. Provide dedicated Simulated WhatsApp Emergency Broadcast & Caregiver communication with masked phone numbers (`+91 9XXXXXX10`).
16. Keep a full append-only audit trail of readings, alerts, notifications, contact changes, and caregiver actions.
17. Show an Evaluation/Metrics page for hackathon judges (`eval_test.py`).
18. Deploy full-stack frontend and backend unified under a single live Vercel URL (`https://carebeat-health-monitor.vercel.app`).
19. Clearly communicate that the system is a monitoring prototype and not a medical diagnostic tool.

---

## 2. Technology Stack & Deployment Architecture

**Live Production URL (Unified Vercel):** [https://carebeat-health-monitor.vercel.app](https://carebeat-health-monitor.vercel.app)

| Layer | Technology | Purpose & Justification |
|---|---|---|
| **Production Cloud Hosting** | **Vercel Serverless Architecture** | Hosts both frontend and backend synchronously under a single domain via `vercel.json` (`@vercel/python` builder, root static rewrites, `/tmp` SQLite bridge). Zero-cost cloud uptime. |
| **Backend Framework** | **Python 3.11+ with FastAPI** | High-performance asynchronous REST API and native WebSocket server for sub-second telemetry ingestion and dispatch. |
| **Database** | **SQLite (WAL Mode)** | Relational database with ACID compliance, zero setup, indexed queries, and append-only audit trail logging. Auto-synced to `/tmp/carebeat.db` on serverless runs. |
| **Frontend Architecture** | **Plain HTML5 / CSS3 / Vanilla JS (ES6+)** | Clean, responsive single-page application. Zero build step (no npm/Node.js required), runs natively in modern web browsers. |
| **Data Visualization** | **Chart.js via CDN** | Lightweight hardware-accelerated canvas charts for real-time sparklines, waveform trends, and threshold limit overlays. |
| **Real-Time Communication** | **FastAPI WebSocket (`/ws`) + Cloud Polling Fallback** | Bi-directional channel streaming vitals every second and synchronizing alert states across dashboards, with sub-second polling fallback on serverless. |
| **Emergency Alerts & Messaging** | **Simulated WhatsApp & SMS Mockup Panels** | Dedicated WhatsApp alerts channel with strict phone masking (`+91 9XXXXXX10`), interactive two-way messaging, Telegram Bot API adapter, and SMS panel. |
| **Primary LLM (AI Tier 1)** | **Groq API — `openai/gpt-oss-20b`** | Primary AI engine for 24-hour caregiver briefings. OpenAI-compatible REST endpoint backed by Groq's custom LPU hardware for sub-second inference. Free tier available at [groq.com](https://groq.com). |
| **Secondary LLM (AI Tier 2)** | **Google Gemini API — `gemini-1.5-flash`** | Secondary AI fallback for summaries if Groq key is unavailable or the call fails. Google Generative AI REST API. |
| **AI Fallback Engine (Tier 3)** | **CareBeat Local Clinical Heuristics v1.2** | 100% offline rule-based statistical summarizer in `ai_service.py`. Guarantees a response with zero latency when both external LLMs are unavailable. |
| **HTTP Client (AI calls)** | **httpx (async)** | Async HTTP client used for both Groq and Gemini API calls with a 10-second timeout and graceful degradation to the next tier. |
| **Simulation and Replay** | **Python (`random`, `math`, `csv`)** | Built-in Gaussian drift generator (`simulator.py`) and Kaggle dataset replayer (60,000 records) with instant anomaly triggers. |
| **IoT & Hardware Ingestion** | **HTTP REST / JSON (`POST /measurements`)** | Device-independent schema compatible with ESP32 Wi-Fi microcontrollers, dynamic simulators, and dataset replayers. |
| **Auditory & Voice Alerts** | **Browser SpeechSynthesis API** | Spoken vital readouts ("Read Vitals Aloud"), audible emergency sirens, and scheduled medication reminders. |
| **Configuration** | **`config.json` / Environment Variables** | All secrets, API keys, and configurable threshold defaults isolated from source code. |

**Why this stack:** Zero runtime cost, zero build step, deploys to any cloud platform in seconds, exceptionally easy to demo and evaluate. The Python FastAPI backend handles business rules and telemetry ingestion; the browser frontend is delivered seamlessly from the same origin.

---

## 3. System Architecture

```
[Dynamic Simulator]  [Dataset Replayer]  [Manual Form]  [Patient SOS]  [Future ESP32]
         \                  |                  |               |              /
          +-------------- Data Input Layer: POST /measurements ---------------+
                                               |
                                     FastAPI Backend Core
                                               |
        +-------------------+------------------+-------------------+
        |                   |                  |                   |
   Sanity & Range     False-Alarm        Threshold Rules     AI Summarizer
   Quarantine Filter  Window (5s)        & Escalation Engine (Groq→Gemini→Heuristics)
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

### 3.1 Data Input Layer

Accepts data from five sources and normalizes everything to one standard JSON format:

```json
{
  "patient_id": "p1",
  "heart_rate": 84,
  "temperature": 36.7,
  "spo2": 97,
  "systolic_bp": 120,
  "diastolic_bp": 80,
  "timestamp": "2026-10-12T12:35:00",
  "source": "simulator"
}
```

Sources:
- **Dynamic simulator (default):** generates realistic vital-sign readings every second for 4 demo patients using math-based noise and baseline drift. Supports API-triggered anomalies for instant demo scenarios. Starts automatically on app launch.
- **Dataset replayer (optional):** reads the Kaggle CSV from repository root, replays one row per second, loops when file ends. Switch to this source from the dashboard or simulator page.
- **Manual entry form:** caregiver or family enters a value from a physical device.
- **SOS / check-in:** patient-initiated events that bypass vital checks.
- **Hardware ESP32 node (future ready):** posts the exact same schema over Wi-Fi (`firmware/esp32_example.ino`).

### 3.2 Backend and API Layer

FastAPI exposes REST endpoints for patients, caregivers, measurements, thresholds, alerts, medicines, notifications, AI summaries, and audit records. A unified WebSocket at `/ws` broadcasts live readings and alert state changes to all connected dashboards.

### 3.3 Alert and Rules Engine

Validates each reading, checks condition-based threshold profiles, evaluates trend rules, applies false-alarm filtering (N consecutive seconds), and produces explainable alert events with deterministic routing decisions.

### 3.4 Caregiver Module

Manages caregiver profiles, skill matching, shift assignment, verification status (mocked), fee negotiation (mocked), care task checklists, handover notes, and daily care logs.

### 3.5 Notification Router

Routes alerts to the correct recipients based on alert severity and patient configuration. Delivers via Telegram Bot API (real or simulated), simulated SMS (Family phone panel), and in-app siren banners. Records every attempt.

### 3.6 Database Layer

SQLite with append-only audit, measurement, and alert records. All tables listed in Section 10.

### 3.7 Frontend & Dual-Dashboard Architecture

A single `static/index.html` served by FastAPI. Two primary specialized dashboards are available directly upon login/role selection:
- **Patient Dashboard:** Tailored for elderly patients (high-contrast, giant buttons, SOS, "I'm OK", simple vitals, medication cards).
- **Caregiver Dashboard:** Tailored for caregivers (telemetry cards, live charts, alert queue, threshold sandbox, care tasks, shift handovers).
- Additional specialized views: **Family View** (read-only) and **Admin View** (verification and audit).

---

## 4. How the Application Works

### 4.1 End-to-End Workflow

1. **Seed:** Run `python seed.py` to create 4 demo patients, 2 caregivers, 1 admin, family contacts, and medicines.
2. **Start:** `uvicorn main:app` then open `http://localhost:8000` in the browser.
3. **Select Dashboard / Role:** Choose either **Patient Dashboard** or **Caregiver Dashboard** (or Family / Admin).
4. **Data arrives:** dynamic simulator sends readings every second per patient via WebSocket by default. Optionally switch to CSV dataset replay from the dashboard.
5. **Validation:** impossible values (HR 0 or >250, Temp >45 or <30) are marked "sensor error" and quarantined.
6. **False-alarm filter:** a value must stay beyond a threshold for N consecutive seconds (default 5) before an alert fires.
7. **Alert fires:** explainable alert created, notification router decides recipients.
8. **Notification:** Telegram + simulated SMS to caregiver (Warning) or caregiver + family (Critical/SOS). Siren banner + voice alert on dashboard.
9. **Acknowledgment:** caregiver presses Acknowledge, siren stops, timestamp recorded.
10. **Escalation:** if unacknowledged within N seconds (default 120), second family contact notified, alert labelled "Escalated".
11. **Resolution:** caregiver marks resolved with care notes, history preserved.
12. **Medicine reminders:** fire at scheduled times; Taken/Missed tracked; family notified if missed >30 min.
13. **AI / Fallback summary:** Generates 24h summary via Groq API (primary) → Gemini API (secondary) → local heuristic rule engine (final fallback). Always returns a non-diagnostic response regardless of API availability.
14. **Review:** Metrics page shows latency, alert counts, medicine adherence, uptime.

### 4.2 Alert States

| State | Meaning |
|---|---|
| **Normal** | All vitals within configured thresholds |
| **Warning** | A reading is outside the warning limit |
| **Critical** | A reading crosses the critical limit, or SOS pressed |
| **Acknowledged** | A caregiver confirmed awareness; siren stopped |
| **Escalated** | Timeout expired; second family contact notified |
| **Resolved** | Caregiver recorded the event as addressed with care notes |

### 4.3 Alert Routing by Severity

| Severity | Recipients |
|---|---|
| Warning | Assigned caregiver only; if no caregiver, family contact |
| Critical / SOS | Assigned caregiver AND primary family contact simultaneously |
| Unacknowledged (timeout) | Second family contact; label changed to "Escalated" |
| Device offline | Assigned caregiver AND family contact |
| Missed medicine (>30 min) | Family contact |
| Missed check-in | Assigned caregiver |

---

## 5. Patient Registration and Family Contact

### 5.1 Registration Form

The patient registration form collects:
- **Name and age**
- **Condition tags:** high BP, heart patient, diabetic, none (selects a default threshold profile)
- **Care-needs tags:** medicine help, mobility help, diet help, night monitoring
- **Consent checkbox:** "The patient/family agrees to receive and share health alerts" — submit blocked without this
- **Medicines:** name, scheduled times, notes (no dosage advice from the system)
- **Family contact (mandatory):** name, relation, phone number — submit blocked without a valid phone number
- **Second family contact (optional):** used for escalation

### 5.2 Family Contact Rules

- **Phone verification:** after registration, a Verify button sends a test message (Telegram or simulated SMS). A "Not verified" badge shows until confirmed.
- **Masked display:** phone numbers shown as `+91 98XXXXXX21` everywhere in the UI.
- **Edit restriction:** only family members or admin can edit contact details.
- **Audit log:** every contact change is recorded (who changed it, old value masked, timestamp).
- **Alert lookup:** notifications look up recipients by patient_id, not hardcoded.

### 5.3 Condition-Based Threshold Profiles

| Profile | HR Warning | HR Critical | Temp Warning | Temp Critical | SpO2 Warning | SpO2 Critical |
|---|---|---|---|---|---|---|
| Default elderly | >110 or <50 | >130 or <40 | >37.8°C | >39°C | <94% | <90% |
| Heart patient | >100 | >120 | >38°C | >38.5°C | <94% | <90% |
| Diabetic | >110 or <50 | >130 or <40 | >37.8°C | >39°C | <94% | <90% |
| High BP | >110 or <50 | >130 or <40 | >37.8°C | >39°C | <94% | <90% |
| Custom | Family/doctor entered | — | — | — | — | — |

All thresholds are labelled **"Editable defaults, not medical advice"**. They are editable live in a settings panel and take effect from the next reading.

---

## 6. Caregiver Module

### 6.1 Caregiver Profile

Each caregiver has:
- Name, phone number, skills (matching care-needs tags: medicine, mobility, diet, night monitoring)
- Shift preferences and availability
- Experience and expected fee range
- Verification status badge (Pending / Verified / Rejected / Expired)

### 6.2 Verification (MOCK)

- Caregiver "uploads" a verification document via a form field.
- The Admin screen lists pending caregivers and allows marking Verified / Rejected with an expiry date.
- Only Verified caregivers appear in assignment suggestions.
- The document is visible only to the admin.
- The UI and README clearly state: **"This is a manual document review, not a connection to any police database."**

### 6.3 Fee Negotiation (MOCK)

- Family sends a request: proposed fee, shift, and duties.
- Caregiver can Accept, Counter, or Decline.
- Statuses: Requested → Negotiating → Agreed / Declined.
- Every offer is logged with a timestamp.
- Assignment is enabled only when status is Agreed.
- Agreed fee, shift, and start date are saved to the assignment record.
- No payment handling of any kind.

### 6.4 Caregiver Assignment

- The system suggests verified caregivers whose skills match the patient's care-needs tags.
- A patient with no care needs can be self-monitored with only a family contact (no caregiver required).
- Multiple caregivers may be assigned to different shifts; the family contact stays fixed regardless.

### 6.5 Caregiver Page (BUILD fully)

The caregiver's dashboard shows:
- **Assigned patients list:** live HR, Temp, SpO2, status colour (green/yellow/red), and Health Score per patient.
- **Alerts panel:** active alerts for assigned patients with Acknowledge button and a quick-note field.
- **Care-task checklist per patient:** generated from care-needs tags:
  - Medicine given, meal served, fluids offered, walk/exercise assisted, manual vitals checked.
  - Each task has a due time; overdue tasks show a "Missed" badge visible to both caregiver and family.
- **Manual reading form:** caregiver can enter a reading from a physical device.
- **Daily care log:** free-text notes per patient per day.
- **Shift handover note:** a structured note (condition on arrival, tasks completed, concerns) visible to the next shift caregiver.
- **One-tap contact links:** call or WhatsApp link pre-filled with patient name and latest vitals to reach the family.

---

## 7. Core Features

### 7.1 Multi-Source Data Collection

- **Dynamic simulator (default):** generates realistic readings every second for 4 demo patients. Uses math-based noise and drift around a configurable baseline. Produces different data every run. Starts automatically on app launch — no CSV required.
- **API-triggered anomalies:** `/trigger/tachycardia`, `/trigger/fever`, `/trigger/low_spo2` inject an immediate anomaly into the simulator stream for instant demo scenarios.
- **Dataset replay (optional):** Kaggle CSV replayed at 1 row/sec; loops when file ends. Switch to this source from the dashboard or simulator page.
- **Manual entry:** caregiver enters a value from a physical device; stored with `source: manual`.
- **Simulate Emergency button:** overrides simulator readings for 30 seconds to guarantee a Critical alert during a demo.
- **SOS button:** large button on the patient screen; fires an immediate Critical alert regardless of vitals.
- **"I'm OK" check-in:** large button on the patient screen; missed check-in within a configurable period alerts the caregiver.

Source label is shown on every reading: `simulator`, `dataset-replay`, `manual`, `sos`, `check-in`.

### 7.2 Alert Engine

**False-alarm filter:** a value must stay beyond a threshold for N consecutive seconds (default 5) before an alert fires. Impossible values (HR 0 or >250, Temp >45 or <30) are marked "sensor error" and quarantined, not alerted. A cooldown prevents the same alert from repeating every second.

**Trend check:** if HR rises more than 25 BPM within 30 seconds, a Warning fires even if thresholds are not crossed.

**Device offline:** if no reading arrives for 2 minutes (configurable), a "Device offline" alert fires.

**Every alert includes a plain-language explanation:**
> "Heart rate critical: latest reading is 135 BPM, above the configured critical limit of 130 BPM for this patient's heart patient profile."

### 7.3 SOS Emergency Pipeline

Pressing the SOS button:
1. Creates an immediate Critical alert, bypassing all threshold checks and false-alarm filters.
2. Triggers a siren banner and browser voice alert.
3. Sends Telegram to assigned caregiver and primary family contact simultaneously.
4. Starts the escalation countdown.
5. Remains active until Acknowledged and then Resolved.

### 7.4 Data Quality and Monitoring Continuity

- Invalid values (sensor error range) are quarantined with a reason label, not displayed as vitals.
- If no reading arrives for >15 seconds, the patient card shows "No recent data" in grey — never the last reading as if it were current.
- Device offline detection at 2 minutes.
- Data-quality warnings are kept visually separate from health alerts.

### 7.5 Audit Trail

Persists: readings with source, threshold changes with version, alerts with explanations and routing, SOS events, caregiver actions and notes, notification attempts and outcomes, escalations, contact changes, medicine logs, data-quality warnings, and device-offline events. All audit records are append-only; history is never deleted.

---

## 8. Advanced Features & AI Intelligence Layer

### 8.1 Health Score (0–100)

A rule-based score calculated per patient per day:

| Component | Weight |
|---|---|
| Vitals within normal range (last hour) | 50 pts |
| No Critical alerts in last 24 hours | 20 pts |
| Medicines taken on time | 20 pts |
| "I'm OK" check-in completed | 10 pts |

The score and its breakdown are shown in a tooltip on every patient card. The tooltip includes: **"This score reflects configured-limit compliance only. It is not a clinical health assessment."**

If a specific vital is dragging the score down, that is shown explicitly (e.g., "SpO2 low: −20 pts").

### 8.2 Daily Care Tips

A "Daily care tips" card per patient generated from condition tags and current vitals:
- High BP: low-salt meals, avoid caffeine, stay calm.
- Diabetic: fewer sweets, regular meal times, monitor energy levels.
- Fever (Temp >37.8): extra fluids, light food, rest.
- Heart patient: gentle activity, no strenuous effort, regular rest.

Rules: no calorie targets, no medicine or dosage advice. Every tips card carries: **"General wellness suggestions only, not medical or dietary advice."**

### 8.3 AI Layer — Three-Tier LLM Architecture

SmartCare's AI layer (`ai_service.py`) uses a **three-tier resolution chain** to guarantee a summary is always generated — whether or not external API keys are configured. The chain resolves top-to-bottom and stops at the first successful response.

```
[24-Hour Patient Telemetry + Alert Logs + Medicine Adherence]
                          |
                          v
            ┌─────────────────────────┐
            │  Tier 1: Groq API       │  ← Primary LLM
            │  openai/gpt-oss-20b   │    Ultra-fast LPU inference
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
            │  v1.2                   │    Zero latency, always runs
            └─────────────────────────┘
```

#### Where AI is used in the product

| Feature | Location in UI | AI involvement |
|---|---|---|
| **24-Hour Health Briefing** | Caregiver Dashboard → AI Insights tab | Groq/Gemini generates 2–3 sentence plain-language summary of vitals, alerts, and medicine adherence over the past 24 hours |
| **Daily Caregiver Tips** | Caregiver Dashboard → AI Insights tab | Local heuristic engine generates condition-aware wellness suggestions (cardiac, hypertension, diabetic profiles) — no external API call |
| **Threshold Sandbox Analysis** | Caregiver Dashboard → AI Insights tab | Deterministic local engine computes historical breach impact when thresholds are modified |
| **Emergency Alert Generation** | All views (siren banner, alert queue) | **AI is never involved** — all alerts are 100% deterministic threshold rules |

#### Tier 1: Groq API (Primary LLM)

[Groq](https://groq.com) provides an OpenAI-compatible REST API backed by custom LPU (Language Processing Unit) hardware, delivering sub-second inference. The `openai/gpt-oss-20b` model is available on Groq's free tier.

- **Endpoint:** `POST https://api.groq.com/openai/v1/chat/completions`
- **Format:** OpenAI-compatible `messages` array with `system` + `user` roles
- **Default model:** `openai/gpt-oss-20b` (configurable via `GROQ_MODEL` in `config.json`)
- **Timeout:** 10 seconds; on failure, cascades to Tier 2

```python
# ai_service.py — Groq API call
payload = {
    "model": "openai/gpt-oss-20b",
    "messages": [
        {"role": "system", "content": "<strict non-diagnostic system prompt>"},
        {"role": "user",   "content": "<24h patient vitals context>"}
    ],
    "temperature": 0.2,
    "max_tokens": 220
}
headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
resp = await client.post("https://api.groq.com/openai/v1/chat/completions",
                         json=payload, headers=headers)
```

#### Tier 2: Google Gemini API (Secondary LLM)

Called only if the Groq key is missing or the Groq call fails. Uses the `gemini-1.5-flash` model via the Google Generative Language REST API.

- **Endpoint:** `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=...`
- **Format:** Gemini `contents` / `parts` structure
- **Timeout:** 10 seconds; on failure, cascades to Tier 3

#### Tier 3: CareBeat Local Clinical Heuristics v1.2 (Final Fallback)

Always-on rule engine — never fails, no network call, zero latency. Aggregates min/max/average statistics directly from SQLite and composes a structured plain-language summary from deterministic templates.

Example output: *"Heart rate averaged 75 BPM and remained within configured limits. Oxygen saturation maintained strong levels averaging 97%. No critical threshold breaches were detected during the monitored period."*

#### Strict Non-Diagnostic Guardrails

All three tiers enforce the same safety boundary via system prompts and code design:
- ✅ Generates concise plain-language 24-hour caregiver briefings
- ✅ Provides contextual wellness suggestions tailored to patient condition profiles
- ✅ Degrades gracefully through three tiers — always returns a response
- ❌ Does **not** diagnose disease, suggest treatments, or recommend dosages
- ❌ Does **not** generate or influence life-critical alerts — those are hardcoded rules

#### Safety Invariant

> **Life-critical alert generation, threshold evaluation, false-alarm suppression, siren activation, and emergency notifications NEVER depend on AI.** The entire alert engine, escalation logic, and SOS pipeline are deterministic and run without any external API dependency.

#### Configuration

| Config key | Default | Description |
|---|---|---|
| `GROQ_API_KEY` | `""` | Groq Cloud API key. Free tier at [console.groq.com](https://console.groq.com). |
| `GROQ_MODEL` | `openai/gpt-oss-20b` | Groq model. Alternatives: `openai/gpt-oss-120b`, `qwen/qwen3.8-27b`. |
| `GEMINI_API_KEY` | `""` | Google Gemini API key. Used only if Groq is unavailable. |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Gemini model ID. |

If neither `GROQ_API_KEY` nor `GEMINI_API_KEY` is set, the system runs entirely on the local heuristics engine with no configuration required and no degradation in core functionality.

### 8.3a Live LLM Integration — End-to-End Walkthrough

This section documents exactly what happens in the live website when a real Groq API key is configured and a caregiver clicks "Generate Summary".

#### What the user sees in the caregiver dashboard

1. Log in as a caregiver and select a patient. Navigate to the **AI Insights & Thresholds** tab.
2. Click **"Generate Summary"** in the "24-Hour AI Health Briefing" card.
3. The UI displays: *"Generating 24-hour summary via AI layer..."*
4. Within 1–2 seconds, the briefing appears — 2–3 plain-language sentences covering vitals trends, alert counts, and medication adherence for the last 24 hours.
5. The **AI Source Badge** updates to reflect which tier responded:

| Badge colour | Text | Meaning |
|---|---|---|
| 🟠 Orange gradient | `Groq AI (openai/gpt-oss-20b)` | Tier 1 live API responded successfully |
| 🔵 Blue/green gradient | `Gemini AI (gemini-1.5-flash)` | Tier 2 Gemini fallback used |
| ⚪ Default grey | `Clinical Heuristics (Offline)` | No API keys — Tier 3 local engine used |

#### How the GROQ_API_KEY reaches the backend

Keys are loaded at server startup in priority order:

```
1. .env.local    ← GROQ_API_KEY=gsk_...   (local development, never committed)
2. config.json   ← "GROQ_API_KEY": "gsk_..."  (Vercel environment / alternative)
```

Both `main.py` and `ai_service.py` call `load_dotenv` at module import time:

```python
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env.local", override=False)  # picks up local dev key
load_dotenv(dotenv_path=".env",       override=False)  # production fallback
```

`ai_service.py` then reads the key with `os.environ.get("GROQ_API_KEY")`, falling back to `config.json` if the env var is not set.

#### Backend resolution chain for GET /patients/{id}/summary

```
Browser  →  GET /patients/p1/summary
                    │
            [FastAPI — main.py]
                    │
            [ai_service.generate_patient_summary("p1")]
                    │
        ┌───────────┴───────────┐
        │  SQLite (carebeat.db)  │  ← last 24h: measurements, alerts, medicine_logs
        └───────────┬───────────┘
                    │ computes avg/min/max HR, Temp, SpO₂; counts alerts + missed meds
                    │
        [Tier 1] GROQ_API_KEY present?
                YES  →  POST https://api.groq.com/openai/v1/chat/completions
                         model: openai/gpt-oss-20b
                         temperature: 0.2, max_tokens: 220
                         ← { source: "groq-api", summary: "..." }
                         STOP
                │
        [Tier 2] Key missing or call failed?
                GEMINI_API_KEY present?
                YES  →  POST https://generativelanguage.googleapis.com/...
                         ← { source: "gemini-api", summary: "..." }
                         STOP
                │
        [Tier 3] Both unavailable?
                →  _generate_local_heuristic_summary()
                   ← { source: "local-rule-engine", summary: "..." }
```

The response JSON always contains: `patient_id`, `summary`, `source`, `model`, `timestamp`, `disclaimer`.

#### Frontend badge logic (app.js)

```js
if (data.source === 'groq-api') {
    badge.textContent = `Groq AI (${data.model})`;
    badge.style.background = 'linear-gradient(90deg,#f55036,#f97316)';
} else if (data.source === 'gemini-api') {
    badge.textContent = `Gemini AI (${data.model})`;
    badge.style.background = 'linear-gradient(90deg,#4285f4,#34a853)';
} else {
    badge.textContent = 'Clinical Heuristics (Offline)';
}
```

#### Setting up Groq for local development

```bash
# 1. Get a free key at https://console.groq.com
# 2. Create .env.local (already in .gitignore)
echo 'GROQ_API_KEY=gsk_your_key_here' >> .env.local

# 3. Start the server — dotenv loads the key automatically
uvicorn main:app --reload
```

No other configuration is needed. `.env.local` is already in `.gitignore`.



### 8.4 Threshold Sandbox Preview

When editing thresholds, a live preview shows how many alerts the proposed settings would have triggered against the last hour of stored readings, before saving. The preview runs client-side on cached history for instant feedback. Changes take effect only on Save.

---

## 9. Datasets and Data Strategy

### 9.1 Role of Data

CareBeat is a rules-based system, not a machine-learning model. The dynamic simulator is the primary and default data source — it generates realistic readings on the fly, requires no files, and supports instant demo scenarios. The Kaggle CSV dataset is available as a secondary source for realistic replay and threshold testing but is not required for the system to run.

### 9.2 Primary Data Source: Dynamic Simulator

The simulator generates readings every second per patient using math-based noise and configurable baselines. It is the default on app start.

#### Simulator Behavior

| Patient | Baseline HR | Baseline Temp | Baseline SpO2 | Condition tag |
|---|---|---|---|---|
| Demo Patient A | 75 BPM | 36.6°C | 98% | heart patient |
| Demo Patient B | 80 BPM | 36.8°C | 97% | high BP |
| Demo Patient C | 72 BPM | 37.0°C | 96% | diabetic |
| Demo Patient D | 70 BPM | 36.5°C | 98% | none (healthy elderly) |

#### Simulator Logic

```python
import math, random
from datetime import datetime

def generate_reading(patient_id: str, baseline: dict, t: float) -> dict:
    hr  = baseline["hr"]  + 5 * math.sin(t / 30) + random.gauss(0, 2)
    temp = baseline["temp"] + 0.1 * math.sin(t / 60) + random.gauss(0, 0.08)
    spo2 = baseline["spo2"] + random.gauss(0, 0.5)
    return {
        "patient_id": patient_id,
        "heart_rate": round(hr),
        "temperature": round(temp, 1),
        "spo2": round(spo2),
        "timestamp": datetime.now().isoformat(),
        "source": "simulator"
    }
```

#### API-Triggered Anomalies

| Endpoint | Effect | Duration |
|---|---|---|
| `POST /trigger/tachycardia` | HR jumps to 130–145 BPM | 30 seconds |
| `POST /trigger/fever` | Temp rises to 38.5–39.2°C | 60 seconds |
| `POST /trigger/low_spo2` | SpO2 drops to 85–89% | 30 seconds |
| `POST /simulate/emergency` | All vitals go critical simultaneously | 30 seconds |

After the trigger duration, readings return to the normal baseline. This guarantees a demo-ready alert fires within 5 seconds (false-alarm filter default).

### 9.3 Secondary Data Source: Synthetic Patient HealthCare Monitoring Dataset

Available as an optional source. The repository includes `Synthetic_patient-HealthCare-Monitoring_dataset.csv` — 60,000 records across 13 columns.

#### Dataset Schema

| Column | Type | Range | Notes |
|---|---|---|---|
| `Patient Number` | Integer | 1–60,000 | Used to assign rows to demo patients in blocks |
| `Heart Rate (bpm)` | Integer | 50–139 | Mapped to `heart_rate` |
| `SpO2 Level (%)` | Integer | 84–100 | Mapped to `spo2` |
| `Systolic Blood Pressure (mmHg)` | Integer | 90–199 | Stored as additional vital |
| `Diastolic Blood Pressure (mmHg)` | Integer | 50–129 | Stored as additional vital |
| `Body Temperature (°C)` | Float | 35.0–39.3 | Mapped to `temperature` |
| `Fall Detection` | String | Yes / No | `Yes` triggers an immediate Critical alert (SOS pipeline) |
| `Predicted Disease` | String | 5 cohorts | Used internally to assign condition tags to demo patients; never shown as a diagnosis |
| `Data Accuracy (%)` | Integer | 85–100 | Used as signal quality badge (<90% shows "Low Signal") |
| `Heart Rate Alert` | String | NORMAL / ABNORMAL | Ground-truth for automated test validation |
| `SpO2 Level Alert` | String | NORMAL / ABNORMAL | Ground-truth |
| `Blood Pressure Alert` | String | NORMAL / ABNORMAL | Ground-truth |
| `Temperature Alert` | String | NORMAL / ABNORMAL | Ground-truth |

#### Column Mapping (`config.json`)

```json
"column_mapping": {
  "heart_rate": "Heart Rate (bpm)",
  "spo2": "SpO2 Level (%)",
  "temperature": "Body Temperature (°C)",
  "fall_detection": "Fall Detection",
  "data_accuracy": "Data Accuracy (%)",
  "disease_label": "Predicted Disease"
}
```

#### Clinical Cohorts (for Demo Profiles)

| Cohort | Records | Key characteristic | Assigned condition tag |
|---|---|---|---|
| Healthy | 11,973 | All vitals normal | none |
| Heart Disease | 12,044 | Tachycardia, elevated BP | heart patient |
| Hypertension | 11,928 | 100% abnormal BP alerts | high BP |
| Asthma | 11,888 | SpO2 mean 89.2% | (add SpO2 threshold) |
| Diabetes Mellitus | 12,167 | Elevated temperature | diabetic |
| Fall incidents | 3,074 | Fall Detection = Yes | → auto Critical SOS alert |

### 9.4 Dataset Replayer Logic

1. Read the CSV row by row at 1 row/sec.
2. Map columns via `config.json`.
3. If temperature or SpO2 is missing, fill with a realistic simulated value and label it `"simulated"` in the UI.
4. If `Fall Detection` = Yes, inject a SOS-type Critical alert immediately.
5. Assign blocks of rows to demo patients (e.g., rows 1–15,000 → patient p1, etc.).
6. Loop the file when it ends.

### 9.5 Source Switching

The active data source can be switched at runtime without restarting the server:

| Endpoint | Action |
|---|---|
| `GET /demo/source` | Returns current active source (`simulator` or `dataset-replay`) |
| `POST /demo/source` | Switches source. Body: `{"source": "simulator"}` or `{"source": "dataset-replay"}` |

The dashboard also exposes a **Source** toggle button. Switching source mid-session labels the transition point on the chart ("Replay started" or "Simulator started") so the change is always visible.

### 9.6 Data Handling Rules

- Label every reading with its source: `simulator`, `dataset-replay`, `manual`.
- Never present replayed or simulated data as a patient's own historical baseline.
- Use only `Predicted Disease` internally for condition-tag assignment; never expose it on the dashboard.
- Map replayed rows to fictional demo patient profiles only.

---

## 10. Database Design

| Table | Key fields |
|---|---|
| **patients** | patient_id, name, age, condition_tags, care_needs_tags, consent (bool), consent_timestamp, threshold_profile_id |
| **family_contacts** | contact_id, patient_id, name, relation, phone_masked, verification_status, priority (primary / secondary) |
| **caregivers** | caregiver_id, name, phone, skills, shift, experience, fee_range, verification_status, verification_expiry |
| **caregiver_assignments** | assignment_id, patient_id, caregiver_id, shift, agreed_fee, start_date, status (active/ended) |
| **fee_negotiations** | negotiation_id, patient_id, caregiver_id, proposed_fee, shift, duties, status, timestamp |
| **measurements** | measurement_id, patient_id, heart_rate, temperature, spo2, systolic_bp, diastolic_bp, fall_detected, data_accuracy, timestamp, source, validation_status |
| **threshold_configs** | config_id, patient_id, profile_name, hr_warn_high, hr_warn_low, hr_crit_high, hr_crit_low, temp_warn, temp_crit, spo2_warn, spo2_crit, effective_from, version |
| **alerts** | alert_id, patient_id, measurement_id, alert_type (threshold/trend/sos/offline/checkin/fall), severity, explanation, state, created_at, acknowledged_at, acknowledged_by, resolved_at |
| **caregiver_actions** | action_id, alert_id, caregiver_id, action_type, note, timestamp |
| **notifications** | notification_id, alert_id, patient_id, recipient_id, recipient_type (caregiver/family), channel (telegram/sms/inapp), status, sent_at, ack_at, latency_ms |
| **medicines** | medicine_id, patient_id, name, schedule_times (JSON), notes |
| **medicine_logs** | log_id, medicine_id, patient_id, scheduled_time, status (pending/taken/missed), marked_by, marked_at, note |
| **care_tasks** | task_id, assignment_id, patient_id, task_type, due_time, status (pending/done/missed) |
| **care_logs** | log_id, caregiver_id, patient_id, date, note |
| **handover_notes** | note_id, caregiver_id, patient_id, shift, condition_on_arrival, tasks_completed, concerns, created_at |
| **check_ins** | checkin_id, patient_id, timestamp, status (ok/missed) |
| **audit_events** | event_id, patient_id, event_type, actor, old_value_masked, new_value_masked, timestamp |
| **health_scores** | score_id, patient_id, date, score, vitals_pts, alert_pts, medicine_pts, checkin_pts |

All alert, notification, and audit records are append-only. Resolving an alert updates its state but never deletes the record.

---

## 11. API Design

### 11.1 REST Endpoints

**Patients and Registration**

| Endpoint | Purpose |
|---|---|
| `POST /patients` | Register a new patient (requires consent + family contact) |
| `GET /patients` | List patients visible to the current role |
| `GET /patients/{id}` | Patient detail |
| `PUT /patients/{id}` | Update patient profile |
| `POST /patients/{id}/family-contacts` | Add / update family contact |
| `POST /patients/{id}/verify-contact` | Trigger verification message to family phone |

**Vitals and Alerts**

| Endpoint | Purpose |
|---|---|
| `POST /measurements` | Submit a reading (device-independent ingestion) |
| `GET /patients/{id}/measurements` | Measurement history |
| `GET /patients/{id}/status` | Current vitals and alert state |
| `GET /thresholds/{patient_id}` | Retrieve threshold config |
| `PUT /thresholds/{patient_id}` | Update thresholds (versioned, effective immediately) |
| `GET /alerts` | List alerts (filtered by role) |
| `POST /alerts/{id}/acknowledge` | Acknowledge alert |
| `POST /alerts/{id}/note` | Add a quick note |
| `POST /alerts/{id}/resolve` | Resolve alert with care notes |
| `POST /sos` | Trigger SOS for a patient |
| `POST /checkin` | Record an "I'm OK" check-in |

**Caregivers**

| Endpoint | Purpose |
|---|---|
| `POST /caregivers` | Register caregiver profile |
| `GET /caregivers` | List caregivers (admin: all; family: suggested matches) |
| `POST /caregivers/{id}/upload-doc` | Upload verification document (MOCK) |
| `PUT /caregivers/{id}/verify` | Admin marks Verified/Rejected (MOCK) |
| `POST /fee-negotiations` | Family sends fee request (MOCK) |
| `PUT /fee-negotiations/{id}` | Caregiver responds Accept/Counter/Decline (MOCK) |
| `POST /assignments` | Assign caregiver to patient |
| `GET /assignments/{patient_id}` | Get current assignment |

**Care Tasks and Medicines**

| Endpoint | Purpose |
|---|---|
| `GET /patients/{id}/care-tasks` | Today's care task checklist |
| `PUT /care-tasks/{id}` | Mark task done or missed |
| `GET /patients/{id}/medicines` | Medicine schedule |
| `POST /patients/{id}/medicines` | Add medicine |
| `PUT /medicine-logs/{id}` | Mark taken / missed |
| `GET /patients/{id}/care-log` | Daily care log |
| `POST /patients/{id}/care-log` | Add care log entry |
| `POST /patients/{id}/handover` | Submit handover note |

**Dashboard, AI and Reports**

| Endpoint | Purpose |
|---|---|
| `GET /patients/{id}/health-score` | Current Health Score with breakdown |
| `GET /patients/{id}/summary` | 24h summary (Groq API → Gemini API → local heuristic fallback) |
| `GET /patients/{id}/tips` | Daily care wellness tips |
| `GET /notifications/history` | Notification audit (alert latency, channels) |
| `GET /audit` | Audit records (admin only) |
| `GET /metrics` | Evaluation metrics for judges |
| `GET /reports/export` | CSV export of monitoring telemetry |

**Simulation and Demo Helpers**

| Endpoint | Purpose |
|---|---|
| `POST /simulate/emergency` | Override readings for 30 seconds |
| `POST /trigger/tachycardia` | Inject tachycardia event |
| `POST /trigger/fever` | Inject fever event |
| `POST /trigger/low_spo2` | Inject low SpO2 event |
| `POST /demo/fast-forward-medicine` | Trigger next medicine reminder immediately |
| `GET /demo/source` | Get active data source (dataset / simulator) |
| `POST /demo/source` | Switch data source |

### 11.2 WebSocket Channel

A single WebSocket at `/ws` broadcasts:
- New readings per patient (`vital_update`).
- Alert creation and state changes (`alert_raised`, `alert_updated`).
- Medicine reminder fires (`medicine_reminder`).
- Device-offline and data-quality warnings.
- Check-in status updates.

---

## 12. Notification and Alert Routing

### 12.1 Routing Table

| Event | Caregiver | Primary family | Secondary family |
|---|---|---|---|
| Warning | ✅ (or family if no caregiver) | — | — |
| Critical | ✅ | ✅ | — |
| SOS | ✅ | ✅ | — |
| Unacknowledged (timeout) | — | — | ✅ (Escalated label) |
| Device offline | ✅ | ✅ | — |
| Missed medicine >30 min | ✅ | ✅ | — |
| Missed check-in | ✅ | — | — |

### 12.2 Channels

- **Telegram Bot API:** real if `TELEGRAM_BOT_TOKEN` and patient's `telegram_chat_id` are set in `config.json`. Otherwise logs to console and shows a "Telegram (simulated)" toast on the dashboard.
- **Simulated SMS:** writes to the "Family phone" panel in the UI and to the console. Optional Twilio adapter enabled only if `TWILIO_*` credentials are set.
- **In-app:** siren banner + browser SpeechSynthesis voice alert on Critical/SOS. Remains active until Acknowledged.
- **Retry:** retry once on failure, then fall back to the other available channel.

### 12.3 Notification Record

Every attempt records: patient_id, recipient_id, recipient_type, channel, event type, sent_at, ack_at, latency_ms (reading time to notification time).

---

## 13. Medicine Reminders

### 13.1 Reminder Workflow

1. At each scheduled time: dashboard reminder card + large "Take your medicine" card on the patient screen + browser voice reminder.
2. Not marked Taken within 15 minutes: notify the assigned caregiver.
3. Still missed after 30 minutes: notify the family contact + mark "Missed" in the medicine log.
4. Caregiver can mark taken with a note (e.g., "Given at 10:35, patient had it with water").

### 13.2 Medicine Log

Each log record: medicine_id, scheduled_time, status (pending / taken / missed), marked_by (patient / caregiver), marked_at, note.

### 13.3 Demo Helper

A "Fast-forward time" button on the dashboard triggers the next medicine reminder immediately, so the full reminder → missed → notify caregiver → notify family flow can be shown in a 3-minute demo.

---

## 14. Dashboard Design: Two Specialized Dashboards

SmartCare implements two primary login dashboards tailored specifically to the user's needs, plus dedicated views for Family and Admin:

### 14.1 Persistent Disclaimer

Every screen shows a permanent top banner:
> **"PROTOTYPE SYSTEM: Simulated & replayed healthcare monitoring data only. Not a medical device or diagnostic tool. No alert does not imply safety."**

### 14.2 Caregiver Dashboard (Clinical-Telemetry UI)

Tailored to nursing staff, home aides, and caregivers. The dashboard locks to a single patient per login session — to switch patients, the caregiver signs out and logs back in:
- **Dedicated Single-Patient Session:** Dashboard locks to the patient selected at login. No in-session patient switching — ensures focused, undivided attention per patient.
- **Real-Time Sparklines & Charts:** Interactive Chart.js graph tracking the latest 60 readings with configured threshold boundary overlays.
- **Actionable Alert Queue:** Active alerts with exact breach value, plain explanation, **Acknowledge** button (mutes siren banner), and **Resolve** action with mandatory care notes.
- **AI Insights Tab:** On-demand 24-hour health briefings powered by the three-tier LLM chain (Groq → Gemini → Local Heuristics). Includes a source badge showing which tier generated the summary.
- **Threshold Sandbox & Custom Profiles:** Live threshold editor with client-side sandbox validation that runs against stored reading history before saving.
- **Care-Task Checklist:** Actionable daily care routines (vitals check, meds, meals, mobility walk) with due times and overdue badges.
- **Shift Handover Notes & Care Logs:** Structured handover records (condition on arrival, tasks completed, concerns) visible to the incoming shift caregiver.
- **Family Contact & Escalation Oversight:** Direct display of masked family phone numbers with one-click call/WhatsApp shortcuts and live escalation countdown timers.

### 14.3 Patient Dashboard / Screen (Elderly-Centric UI)

Tailored specifically to seniors or individuals needing care with minimal cognitive load:
- **Massive One-Touch SOS Button:** Prominently placed, high-contrast red panic button that fires an instantaneous Critical alert across all notification channels, bypassing threshold filters.
- **One-Touch "I'm OK" Check-in:** Simple wellness check-in button that allows the patient to confirm daily wellbeing with a single click, resetting the missed check-in timer without typing.
- **Calm, High-Contrast Vitals Display:** Giant-font vitals display with reassuring, non-diagnostic status chips (e.g., `Heart Rate: 74 BPM (Normal)`, `Temperature: 36.6°C (Stable)`), avoiding terrifying clinical jargon.
- **Actionable Medication Cards:** High-visibility medication cards displaying due pills with a simple "Taken" button and browser voice prompt ("It is time to take your morning medication").
- **Caregiver On-Duty Status:** Clear card displaying which caregiver is currently active on shift and a direct emergency call link.
- **Auditory Announcements:** Browser SpeechSynthesis announces medication reminders and confirms SOS activations.

### 14.4 Family View (read-only)

- Patient status and Health Score.
- Recent alerts (last 24 hours).
- Missed medicines and missed tasks.
- Caregiver's latest daily note and handover note.
- Masked caregiver phone and one-tap call link.

### 14.5 Admin View

- All patients and caregivers.
- Caregiver verification queue (MOCK): Verify / Reject / set expiry.
- Contact change audit log.
- Fee negotiation statuses (MOCK).
- Full notification history and judge metrics.

---

## 15. Privacy and Security

- **Role-based access:** Patient sees only their own screen; Caregiver sees only assigned patients; Family sees only their patient (read-only); Admin sees all.
- **Consent recorded:** patient/family consent checkbox is mandatory at registration; timestamp stored.
- **Masked phone numbers:** displayed as `+91 98XXXXXX21` everywhere. Raw number stored in the database and used only for sending notifications.
- **No secrets in code:** Telegram token, Groq API key, Gemini API key, and Twilio credentials stored in `config.json` / environment variables only. Never hardcoded.
- **Audit log:** every contact change, notification attempt, login, and threshold change is recorded with actor and timestamp.
- **Document visibility:** caregiver verification documents visible only to admin.
- **Non-diagnostic rule:** `Predicted Disease` from the dataset is never exposed on any user-facing screen. Condition tags are set only by the family/admin during registration.

---

## 16. Evaluation Page

A "Metrics" screen accessible from the admin view, for hackathon judges:

| Metric | Description |
|---|---|
| Average alert latency | Time from reading timestamp to notification sent, in ms |
| Alerts raised | Total count, broken down by severity |
| Alerts suppressed | Count of alerts blocked by false-alarm filter |
| Sensor errors quarantined | Count of impossible-value readings blocked |
| Medicines taken vs missed | Count and percentage per patient |
| Check-ins completed vs missed | Count per patient |
| Simulator uptime | Readings generated per patient, active anomaly triggers fired |
| Dataset replay uptime (if active) | Rows replayed, loop count, current row |
| Notification delivery | Attempted, succeeded, failed, retried, per channel |

A test script (`eval_test.py`) replays a fixed 5-minute scenario and prints these numbers to the console, so judges can verify the system independently.

---

## 17. Testing and Evaluation

| Scenario | Expected behaviour |
|---|---|
| Valid reading within thresholds | Stored, displayed, no alert |
| Reading crosses warning threshold | Warning alert with explanation; caregiver notified |
| Reading crosses critical threshold | Critical alert; caregiver + family notified; siren + voice |
| Impossible value (HR 0) | Quarantined as sensor error, not alerted |
| Value at threshold but only for 3s (< filter default 5s) | No alert raised (false-alarm suppressed) |
| Value persists beyond threshold for 6s | Alert fires |
| HR rises 30 BPM in 30 seconds | Trend Warning fires |
| SOS button pressed | Immediate Critical; all channels notify |
| "I'm OK" not pressed within period | Caregiver notified |
| No reading for 2 minutes | Device offline alert |
| Caregiver acknowledges | Siren stops, timestamp recorded |
| Unacknowledged for N seconds | Escalated to second family contact |
| Medicine not marked Taken in 15 min | Caregiver notified |
| Medicine still missed at 30 min | Family notified, "Missed" logged |
| Caregiver marks medicine taken with note | Log updated, family can see note |
| Fall Detection = Yes in CSV row | Immediate Critical alert (SOS pipeline) |
| Data Accuracy < 90% | "Low Signal" badge on reading |
| No CSV present | Dynamic simulator starts automatically (it is the default) |
| Telegram token missing | Console log + "Telegram (simulated)" toast shown |
| Dataset loops | Replay continues seamlessly (when dataset replay is the active source) |
| Family views patient | Read-only, no alert controls |
| Admin verifies caregiver | Status changes to Verified |
| Fee negotiation: Agreed | Assignment enabled |
| Threshold sandbox preview | Alert count matches re-run on stored history |
| Groq and Gemini APIs unavailable / offline | Seamless fallback to local heuristic engine summary; source badge shows "Local Heuristics" |

---

## 18. Implementation Roadmap

### Stage 1: Backend, Simulator, Alert Engine, Basic Dashboard, Acknowledge
- FastAPI app and SQLite schema (core tables).
- Dynamic simulator (`simulator.py`) as the default data source — starts on app launch, generates readings every second per patient.
- Dataset replayer as an optional secondary source with configurable column mapping.
- Threshold evaluation and false-alarm filter.
- Trend check rule.
- WebSocket broadcast of readings and alerts.
- Basic single-page dashboard: patient cards, live charts, alert list, Acknowledge.

### Stage 2: Telegram/SMS, Siren, Escalation, SOS, Check-in, Offline Detection
- Telegram Bot API integration with simulated fallback toast.
- Simulated SMS Family phone panel.
- Siren banner and SpeechSynthesis voice alert.
- SOS button and pipeline.
- "I'm OK" check-in button and missed-check-in alert.
- Device-offline detection (2-minute timeout).
- Escalation timer and second family contact notification.

### Stage 3: Registration, Family Contact, Roles, Medicine Reminders
- Patient registration form with consent and family contact validation.
- Phone verification (simulated) and masked display.
- Dual Dashboard login selector (Patient vs. Caregiver).
- Family view (read-only).
- Medicine schedule, reminder workflow, Taken/Missed tracking, Fast-forward helper.

### Stage 4: Caregiver Module, Tips, Health Score, AI Layer & Fallback, Metrics Page
- Caregiver profile, verification queue (MOCK), fee negotiation (MOCK).
- Caregiver assignment with skill matching.
- Caregiver page: assigned patients, care tasks, care log, handover notes.
- Daily care tips (condition + vitals based).
- Health Score calculation and tooltip.
- AI layer (Groq API primary → Gemini secondary → local heuristics fallback) with strict non-diagnostic guardrails.
- Threshold sandbox preview.
- Evaluation/Metrics page.

### Stage 5: Seed Data, README, Demo Script
- `seed.py`: creates 4 demo patients (one per cohort), 2 caregivers, 1 admin, family contacts, medicines, assignments.
- `eval_test.py`: runs the simulator for 5 minutes with a fixed seed and prints metrics to the console.
- `README.md`: setup, simulator config guide, architecture diagram, cost table, honest limits, future scope.
- Demo script (3 minutes).

---

## 19. Scope and Limitations

- The prototype is fully software-based. No ESP32 or physical sensor is required.
- The dynamic simulator is the default and primary data source. It generates different readings every run and requires no external files.
- The Kaggle CSV dataset is an optional secondary source for dataset replay. The app runs fully without the CSV file present.
- Telegram notifications are real only if a bot token and chat IDs are configured in `config.json`. Otherwise the system simulates them with a console log and a UI toast.
- SMS is always simulated (Family phone panel). An optional Twilio adapter is enabled only if credentials are present.
- Caregiver verification is a manual admin review — not connected to any police, government, or background-check database.
- Fee negotiation is a status tracker only — no payment processing.
- Phone verification is simulated — no real OTP or SMS gateway.
- Groq and Gemini summaries are optional — the local heuristics rule engine always runs as final fallback if no API keys are set or on any network/API failure. No configuration is required to run the app.
- Language support (Telugu/Hindi) is future scope — English only in the prototype.
- Dataset rows are replayed for demo purposes only. They represent a different population and are not a patient's personal health history.
- Threshold values are demonstration defaults, not universal medical limits.
- The Health Score is a configured-limit compliance indicator, not a clinical assessment.
- The system does not diagnose disease, recommend treatment, guarantee notification delivery, or replace professional medical care.

---

## 20. Deliverables

1. Working software-only CareBeat application.
2. Dynamic simulator (`simulator.py`) — default data source, generates realistic readings every second per patient with API-triggered anomaly support.
3. Dataset replayer — optional secondary source with configurable column mapping via `config.json`.
4. `main.py` — FastAPI backend, WebSocket server, alert engine.
5. `database.py` — SQLite schema and queries.
6. `ai_service.py` — Three-tier AI summarizer: Groq API (primary) → Gemini API (secondary) → CareBeat Local Clinical Heuristics v1.2 (final fallback). Strictly non-diagnostic.
7. `static/index.html` — full single-page dashboard with two specialized dashboards (Caregiver vs. Patient) and family/admin views.
8. `seed.py` — creates 4 demo patients, 2 caregivers, 1 admin, family contacts, medicines.
9. `eval_test.py` — 5-minute simulator run (fixed seed) with metrics printout.
10. `config.json` / `config.example.json` — all configurable values (no secrets hardcoded).
11. `requirements.txt`.
12. `data/README.md` — dataset name, version, URL, license, column mapping documentation.
13. `README.md` — cleaner, shorter companion to this documentation with setup, architecture, demo script, and limits.
14. Caregiver module (profile, verification MOCK, fee negotiation MOCK, assignment, caregiver page).
15. Evaluation/Metrics page.

---

## 21. Differentiators

- **Dual Specialized Dashboards:** Distinct tailored interfaces for Patient (elderly accessibility, giant SOS, check-in) and Caregiver (multi-patient telemetry, task checklists, handover notes).
- **Family-first design:** family contact is mandatory; alerts go directly to family on Critical/SOS; family has a dedicated read-only view.
- **Caregiver module:** skill matching, shift assignment, care task checklists, handover notes — not just a raw data display.
- **Verification and trust layer (mocked):** caregiver verification workflow makes the prototype feel production-ready.
- **Intelligent alert routing:** Warning → caregiver only; Critical/SOS → caregiver + family simultaneously; escalation → second family contact.
- **Fall detection pipeline:** Fall Detection column in the dataset auto-triggers a Critical alert.
- **Health Score transparency:** formula shown in a tooltip, not a black box.
- **False-alarm filter:** prevents alert fatigue; sensor errors never fire alerts.
- **Data quality awareness:** Low Signal badge; stale data shown as "No recent data", never as normal.
- **Medicine adherence tracking:** Taken/Missed with caregiver override and family visibility.
- **Three-Tier AI & Guaranteed Offline Fallback:** Groq API (primary, ultra-fast LPU inference) → Google Gemini API (secondary) → CareBeat Local Clinical Heuristics Engine (always-on). Always returns a non-diagnostic caregiver summary regardless of API availability.
- **Dynamic simulator as default:** generates different, realistic readings every run without needing any files — no CSV required to start the app.
- **Instant demo triggers:** `/trigger/tachycardia`, `/trigger/fever`, `/trigger/low_spo2` fire anomalies on demand, guaranteeing a live alert within 5 seconds for any judge demo.
- **Zero-cost, zero-hardware demo:** runs on a laptop, simulates the full elderly care workflow end to end.
- **IoT-ready:** same JSON ingestion interface accepts real ESP32 readings without code changes.

---

## 22. Additional Features (Future Roadmap)

These features represent the future development roadmap for extending the prototype into production after the core platform is built:

### 22.1 Physical ESP32 Hardware & Wearable Sensor Node
- **Wearable Sensor Integration:** Connect MAX30102 (PPG pulse oximetry and heart rate) and DS18B20 (high-accuracy digital body temperature) sensors directly to an ESP32 micro-controller.
- **Battery-Operated Low-Power Design:** Utilize ESP32 Deep Sleep modes with 10-second wake intervals to support multi-day wearable battery life.
- **Dual Protocol Support:** Enable Wi-Fi HTTP POST (`POST /measurements`) and lightweight MQTT telemetry streaming for unstable home Wi-Fi networks. See `firmware/esp32_example.ino` for the initial reference architecture.

### 22.2 Hardware-Based Fall Detection
- **MPU-6050 6-Axis IMU:** Accelerometer and gyroscope integration detecting sudden acceleration drops followed by high-impact spike signatures.
- **Edge Anomaly Filtering:** Run edge-based threshold checks on the ESP32 to trigger automatic SOS alerts via the existing `fall_detected` ingestion flag.

### 22.3 Multilingual Regional Voice & UI Support
- **Localized Languages:** Add native support for Hindi, Telugu, Tamil, and Bengali across the Patient Dashboard.
- **Bilingual Speech Alerts:** Leverage browser SpeechSynthesis with regional voice models for non-English speaking elderly patients.

### 22.4 Production SMS & Messaging Integrations
- **Twilio SMS & Voice API:** Transition from simulated SMS to automated cellular SMS and voice calls.
- **WhatsApp Business Cloud API:** Deliver real-time vital summary cards and interactive Acknowledge buttons directly into WhatsApp family groups.

### 22.5 Automated Emergency Services Dispatch
- **Webhook Dispatch Protocol:** Automated REST webhook payloads transmitting patient medical profile, GPS location, and critical vitals directly to municipal ambulance dispatch centers upon escalated emergencies.

### 22.6 On-Device Edge AI Anomaly Detection
- **TinyML on ESP32:** Deploy lightweight TensorFlow Lite for Microcontrollers models on the ESP32 to detect cardiac arrhythmias locally without requiring internet connectivity.

### 22.7 Electronic Health Records Integration
- **ABDM & FHIR Compliance:** Align telemetry and audit logs with Ayushman Bharat Digital Mission (ABDM) and HL7 FHIR standards for seamless export into hospital electronic health record systems.
