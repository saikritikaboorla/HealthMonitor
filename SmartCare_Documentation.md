# SmartCare: Affordable Smart Health Monitoring and Emergency Alert System

**Document type:** Project and technical documentation
**Audience:** Clients, reviewers, and developers building the prototype
**Status:** Prototype specification (software-first, hardware optional)

> **Important notice:** SmartCare is a monitoring and caregiver-coordination prototype. It does not diagnose disease, recommend treatment, or replace professional medical assessment. All demonstration data is simulated, replayed from public research datasets, or fictional, and all alerts are prototype alerts.

---

## Table of Contents

1. Overview
2. Recommended Technology Stack
3. System Architecture
4. How the Application Works
5. Core Features
6. Advanced Features
7. Datasets and Data Strategy
8. Database Design
9. API Design
10. Safety, Privacy, and Non-Diagnostic Communication
11. Testing and Evaluation
12. Implementation Roadmap
13. Scope and Limitations
14. Deliverables
15. Differentiators

---

## 1. Overview

### 1.1 Problem

Elderly people and individuals who need regular health monitoring may not receive timely help when their vital signs become abnormal or when they need emergency assistance. Periodic manual checks and limited caregiver availability leave gaps in monitoring and delay responses.

### 1.2 Solution

SmartCare is an affordable, software-first platform that connects four things in one workflow:

1. **Vital-sign monitoring** (heart rate and body temperature, simulated, replayed, or manually entered).
2. **Alert generation** when readings cross configurable thresholds or show unusual patterns.
3. **Caregiver response** through a dashboard where alerts are acknowledged, investigated, and resolved.
4. **Emergency notification and escalation**, including an SOS button that works even when readings look normal.

The prototype runs entirely on a standard computer with no sensors. Its architecture is built so that an ESP32 device and real sensors can be added later without redesigning the system.

### 1.3 Objectives

1. Build an affordable monitoring prototype that works fully in software.
2. Display heart rate (BPM) and body temperature (°C) with timestamps and live updates.
3. Let caregivers configure and test alert thresholds.
4. Detect threshold breaches, sustained abnormalities, and unusual changes between readings.
5. Provide a simple dashboard for monitoring multiple patients.
6. Support independent SOS activation and a structured caregiver response workflow.
7. Demonstrate notifications, acknowledgment timeouts, and escalation to backup contacts.
8. Detect invalid readings, stale data, and device disconnections.
9. Keep a complete, auditable history of readings, alerts, actions, and notifications.
10. Clearly communicate that the system is not a medical diagnostic tool.

---

## 2. Recommended Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend framework | React with Vite (Next.js is an acceptable alternative) | Caregiver dashboard |
| Styling and components | Tailwind CSS and shadcn/ui | Accessible, consistent UI including modals and drawers |
| Charts | Recharts (Apache ECharts as an alternative for heavier streaming) | Live graphs, brush/zoom, heatmaps |
| Live updates | WebSockets (native WebSocket API or socket.io) | Real-time readings, alerts, presence |
| Backend | Python with FastAPI | REST APIs, validation, business logic, WebSocket server |
| Simulation and replay | Python (NumPy, pandas) | Repeatable vital-sign scenarios and dataset replay |
| Monitoring engine | Python rules engine | Threshold, persistence, trend, and data-quality checks |
| Background tasks | FastAPI background tasks or APScheduler | Acknowledgment timeouts, escalation, stale-data checks |
| Database | SQLite (PostgreSQL later if needed) | Readings, alerts, audit history |
| Notifications | In-app, simulated email/SMS; optional SMTP or SMS provider | Emergency notification demo |
| Testing | Pytest and API tests | Validation of monitoring and alert workflows |
| Future IoT | ESP32, suitable sensors, MQTT | Optional physical data collection |

**Why this stack:** it is lightweight, free to run, easy to demonstrate on a laptop, and uses a clear split between a Python backend (rules and data) and a React frontend (interaction and visualization).

---

## 3. System Architecture

The system is modular. Each component has one job, so parts can be built, tested, and replaced independently.

```
[Simulator] [Dataset replay] [Manual entry] [Device adapter (future ESP32/MQTT)] [SOS / check-in]
        \          |              |                  |                          /
         +------------------ Data Input Layer (normalized format) ------------+
                                        |
                              FastAPI Backend (REST + WebSocket)
                                        |
         +---------------+--------------+---------------+------------------+
         |               |              |               |                  |
  Monitoring &     Data-quality    Alert & Escalation  Notification     Database
  Rules Engine       Monitor           Engine            Layer          (SQLite)
         \_______________\_____________|_______________/__________________/
                                        |
                         React Caregiver Dashboard (live via WebSocket)
```

### 3.1 Data Input Layer

Accepts data from five sources and converts everything into one common format:

- A configurable Python simulator.
- A dataset replay adapter that streams recorded public data as if it were live.
- A manual measurement-entry form.
- An extensible device adapter for future integrations.
- Self-reported check-ins and SOS requests.

Every measurement carries: patient ID, parameter name, value, unit, timestamp, and **data-source label** (simulated, dataset-replay, manual, or device-imported).

### 3.2 Backend and API Layer

A FastAPI application exposes endpoints for patients, measurements, thresholds, alerts, SOS events, history, and notifications. It also handles validation, access control, source labeling, and broadcasts updates to the dashboard over WebSockets.

### 3.3 Monitoring and Rules Engine

Validates each reading, checks thresholds, evaluates persistence and trend rules, and produces explainable alert events. A separate **data-quality monitor** detects stale or missing data.

### 3.4 Alert and Escalation Engine

Manages alert states, acknowledgments, claim locks, timeouts, retries, and escalation to secondary contacts. Notification work runs asynchronously so it never blocks incoming readings.

### 3.5 Notification Layer

Delivers in-app alerts and simulated email/SMS messages, with optional real providers. Every attempt is recorded with its channel and outcome.

### 3.6 Database Layer

SQLite stores patients, caregivers, measurements, thresholds, alerts, caregiver actions, notification attempts, and audit events. It can migrate to PostgreSQL if concurrent usage grows.

### 3.7 Frontend Dashboard

A React single-page application shows live readings, history, alerts, device status, and response controls. WebSockets deliver live data; REST handles history and configuration.

### 3.8 Future IoT Integration

A standard ingestion interface lets an ESP32 with sensors publish readings (for example over MQTT) without changes to the monitoring engine. Hardware is optional for the first version.

---

## 4. How the Application Works

### 4.1 End-to-End Workflow

1. **Patient setup:** Create a patient profile, set thresholds, and register primary and secondary caregivers.
2. **Data arrives:** The simulator generates readings, a dataset is replayed, a caregiver types in a measured value, or a device sends data.
3. **Validation:** The system checks value ranges, units, timestamps, required fields, and source. Invalid readings are quarantined with a recorded reason.
4. **Storage and display:** Valid readings are saved and pushed to the dashboard instantly.
5. **Rule evaluation:** The engine compares readings against thresholds and evaluates persistence and trend rules.
6. **Alert creation:** If a rule fires, an explainable alert is created.
7. **Notification:** The alert appears on the dashboard (with optional audio) and configured notifications are attempted.
8. **Acknowledgment:** A caregiver claims and acknowledges the alert and records a note.
9. **Escalation:** If no one acknowledges before the timeout, a backup contact is notified.
10. **Resolution:** The caregiver marks the event resolved. History is never deleted.
11. **Review:** Everything remains available for replay, reports, and audit.

SOS can enter this workflow at any point and does not depend on a threshold breach.

### 4.2 Alert States

| State | Meaning |
|---|---|
| **Active** | Alert generated, nobody has responded |
| **Under review** | A caregiver has claimed the alert (temporary lock) |
| **Acknowledged** | A caregiver confirmed awareness |
| **Escalated** | Timeout expired or manual escalation to a backup contact |
| **Resolved** | Caregiver recorded that the event was addressed |

Acknowledgment does not imply resolution. Each transition records who acted, when, and any note.

---

## 5. Core Features

### 5.1 Multi-Source Data Collection

- **Simulated readings:** configurable heart-rate and temperature values at a set interval.
- **Dataset replay:** recorded public data streamed through the same pipeline (see Section 7).
- **Manual entry:** caregivers enter values from an existing measuring device.
- **Device integration:** extensible adapter for future devices and APIs.
- **Self-reported check-ins:** the person can say they feel unwell or want contact.
- **SOS:** an independent assistance request.

Manually entered, replayed, or imported data is never presented as continuous live monitoring unless the source truly provides it.

### 5.2 Real-Time Monitoring Dashboard

Shows, per patient: current heart rate (BPM) and temperature (°C), last-updated time, status (normal, attention required, alert), source label, and historical graphs. Unavailable data is shown distinctly from valid readings.

### 5.3 Configurable Thresholds

Caregivers set minimum and maximum limits per parameter. The system validates the configuration, applies it to subsequent readings, records every change with a version, and shows which limit was breached. Thresholds are labeled as **demonstration settings** and are never presented as personalized medical advice.

### 5.4 Explainable Alert Engine

**Rule-based monitoring:** each valid reading is compared with the configured limits.

**Trend-aware monitoring:** supplements threshold alerts by detecting repeated breaches, readings that stay outside limits, sustained shifts from a baseline, and rapid changes between consecutive readings.

**Alert priority:**

- *Warning:* a reading is outside the configured range.
- *High priority:* a more significant configured limit is crossed, or the breach persists.
- *Unacknowledged:* no caregiver has responded within the timeout.

**Alert grouping:** repeated notifications for the same ongoing event are grouped. A new or worsening condition is never silently suppressed.

**Explainability:** every alert states why it fired, for example:

> "Heart-rate threshold exceeded: the latest simulated reading is 125 BPM, above the configured maximum of 110 BPM."

Trend indicators give context only. They do not claim to predict or diagnose a medical condition.

### 5.5 Data Quality and Monitoring Continuity

The platform detects missing readings, stale readings, malformed values, missing fields, inconsistent units, simulated disconnections, and failed notifications. When data is unavailable the dashboard shows "No recent reading available" instead of implying the patient is fine. Data-quality warnings are kept separate from health alerts.

### 5.6 Emergency SOS

When SOS is activated:

1. A high-priority emergency event is created.
2. It appears prominently on the dashboard.
3. The primary caregiver is notified.
4. It stays active until acknowledged and then resolved.
5. If the timeout expires, secondary contacts are notified.
6. Every action and outcome is recorded.

SOS is visually distinct from threshold alerts. In the prototype it is simulated and does **not** contact real emergency services.

### 5.7 Notification and Escalation

Channels: in-app, simulated email, simulated SMS, and optional real email/SMS if credentials exist. Each attempt records recipient, event, time, channel, and outcome. The system distinguishes *attempted*, *accepted by provider*, and *confirmed delivered*, and never treats an attempt as successful receipt. A typical demo timeout is two minutes before escalating to a secondary caregiver.

### 5.8 Audit Trail

Persists readings with sources, threshold changes, alerts with explanations, SOS events, caregiver actions and notes, notification attempts, escalations, data-quality warnings, and connection failures. Records link by patient and event ID, and previous events are preserved rather than overwritten.

### 5.9 Simulation and Scenario Replay

A scenario engine produces deterministic, repeatable demonstrations: normal readings, single breach, repeated breaches, gradual drift, invalid or missing data, stale data and disconnection, manual entry, SOS during normal readings, acknowledgment and resolution, missed acknowledgment and escalation, and notification failure with retry. All simulated data stays visibly labeled as simulated.

---

## 6. Advanced Features

These features distinguish SmartCare from a basic vital-sign display. They are listed in recommended build order in Section 12.

### 6.1 Time-Travel Event Playback and Scrubbing

When an alert fires, the system saves an **event snapshot**. Clicking the alert opens an interactive timeline that lets the caregiver replay vital trends from five minutes before to five minutes after the event.

- **Backend:** a history query by patient and time window; snapshot stored with the alert.
- **Frontend:** synchronized zoom and brush controls (Recharts or ECharts), a play/pause and scrub control, and markers for the alert and caregiver actions.
- **Value:** lets caregivers understand what led to an alert and what followed.

### 6.2 Interactive Threshold Sandbox ("Test Before Saving")

Caregivers adjust min/max sliders and immediately see the proposed limits drawn over the patient's last 24 hours of data, with a live preview such as: *"With these settings, 3 alerts would have triggered in the past 24 hours."*

- Runs on the client using cached history, so feedback is instant.
- Changes take effect only when saved; saving writes a new versioned configuration.
- **Value:** reduces alert fatigue and prevents poorly chosen limits.

### 6.3 Multi-Caregiver Collaboration and Live Presence

- **Presence indicators:** show who is online and who is viewing each patient card, using WebSocket presence rooms.
- **Claim and lock:** when a caregiver clicks "Triage Alert", the card shows "*[Name]* is reviewing" and locks for 60 seconds to prevent duplicate work. The lock expires automatically or is released manually.
- **Shift notes:** a comment box on each alert for logging actions (for example, "Called patient, false alarm due to exercise"). Notes support handover between caregivers and are part of the audit log.

### 6.4 Interactive Emergency Action Drawer

Clicking an emergency alert opens a side drawer with actionable controls:

- **Quick-dial / WhatsApp message:** opens a pre-filled message containing the latest vitals, patient profile, and timestamp. This uses a prepared message link and does not contact emergency services.
- **One-click escalation:** reassigns the alert to a backup contact if the primary caregiver cannot attend.
- **Audio siren and mute:** configurable browser alert tones, plus a visible countdown until automatic escalation.

### 6.5 Daily Vitals Summary and Heatmap

- **Hourly calendar heatmap** (similar to a contribution graph): green for within configured limits, yellow for minor deviations, red for threshold breaches. The legend states these are configured-limit categories, not clinical judgments.
- **Summary card:** an automatically generated statement such as *"Heart rate averaged 72 BPM today; temperature stayed within the configured range."*
- **Report metrics:** alerts generated, alerts acknowledged, and periods when data was unavailable.

### 6.6 Edge Device Health and Signal Monitor

A widget that shows device battery percentage, Wi-Fi signal strength (RSSI), and a heartbeat indicator ("Last ping: 2s ago"). If the device is silent for more than 15 seconds, the dashboard shows a **"Sensor Offline / Connection Lost"** warning.

In the software-only prototype this telemetry is **simulated**, with a control to trigger disconnection. When a real ESP32 is added, the same widget reads real telemetry.

### 6.7 Supporting Features

- **Medication and routine reminders** (optional): caregivers schedule reminders for medicines, water, or check-ins; the person marks them complete; unconfirmed check-ins notify the caregiver. The system never recommends or changes medication doses.
- **Personalized baseline detection** (experimental): compares recent readings with the individual's own history and flags unusual change for review, even when thresholds are not crossed. Presented as an experimental, non-validated indicator.
- **Exportable care reports:** CSV or PDF of selected readings, alert timestamps, acknowledgment status, and caregiver notes.

---

## 7. Datasets and Data Strategy

### 7.1 Role of Data in This Prototype

SmartCare is a rules-based system, not a trained machine-learning model. Datasets are therefore used for **realistic input, testing, and demonstration**, not for training a diagnostic model. Data is used in five ways:

| Use | How data is used |
|---|---|
| **Realistic replay** | Recorded heart-rate and temperature series are streamed through the normal ingestion pipeline so the dashboard shows realistic variation instead of smooth synthetic curves. |
| **Threshold sandbox** | The "last 24 hours" preview (Section 6.2) runs candidate limits against replayed or generated history. |
| **Baseline and trend testing** | Multi-hour or multi-day series are used to test persistence rules, rapid-change rules, and the experimental personal-baseline indicator. |
| **Heatmap and summaries** | Longer recordings populate the hourly heatmap and the daily summary card. |
| **Automated tests** | Small, fixed data excerpts serve as deterministic test fixtures. |

### 7.2 Data Source Types

1. **Synthetic data (primary, always available).** A Python generator creates heart-rate and temperature series with a configurable resting baseline, circadian drift, noise, and injected events (spikes, sustained elevation, gradual rise, dropouts, invalid values). A fixed random seed guarantees repeatable results. This is the default for demos and all automated tests.
2. **Public research datasets (optional, for realism).** Recorded physiological signals replayed through the adapter. Candidates are listed below.
3. **Manual entry.** Values typed by a caregiver, stored with a manual-entry label.
4. **Future device data.** Real readings from an ESP32 or compatible device, outside the initial scope.

### 7.3 Candidate Public Datasets

Choose one or two; the project does not depend on any of them. **Before using any dataset, read its current license and access terms on the official page and cite it in the repository.** Availability and terms can change, and some datasets require registration or credentialed access.

| Dataset | Source | Useful signals | Notes |
|---|---|---|---|
| **Fitbit Fitness Tracker Data** | Kaggle | Heart rate at short intervals, activity, sleep | Consumer wearable data from many users; good for daily patterns and heatmaps. Check the listed license and the dataset's anonymization notes. |
| **Wearable Exam Stress Dataset** | PhysioNet | Heart rate and skin temperature from a wrist-worn sensor | Useful where a temperature channel is needed. Skin temperature differs from core body temperature, so label it accordingly. |
| **WESAD** | UCI Machine Learning Repository | Wrist-worn heart-related signals and skin temperature | Recorded during controlled lab conditions; useful for stress-related variation. |
| **PPG-DaLiA** | UCI Machine Learning Repository | Heart rate during daily activities | Good for realistic activity-driven changes; heart rate only. |
| **BIDMC PPG and Respiration Dataset** | PhysioNet | Heart rate and respiration derived from hospital recordings | Short recordings; useful as small test excerpts. |
| **MIT-BIH Arrhythmia Database** | PhysioNet | ECG recordings with beat annotations | Heart rate can be derived from beat timing. Overkill for this prototype; only use if ECG-based demos are wanted. |

**Not recommended for this prototype:** large clinical datasets that need credentialed access (for example MIMIC-family databases). They add legal and access overhead with no benefit for a simulation-based demo.

### 7.4 Primary Repository Dataset: Synthetic Patient HealthCare Monitoring Dataset

The repository includes a primary dataset file (`Synthetic_patient-HealthCare-Monitoring_dataset.csv`) providing 60,000 structured patient records across 13 clinical and monitoring features with zero missing values. This dataset serves as the foundational test fixture, validation benchmark, and scenario generation engine for the SmartCare prototype.

#### 7.4.1 Dataset Schema and Feature Breakdown

| Feature | Data Type | Range / Distribution | Description & Operational Relevance |
|---|---|---|---|
| `Patient Number` | Integer | 1 to 60,000 | Unique synthetic patient record identifier. |
| `Heart Rate (bpm)` | Integer | 50 – 139 bpm (mean: 94.57) | Pulse rate reading. Baseline normal range is 60–100 bpm; abnormal below 60 or above 100 bpm. |
| `SpO2 Level (%)` | Integer | 84% – 100% (mean: 94.54%) | Peripheral blood oxygen saturation. Normal: 95–100%; abnormal (hypoxia): 84–94%. |
| `Systolic Blood Pressure (mmHg)` | Integer | 90 – 199 mmHg (mean: 135.25) | Peak arterial pressure. Normal: ≤140 mmHg; abnormal: >140 mmHg. |
| `Diastolic Blood Pressure (mmHg)` | Integer | 50 – 129 mmHg (mean: 85.86) | Resting arterial pressure. Normal: ≤90 mmHg; abnormal: >90 mmHg. |
| `Body Temperature (°C)` | Float | 35.0°C – 39.3°C (mean: 37.12°C) | Core/skin temperature reading. Normal: 35.0–37.5°C; abnormal: ≥37.6°C. |
| `Fall Detection` | String | 'No' (56,926 / 94.9%), 'Yes' (3,074 / 5.1%) | Accelerometer/fall trigger indicating sudden patient impact or fall. |
| `Predicted Disease` | String | Diabetes Mellitus (12,167), Heart Disease (12,044), Healthy (11,973), Hypertension (11,928), Asthma (11,888) | Clinical archetype label used to generate representative vital sign distributions. |
| `Data Accuracy (%)` | Integer | 85% – 100% (mean: 92.51%) | Telemetry confidence score representing sensor signal quality and noise level. |
| `Heart Rate Alert` | String | NORMAL (36,992), ABNORMAL (23,008) | Pre-computed alert flag for pulse threshold breaches. |
| `SpO2 Level Alert` | String | NORMAL (34,770), ABNORMAL (25,230) | Pre-computed alert flag for oxygen saturation drops. |
| `Blood Pressure Alert` | String | NORMAL (26,530), ABNORMAL (33,470) | Pre-computed alert flag for hypertension or hypotension breaches. |
| `Temperature Alert` | String | NORMAL (44,656), ABNORMAL (15,344) | Pre-computed alert flag for temperature limit breaches. |

#### 7.4.2 Clinical Cohort Characteristics

The dataset models five distinct physiological cohorts with characteristic vital sign distributions:
- **Healthy Cohort (11,973 records):** 100% of readings fall strictly within normal boundaries across all four alert channels (mean HR: 74.4 bpm, mean SpO2: 97.4%, mean BP: 115/75 mmHg, mean Temp: 36.75°C). Zero rule breaches.
- **Heart Disease Cohort (12,044 records):** Characterized by acute tachycardia and elevated arterial pressure (mean HR: 119.6 bpm, with 97.5% triggering abnormal heart-rate alerts; 99.9% triggering abnormal blood pressure alerts).
- **Hypertension Cohort (11,928 records):** 100% exhibit abnormal blood pressure alerts (mean systolic BP: 154.8 mmHg; diastolic BP up to 129 mmHg).
- **Asthma Cohort (11,888 records):** 100% exhibit abnormal SpO2 level alerts (mean SpO2: 89.2%, minimum: 84%), modeling acute respiratory desaturation.
- **Diabetes Mellitus Cohort (12,167 records):** Demonstrates pronounced temperature elevation (mean Temp: 37.85°C; 73.3% abnormal temperature alerts), modeling metabolic and systemic fluctuations.
- **Fall Incidents (3,074 records):** Distributed evenly across cohorts (~5.1% prevalence per group), simulating unpredicted physical emergencies independent of underlying vital health.

---

### 7.5 How the Dataset Works with the SmartCare Solution

The `Synthetic_patient-HealthCare-Monitoring_dataset.csv` directly interfaces with SmartCare's modular architecture:

```
+-------------------------------------------------------------------------------------------------------+
|                    Synthetic Patient HealthCare Monitoring Dataset (60,000 Records)                   |
+-------------------------------------------------------------------------------------------------------+
        |                                 |                             |                     |
 [Vitals Telemetry]              [Fall Detection]              [Data Accuracy %]     [Alert Ground Truth]
(HR, SpO2, Sys/Dia BP, Temp)         ('Yes' / 'No')              (85% - 100%)        (HR, SpO2, BP, Temp)
        |                                 |                             |                     |
        v                                 v                             v                     v
+---------------------+        +---------------------+        +--------------------+ +--------------------+
| Ingestion & Replay  |        | Emergency SOS &     |        | Data Quality       | | Rules Engine       |
| Adapter (Streaming  |        | Action Drawer       |        | & Sensor Monitor   | | Validation &       |
| & Time-Series Gen)  |        | (High Priority)     |        | (Signal Assurance) | | Threshold Sandbox  |
+---------------------+        +---------------------+        +--------------------+ +--------------------+
        |                                 |                             |                     |
        +---------------------------------+-----------------------------+---------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |   FastAPI Backend & WebSocket Stream  |
                      +---------------------------------------+
                                          |
                                          v
                      +---------------------------------------+
                      |     React Caregiver Dashboard         |
                      |  (Patient Cards, Charts & Drawer)     |
                      +---------------------------------------+
```

1. **Multi-Vital Ingestion and Streaming (`POST /measurements`):**
   - The dataset expands SmartCare from a dual-parameter demonstration to a rich multi-vital platform tracking **Heart Rate (bpm)**, **SpO2 (%)**, **Systolic Blood Pressure (mmHg)**, **Diastolic Blood Pressure (mmHg)**, and **Body Temperature (°C)**.
   - The replay adapter (`simulator/`) reads batch rows and transforms them into time-series event streams with generated sequential timestamps at configurable replay speeds (1x real-time, 10x, or 60x demonstration mode).

2. **Emergency Fall Detection Workflow (SOS Pipeline):**
   - Ingested records with `Fall Detection = 'Yes'` bypass routine vital threshold evaluation and directly instantiate an urgent emergency alert identical to a physical SOS button press.
   - This immediately activates the **Emergency Action Drawer** (Section 6.4), sounds the dashboard alert siren, locks the alert for caregiver triage, and begins the acknowledgment/escalation countdown.

3. **Data Quality and Confidence Assessment (`Section 5.5`):**
   - The `Data Accuracy (%)` feature provides realistic sensor quality telemetry.
   - The Data Quality Monitor inspects this value: readings between 85% and 89% are accepted and displayed with a visual "Low Signal / Sensor Noise" quality badge, while readings with ≥90% accuracy are marked verified. This demonstrates the core design principle of separating technical signal quality from clinical condition.

4. **Rules Engine Benchmarking and Sandbox Validation (`Section 5.4 & 6.2`):**
   - The pre-computed alert columns (`Heart Rate Alert`, `SpO2 Level Alert`, `Blood Pressure Alert`, `Temperature Alert`) supply deterministic ground-truth labels.
   - During automated testing (`pytest`), test suites benchmark SmartCare's rules engine against these 60,000 records to verify that configurable thresholds (e.g. HR: 60–100, SpO2: ≥95%, BP: ≤140/90, Temp: ≤37.5°C) trigger alerts with 100% expected consistency.
   - In the **Threshold Sandbox**, caregivers can adjust limit sliders against patient historical recordings and instantly visualize predicted alert frequencies.

5. **Repeatable Scenario Generation via Clinical Archetypes (`Section 5.9`):**
   - The five disease cohorts supply ready-made, reproducible patient profiles for dashboard demonstrations:
     * *Profile A (Stable/Healthy):* Zero false alarms, stable baseline telemetry.
     * *Profile B (Hypertension & Cardiac Stress):* Sustained elevated blood pressure and pulse rate to demonstrate alert persistence, grouping, and triage workflows.
     * *Profile C (Respiratory Desaturation):* Hypoxia alert generation from SpO2 drops below 95%.
     * *Profile D (Acute Emergency):* Sudden fall detection event to demonstrate immediate caregiver escalation.

6. **Strict Non-Diagnostic Compliance (`Section 10`):**
   - In strict compliance with SmartCare's safety commitments, `Predicted Disease` tags are used purely for internal test fixture generation and scenario labeling. The user-facing dashboard **never** presents medical diagnoses, disease classifications, or treatment recommendations, maintaining the platform's non-diagnostic caregiver coordination role.

### 7.6 Data Handling Rules

- **Label the source on every reading.** Replayed data carries a `dataset-replay` source label and the dataset name, never `live`.
- **Do not claim clinical meaning.** Data from other people is not a patient's baseline. Replay is for demonstration only.
- **Normalize units.** Convert to BPM and °C during import. Reject or quarantine values outside plausible ranges and record the reason.
- **Skin versus body temperature.** If a dataset provides wrist or skin temperature, show it as such, or map it only in a clearly labeled demonstration mode.
- **Respect licensing and privacy.** Use only de-identified, openly licensed data. Do not commit raw dataset files to the repository if the license forbids redistribution; commit download scripts and small permitted excerpts instead.
- **Keep it reproducible.** Store dataset name, version, URL, retrieval date, and license in a `data/README.md`.
- **Fictional patients.** Map dataset recordings to fictional patient profiles (for example "Demo Patient A"). Never attach real identities.

### 7.7 Implementation Approach

1. A `scripts/` folder contains a download or import script per dataset and a synthetic generator.
2. An import step converts each dataset into a common CSV or Parquet format: `timestamp, parameter, value, unit, source`.
3. A **replay adapter** reads that file and posts readings to `POST /measurements` at a configurable speed (real time, 10x, or 60x), so a full day can be shown in minutes.
4. A scenario file (YAML or JSON) can combine a dataset segment with injected events, such as a data dropout or an SOS press, for reproducible demonstrations.
5. Small excerpts (a few hundred rows) live in `tests/fixtures/` and drive the automated tests.

Suggested repository layout:

```
smartcare/
├── backend/            # FastAPI app, rules engine, alert engine
├── frontend/           # React dashboard
├── simulator/          # Synthetic generator and replay adapter
├── data/
│   ├── README.md       # Dataset names, versions, licenses, URLs
│   ├── raw/            # Not committed if license restricts redistribution
│   └── processed/      # Normalized CSV files
├── scenarios/          # Repeatable scenario definitions
├── scripts/            # Download and import scripts
├── tests/
│   └── fixtures/       # Small deterministic data excerpts
└── docs/               # This documentation
```

### 7.8 Future Use of Data

If the project later explores anomaly detection or predictive models, it would require properly consented clinical datasets, independent validation, and calibration before any real-world use. That work is outside the scope of this prototype.

---

## 8. Database Design

| Entity | Key fields |
|---|---|
| **Patient** | patient ID, display name, monitoring configuration, profile status |
| **Caregiver** | caregiver ID, name, contact configuration, role and permissions |
| **Patient–Caregiver link** | patient ID, caregiver ID, priority (primary or secondary) |
| **Measurement** | measurement ID, patient ID, parameter, value, unit, timestamp, source type, dataset name (if replayed), validation status |
| **Threshold configuration** | config ID, patient ID, parameter, min, max, effective time, version |
| **Alert** | alert ID, patient ID, trigger (measurement or SOS), category, priority, explanation, created time, state, event snapshot reference |
| **Caregiver action** | action ID, alert ID, caregiver ID, action type, timestamp, note |
| **Notification attempt** | notification ID, alert ID, recipient, channel, timestamp, delivery status or failure reason |
| **Device status** | device ID, patient ID, battery, RSSI, last ping, connection state |
| **Audit event** | event ID, related patient or alert, event type, timestamp, metadata |

Audit and alert records are append-only. Resolving an event changes its state but never deletes its history.

---

## 9. API Design

### 9.1 REST Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /patients` | Create a patient profile |
| `GET /patients` | List accessible patients |
| `POST /measurements` | Submit or import a measurement |
| `GET /patients/{id}/measurements` | Measurement history (supports time-window queries for playback) |
| `GET /patients/{id}/status` | Current monitoring status |
| `GET /patients/{id}/summary` | Daily summary and heatmap data |
| `GET /thresholds/{patient_id}` | Retrieve thresholds |
| `PUT /thresholds/{patient_id}` | Update thresholds (versioned) |
| `GET /alerts` | List alerts |
| `GET /alerts/{id}/snapshot` | Event snapshot for time-travel playback |
| `POST /alerts/{id}/claim` | Claim and lock an alert |
| `POST /alerts/{id}/acknowledge` | Acknowledge an alert |
| `POST /alerts/{id}/notes` | Add a shift note |
| `POST /alerts/{id}/escalate` | Manually escalate to a backup contact |
| `POST /alerts/{id}/resolve` | Record resolution |
| `POST /sos` | Create an SOS event |
| `GET /devices/{id}/status` | Device battery, signal, last ping |
| `GET /notifications/history` | Notification attempts |
| `GET /audit` | Permitted audit records |
| `GET /reports/export` | CSV or PDF care report |

### 9.2 WebSocket Channel

A single authenticated WebSocket broadcasts:

- New readings.
- Monitoring-status and device-status changes.
- Alert creation and state changes (including claim locks and escalation).
- Presence updates (who is viewing which patient).

On reconnect, the dashboard reloads its current state from the database.

---

## 10. Safety, Privacy, and Non-Diagnostic Communication

The system must:

- Show a persistent non-diagnostic disclaimer.
- Label simulated, replayed, and prototype data everywhere it appears.
- Keep technical warnings separate from health alerts.
- Never present trend indicators as medical predictions.
- Never imply that the absence of an alert means a person is safe.
- Never claim guaranteed emergency response or notification delivery.
- Use access controls for patient and caregiver data.
- Avoid exposing sensitive details in logs or notification text.
- Use fictional or de-identified data for all demonstrations.

The prioritization order on the dashboard (active SOS, unacknowledged alerts, repeated breaches) represents operational urgency, not a clinical risk score.

---

## 11. Testing and Evaluation

| Scenario | Expected behavior |
|---|---|
| Valid normal reading | Stored and displayed |
| Reading crosses a threshold | Explainable alert generated |
| Repeated breach | Persistence and grouping rules work as configured |
| Manual entry | Stored with a manual-entry label |
| Dataset replay | Readings stored with replay label and dataset name, at the chosen speed |
| Invalid measurement | Rejected or quarantined, reason recorded |
| No recent measurement | Stale-data warning displayed |
| Simulated disconnection (>15 s silence) | "Sensor Offline" warning displayed |
| SOS during normal readings | Independent high-priority event created |
| Two caregivers open the same alert | Claim lock prevents duplicate triage |
| Caregiver acknowledgment | Action and timestamp recorded |
| Unacknowledged alert | Escalation after configured timeout |
| Notification failure | Failure recorded, retry applied |
| Resolution | Marked resolved, history preserved |
| Sandbox preview | Alert count matches a re-run of the saved rules on the same 24 hours |
| Event playback | Window shows five minutes before and after the event |
| Dashboard reconnect | State restored from persistent data |

Evaluation covers functional correctness, update latency, alert-generation latency, validation accuracy, notification-workflow reliability, and history completeness. Performance targets are set and measured on the actual demo machine. Automated tests (Pytest and API tests) use fixed seeds and the small fixtures in `tests/fixtures/` so results are repeatable.

---

## 12. Implementation Roadmap

**Phase 1: Functional Monitoring MVP**

- FastAPI backend and SQLite database.
- Patient profiles and measurement ingestion.
- Configurable synthetic simulator.
- React dashboard with live readings and WebSocket updates.
- Threshold evaluation and explainable alerts.

**Phase 2: Caregiver Response Workflow**

- Acknowledgment, resolution, and shift notes.
- SOS mechanism and the emergency action drawer.
- Simulated notifications, timeouts, and escalation.
- Persisted notification attempts and caregiver actions.

**Phase 3: Reliability and Intelligence**

- Invalid-data and stale-reading detection.
- Simulated edge-device health monitor.
- Dataset import and replay adapter.
- Historical charts, time-travel playback, and threshold sandbox.
- Persistence and trend rules.
- Deterministic scenario replay and automated tests.

**Phase 4: Collaboration and Reporting**

- Live presence and claim-and-lock.
- Daily summary card and heatmap.
- CSV/PDF reports.
- Accessibility improvements.

**Phase 5: Optional Extensions**

- Real email/SMS provider.
- Authentication and role-based access control for deployment.
- ESP32 and MQTT integration.
- Medication reminders and baseline analysis.
- Mobile-friendly or progressive web app.

**Suggested first build:** start with the real-time dashboard and alert pipeline (Phase 1), then add the emergency action drawer and acknowledgment flow (Phase 2). Time-travel playback follows once readings and alerts are stored reliably, since it depends on that history.

---

## 13. Scope and Limitations

- The first version is fully software-based and needs no ESP32 or sensors.
- Device telemetry, notifications, and emergency contact are simulated unless a verified integration is configured.
- Public datasets are used only for demonstration and testing, not to train or validate a medical model.
- Trend-aware monitoring uses transparent rules, not clinically validated AI. Any future predictive model would need clinical datasets, independent evaluation, and validation first.
- The system does not diagnose disease, recommend treatment, guarantee delivery of notifications, or replace professional medical care.
- Threshold values are demonstration settings, not universal medical limits.

---

## 14. Deliverables

1. Working software-only SmartCare application.
2. Configurable deterministic simulator, dataset replay adapter, and scenario replay.
3. Manual measurement-entry interface.
4. Live caregiver dashboard with patient profiles and history.
5. Configurable threshold engine with the sandbox preview.
6. Explainable alerts and trend-aware monitoring.
7. Data-quality, stale-reading, and device-health detection.
8. SOS workflow with acknowledgment, resolution, and escalation.
9. Emergency action drawer, presence, and claim-and-lock collaboration.
10. Time-travel event playback and daily summary heatmap.
11. Simulated email/SMS notifications with history.
12. Persistent database and audit trail.
13. Dataset documentation (`data/README.md`) with sources, versions, and licenses.
14. API documentation, setup instructions, and database documentation.
15. Automated test suite.
16. Documentation of safety limitations and future hardware integration.

---

## 15. Differentiators

- **Software-first affordability:** a complete demo without sensors.
- **Closed-loop caregiver workflow:** acknowledgment, notes, escalation, and resolution are recorded.
- **Explainable alerts:** each shows the measurement and rule that triggered it.
- **Investigation tools:** event playback and a safe threshold sandbox.
- **Team coordination:** live presence and claim-and-lock avoid duplicate work.
- **Independent SOS:** works even when readings look normal.
- **Data-quality awareness:** missing or stale data is never mistaken for normal health.
- **Realistic yet reproducible data:** seeded synthetic scenarios plus optional public-dataset replay.
- **IoT readiness:** device health monitoring and a standard ingestion interface.
