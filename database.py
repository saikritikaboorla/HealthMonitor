import sqlite3
import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "carebeat.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # 1. patients
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS patients (
        patient_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        age INTEGER NOT NULL,
        condition_tags TEXT, -- JSON array of tags: ["heart patient", "high BP"]
        care_needs_tags TEXT, -- JSON array: ["medicine help", "mobility help"]
        consent INTEGER DEFAULT 1,
        consent_timestamp TEXT,
        threshold_profile_id TEXT,
        created_at TEXT
    )
    """)

    # 2. family_contacts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS family_contacts (
        contact_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        name TEXT NOT NULL,
        relation TEXT NOT NULL,
        phone_raw TEXT NOT NULL,
        phone_masked TEXT NOT NULL,
        verification_status TEXT DEFAULT 'Verified', -- 'Verified' | 'Pending'
        priority TEXT DEFAULT 'primary', -- 'primary' | 'secondary'
        FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
    )
    """)

    # 3. caregivers
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS caregivers (
        caregiver_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        skills TEXT, -- JSON array: ["medicine", "mobility"]
        shift TEXT, -- 'Morning (08:00 - 16:00)', etc.
        experience TEXT,
        fee_range TEXT,
        verification_status TEXT DEFAULT 'Pending', -- 'Verified', 'Pending', 'Rejected'
        verification_expiry TEXT,
        doc_name TEXT,
        created_at TEXT
    )
    """)

    # 4. caregiver_assignments
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS caregiver_assignments (
        assignment_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        caregiver_id TEXT NOT NULL,
        shift TEXT,
        agreed_fee TEXT,
        start_date TEXT,
        status TEXT DEFAULT 'active', -- 'active', 'ended'
        FOREIGN KEY(patient_id) REFERENCES patients(patient_id),
        FOREIGN KEY(caregiver_id) REFERENCES caregivers(caregiver_id)
    )
    """)

    # 5. fee_negotiations
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fee_negotiations (
        negotiation_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        caregiver_id TEXT NOT NULL,
        proposed_fee TEXT,
        shift TEXT,
        duties TEXT,
        status TEXT DEFAULT 'Requested', -- 'Requested', 'Negotiating', 'Agreed', 'Declined'
        timestamp TEXT
    )
    """)

    # 6. measurements
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS measurements (
        measurement_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        heart_rate REAL,
        temperature REAL,
        spo2 REAL,
        systolic_bp REAL,
        diastolic_bp REAL,
        fall_detected INTEGER DEFAULT 0,
        data_accuracy REAL DEFAULT 100.0,
        timestamp TEXT NOT NULL,
        source TEXT NOT NULL, -- 'simulator', 'dataset-replay', 'manual', 'sos', 'device'
        validation_status TEXT DEFAULT 'valid' -- 'valid', 'quarantined'
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_meas_patient_time ON measurements(patient_id, timestamp)")

    # 7. threshold_configs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS threshold_configs (
        config_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        profile_name TEXT NOT NULL,
        hr_warn_high REAL DEFAULT 110,
        hr_warn_low REAL DEFAULT 50,
        hr_crit_high REAL DEFAULT 130,
        hr_crit_low REAL DEFAULT 40,
        temp_warn REAL DEFAULT 37.8,
        temp_crit REAL DEFAULT 39.0,
        spo2_warn REAL DEFAULT 94.0,
        spo2_crit REAL DEFAULT 90.0,
        effective_from TEXT,
        version INTEGER DEFAULT 1,
        FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
    )
    """)

    # 8. alerts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        alert_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        measurement_id TEXT,
        alert_type TEXT NOT NULL, -- 'threshold', 'trend', 'sos', 'offline', 'checkin', 'fall'
        severity TEXT NOT NULL, -- 'Warning', 'Critical'
        explanation TEXT NOT NULL,
        state TEXT DEFAULT 'Active', -- 'Active', 'Acknowledged', 'Escalated', 'Resolved'
        created_at TEXT NOT NULL,
        acknowledged_at TEXT,
        acknowledged_by TEXT,
        resolved_at TEXT,
        escalated_at TEXT,
        claim_locked_by TEXT,
        claim_locked_until TEXT
    )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_alerts_patient ON alerts(patient_id, state)")

    # 9. caregiver_actions
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS caregiver_actions (
        action_id TEXT PRIMARY KEY,
        alert_id TEXT,
        caregiver_id TEXT,
        action_type TEXT NOT NULL, -- 'acknowledge', 'claim', 'note', 'resolve'
        note TEXT,
        timestamp TEXT NOT NULL
    )
    """)

    # 10. notifications
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        notification_id TEXT PRIMARY KEY,
        alert_id TEXT,
        patient_id TEXT NOT NULL,
        recipient_id TEXT,
        recipient_type TEXT NOT NULL, -- 'caregiver', 'family'
        channel TEXT NOT NULL, -- 'telegram', 'sms', 'inapp'
        status TEXT NOT NULL, -- 'Delivered', 'Attempted', 'Failed'
        sent_at TEXT NOT NULL,
        ack_at TEXT,
        latency_ms INTEGER DEFAULT 120,
        message TEXT
    )
    """)

    # 11. medicines
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS medicines (
        medicine_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        name TEXT NOT NULL,
        schedule_times TEXT NOT NULL, -- JSON array of strings e.g. ["09:00", "20:00"]
        notes TEXT
    )
    """)

    # 12. medicine_logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS medicine_logs (
        log_id TEXT PRIMARY KEY,
        medicine_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        status TEXT DEFAULT 'pending', -- 'pending', 'taken', 'missed'
        marked_by TEXT,
        marked_at TEXT,
        note TEXT
    )
    """)

    # 13. care_tasks
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS care_tasks (
        task_id TEXT PRIMARY KEY,
        assignment_id TEXT,
        patient_id TEXT NOT NULL,
        task_type TEXT NOT NULL,
        due_time TEXT NOT NULL,
        status TEXT DEFAULT 'pending' -- 'pending', 'done', 'missed'
    )
    """)

    # 14. care_logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS care_logs (
        log_id TEXT PRIMARY KEY,
        caregiver_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        date TEXT NOT NULL,
        note TEXT NOT NULL
    )
    """)

    # 15. handover_notes
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS handover_notes (
        note_id TEXT PRIMARY KEY,
        caregiver_id TEXT NOT NULL,
        patient_id TEXT NOT NULL,
        shift TEXT NOT NULL,
        condition_on_arrival TEXT,
        tasks_completed TEXT,
        concerns TEXT,
        created_at TEXT NOT NULL
    )
    """)

    # 16. check_ins
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS check_ins (
        checkin_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        status TEXT DEFAULT 'ok' -- 'ok', 'missed'
    )
    """)

    # 17. audit_events
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_events (
        event_id TEXT PRIMARY KEY,
        patient_id TEXT,
        event_type TEXT NOT NULL,
        actor TEXT NOT NULL,
        old_value_masked TEXT,
        new_value_masked TEXT,
        timestamp TEXT NOT NULL
    )
    """)

    # 18. health_scores
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS health_scores (
        score_id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        date TEXT NOT NULL,
        score INTEGER NOT NULL,
        vitals_pts INTEGER NOT NULL,
        alert_pts INTEGER NOT NULL,
        medicine_pts INTEGER NOT NULL,
        checkin_pts INTEGER NOT NULL
    )
    """)

    conn.commit()
    conn.close()

def log_audit_event(event_type: str, actor: str, patient_id: Optional[str] = None, old_val: Optional[str] = None, new_val: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO audit_events (event_id, patient_id, event_type, actor, old_value_masked, new_value_masked, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (f"aud_{int(datetime.now().timestamp()*1000)}", patient_id, event_type, actor, old_val, new_val, datetime.now().isoformat())
    )
    conn.commit()
    conn.close()
