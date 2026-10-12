import json
import math
import random
from datetime import datetime, timedelta
from database import get_db, init_db, log_audit_event
from notifications import mask_phone

def seed():
    print("Initializing database...")
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    # Clear existing demo data
    tables = [
        "patients", "family_contacts", "caregivers", "caregiver_assignments",
        "fee_negotiations", "measurements", "threshold_configs", "alerts",
        "caregiver_actions", "notifications", "medicines", "medicine_logs",
        "care_tasks", "care_logs", "handover_notes", "check_ins", "audit_events", "health_scores"
    ]
    for tbl in tables:
        cursor.execute(f"DELETE FROM {tbl}")
    conn.commit()

    now = datetime.now()
    now_iso = now.isoformat()

    print("Seeding demo patients...")
    patients_data = [
        {
            "id": "p1", "name": "Demo Patient A", "age": 72,
            "condition_tags": ["heart patient"],
            "care_needs_tags": ["medicine help", "mobility help"],
            "consent_ts": (now - timedelta(days=30)).isoformat(),
            "profile_name": "Heart patient",
            "thresholds": {"hr_warn_h": 100, "hr_warn_l": 50, "hr_crit_h": 120, "hr_crit_l": 40, "temp_w": 37.8, "temp_c": 38.5, "spo2_w": 94, "spo2_c": 90},
            "contacts": [
                {"id": "fc_1a", "name": "Rahul Sharma", "rel": "Son", "phone": "+91 9876543210", "pri": "primary"},
                {"id": "fc_1b", "name": "Meera Sharma", "rel": "Daughter-in-law", "phone": "+91 9876543211", "pri": "secondary"}
            ],
            "meds": [
                {"id": "med_1a", "name": "Metoprolol (Beta Blocker)", "times": ["09:00", "21:00"], "notes": "Take with breakfast/dinner"},
                {"id": "med_1b", "name": "Aspirin 75mg", "times": ["13:00"], "notes": "After lunch"}
            ],
            "tasks": [
                {"id": "ct_1a", "type": "Morning cardiac medication", "time": "09:00"},
                {"id": "ct_1b", "type": "Assisted 15m walk", "time": "11:30"},
                {"id": "ct_1c", "type": "Mid-day BP check", "time": "14:00"}
            ]
        },
        {
            "id": "p2", "name": "Demo Patient B", "age": 68,
            "condition_tags": ["high BP"],
            "care_needs_tags": ["diet help", "medicine help"],
            "consent_ts": (now - timedelta(days=20)).isoformat(),
            "profile_name": "High BP",
            "thresholds": {"hr_warn_h": 110, "hr_warn_l": 50, "hr_crit_h": 130, "hr_crit_l": 40, "temp_w": 37.8, "temp_c": 39.0, "spo2_w": 94, "spo2_c": 90},
            "contacts": [
                {"id": "fc_2a", "name": "Sunita Verma", "rel": "Daughter", "phone": "+91 9811122233", "pri": "primary"},
                {"id": "fc_2b", "name": "Anil Verma", "rel": "Brother", "phone": "+91 9811122234", "pri": "secondary"}
            ],
            "meds": [
                {"id": "med_2a", "name": "Amlodipine 5mg", "times": ["08:00"], "notes": "Morning empty stomach"},
                {"id": "med_2b", "name": "Losartan 50mg", "times": ["20:00"], "notes": "Night dose"}
            ],
            "tasks": [
                {"id": "ct_2a", "type": "Low-sodium meal served", "time": "08:30"},
                {"id": "ct_2b", "type": "Fluids offered (Water/Coconut water)", "time": "12:00"},
                {"id": "ct_2c", "type": "Evening relaxation & vitals check", "time": "18:00"}
            ]
        },
        {
            "id": "p3", "name": "Demo Patient C", "age": 74,
            "condition_tags": ["diabetic"],
            "care_needs_tags": ["diet help", "medicine help", "night monitoring"],
            "consent_ts": (now - timedelta(days=15)).isoformat(),
            "profile_name": "Diabetic",
            "thresholds": {"hr_warn_h": 110, "hr_warn_l": 50, "hr_crit_h": 130, "hr_crit_l": 40, "temp_w": 37.8, "temp_c": 39.0, "spo2_w": 94, "spo2_c": 90},
            "contacts": [
                {"id": "fc_3a", "name": "Ramesh Patel", "rel": "Son", "phone": "+91 9822233344", "pri": "primary"},
                {"id": "fc_3b", "name": "Kavita Patel", "rel": "Daughter", "phone": "+91 9822233345", "pri": "secondary"}
            ],
            "meds": [
                {"id": "med_3a", "name": "Metformin 500mg", "times": ["08:30", "20:30"], "notes": "With meals"}
            ],
            "tasks": [
                {"id": "ct_3a", "type": "Glucose check after breakfast", "time": "09:30"},
                {"id": "ct_3b", "type": "Foot inspection for cuts", "time": "15:00"},
                {"id": "ct_3c", "type": "Bedtime vitals check", "time": "21:30"}
            ]
        },
        {
            "id": "p4", "name": "Demo Patient D", "age": 80,
            "condition_tags": ["none"],
            "care_needs_tags": ["mobility help"],
            "consent_ts": (now - timedelta(days=10)).isoformat(),
            "profile_name": "Default elderly",
            "thresholds": {"hr_warn_h": 110, "hr_warn_l": 50, "hr_crit_h": 130, "hr_crit_l": 40, "temp_w": 37.8, "temp_c": 39.0, "spo2_w": 94, "spo2_c": 90},
            "contacts": [
                {"id": "fc_4a", "name": "Vikram Singh", "rel": "Son", "phone": "+91 9833344455", "pri": "primary"},
                {"id": "fc_4b", "name": "Pooja Singh", "rel": "Granddaughter", "phone": "+91 9833344456", "pri": "secondary"}
            ],
            "meds": [
                {"id": "med_4a", "name": "Calcium + Vitamin D3", "times": ["10:00"], "notes": "With warm milk"}
            ],
            "tasks": [
                {"id": "ct_4a", "type": "Morning mobility exercises", "time": "10:30"},
                {"id": "ct_4b", "type": "Afternoon hydration check", "time": "15:00"}
            ]
        }
    ]

    for p in patients_data:
        cursor.execute("""
            INSERT INTO patients (patient_id, name, age, condition_tags, care_needs_tags, consent, consent_timestamp, threshold_profile_id, created_at)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
        """, (
            p["id"], p["name"], p["age"], json.dumps(p["condition_tags"]), json.dumps(p["care_needs_tags"]),
            p["consent_ts"], f"tc_{p['id']}", p["consent_ts"]
        ))

        # Threshold config
        th = p["thresholds"]
        cursor.execute("""
            INSERT INTO threshold_configs (config_id, patient_id, profile_name, hr_warn_high, hr_warn_low, hr_crit_high, hr_crit_low, temp_warn, temp_crit, spo2_warn, spo2_crit, effective_from, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        """, (
            f"tc_{p['id']}", p["id"], p["profile_name"], th["hr_warn_h"], th["hr_warn_l"], th["hr_crit_h"], th["hr_crit_l"],
            th["temp_w"], th["temp_c"], th["spo2_w"], th["spo2_c"], p["consent_ts"]
        ))

        # Contacts
        for c in p["contacts"]:
            cursor.execute("""
                INSERT INTO family_contacts (contact_id, patient_id, name, relation, phone_raw, phone_masked, verification_status, priority)
                VALUES (?, ?, ?, ?, ?, ?, 'Verified', ?)
            """, (c["id"], p["id"], c["name"], c["rel"], c["phone"], mask_phone(c["phone"]), c["pri"]))

        # Meds and logs
        for m in p["meds"]:
            cursor.execute("""
                INSERT INTO medicines (medicine_id, patient_id, name, schedule_times, notes)
                VALUES (?, ?, ?, ?, ?)
            """, (m["id"], p["id"], m["name"], json.dumps(m["times"]), m["notes"]))

            # Medicine logs for today
            for tm in m["times"]:
                cursor.execute("""
                    INSERT INTO medicine_logs (log_id, medicine_id, patient_id, scheduled_time, status, marked_by, marked_at, note)
                    VALUES (?, ?, ?, ?, 'taken', 'Priya (Caregiver)', ?, 'Taken on schedule with water')
                """, (f"ml_{m['id']}_{tm.replace(':', '')}", m["id"], p["id"], f"{now.strftime('%Y-%m-%d')} {tm}", now_iso))

        # Tasks
        for t in p["tasks"]:
            cursor.execute("""
                INSERT INTO care_tasks (task_id, assignment_id, patient_id, task_type, due_time, status)
                VALUES (?, 'asg_1', ?, ?, ?, 'pending')
            """, (t["id"], p["id"], t["type"], f"{now.strftime('%Y-%m-%d')} {t['time']}"))

        # Daily Check-in
        cursor.execute("""
            INSERT INTO check_ins (checkin_id, patient_id, timestamp, status)
            VALUES (?, ?, ?, 'ok')
        """, (f"ci_{p['id']}", p["id"], now_iso))

    print("Seeding demo caregivers...")
    cursor.execute("""
        INSERT INTO caregivers (caregiver_id, name, phone, skills, shift, experience, fee_range, verification_status, verification_expiry, doc_name, created_at)
        VALUES ('cg_1', 'Priya Nair', '+91 9844455566', ?, 'Morning (08:00 - 16:00)', '6 years elderly & cardiac care', '₹18,000 - ₹22,000 / month', 'Verified', '2027-12-31', 'priya_nair_nursing_cert.pdf', ?)
    """, (json.dumps(["medicine help", "mobility help", "diet help"]), (now - timedelta(days=60)).isoformat()))

    cursor.execute("""
        INSERT INTO caregivers (caregiver_id, name, phone, skills, shift, experience, fee_range, verification_status, verification_expiry, doc_name, created_at)
        VALUES ('cg_2', 'Amit Kumar', '+91 9855566677', ?, 'Night (20:00 - 08:00)', '3 years home attendant', '₹16,000 - ₹20,000 / month', 'Pending', NULL, 'amit_kumar_id_proof.pdf', ?)
    """, (json.dumps(["night monitoring", "mobility help"]), (now - timedelta(days=10)).isoformat()))

    print("Seeding caregiver assignments...")
    cursor.execute("""
        INSERT INTO caregiver_assignments (assignment_id, patient_id, caregiver_id, shift, agreed_fee, start_date, status)
        VALUES ('asg_1', 'p1', 'cg_1', 'Morning (08:00 - 16:00)', '₹20,000 / month', '2026-09-01', 'active')
    """)
    cursor.execute("""
        INSERT INTO caregiver_assignments (assignment_id, patient_id, caregiver_id, shift, agreed_fee, start_date, status)
        VALUES ('asg_2', 'p2', 'cg_1', 'Morning (08:00 - 16:00)', '₹19,000 / month', '2026-09-15', 'active')
    """)
    cursor.execute("""
        INSERT INTO caregiver_assignments (assignment_id, patient_id, caregiver_id, shift, agreed_fee, start_date, status)
        VALUES ('asg_3', 'p3', 'cg_2', 'Night (20:00 - 08:00)', '₹17,000 / month', '2026-09-20', 'active')
    """)
    cursor.execute("""
        INSERT INTO caregiver_assignments (assignment_id, patient_id, caregiver_id, shift, agreed_fee, start_date, status)
        VALUES ('asg_4', 'p4', 'cg_2', 'Night (20:00 - 08:00)', '₹16,000 / month', '2026-09-20', 'active')
    """)

    print("Seeding fee negotiations...")
    cursor.execute("""
        INSERT INTO fee_negotiations (negotiation_id, patient_id, caregiver_id, proposed_fee, shift, duties, status, timestamp)
        VALUES ('neg_1', 'p1', 'cg_1', '₹20,000 / month', 'Morning (08:00 - 16:00)', 'Vitals check, medication, daily walk', 'Agreed', ?)
    """, ((now - timedelta(days=40)).isoformat(),))
    cursor.execute("""
        INSERT INTO fee_negotiations (negotiation_id, patient_id, caregiver_id, proposed_fee, shift, duties, status, timestamp)
        VALUES ('neg_2', 'p3', 'cg_2', '₹17,000 / month', 'Night (20:00 - 08:00)', 'Night glucose monitoring, assist with bathroom', 'Negotiating', ?)
    """, ((now - timedelta(days=2)).isoformat(),))

    print("Seeding handover notes & daily care logs...")
    cursor.execute("""
        INSERT INTO handover_notes (note_id, caregiver_id, patient_id, shift, condition_on_arrival, tasks_completed, concerns, created_at)
        VALUES ('hn_1', 'cg_1', 'p1', 'Morning', 'Patient alert and cheerful, slept 7 hours peacefully.', 'Morning medication administered, assisted 15m garden walk, light oatmeal breakfast.', 'Slight stiffness in left knee noted during morning walk, offered warm compression.', ?)
    """, (now_iso,))

    cursor.execute("""
        INSERT INTO care_logs (log_id, caregiver_id, patient_id, date, note)
        VALUES ('cl_1', 'cg_1', 'p1', ?, 'Patient in high spirits today. BP stable at 122/80 after morning walk. Well hydrated.')
    """, (now.strftime('%Y-%m-%d'),))

    print("Seeding initial historical measurements...")
    # Seed 30 recent measurements for each patient so charts have lines immediately
    for p in patients_data:
        pid = p["id"]
        base_hr = 75 if pid == "p1" else (80 if pid == "p2" else (72 if pid == "p3" else 70))
        base_temp = 36.6 if pid == "p1" else (36.8 if pid == "p2" else (37.0 if pid == "p3" else 36.5))
        base_spo2 = 98 if pid in ["p1", "p4"] else 97

        for i in range(30, 0, -1):
            t_offset = now - timedelta(seconds=i*3)
            hr = base_hr + 3 * math.sin(i / 5.0) + random.uniform(-1.5, 1.5)
            temp = base_temp + 0.1 * math.sin(i / 10.0) + random.uniform(-0.05, 0.05)
            spo2 = min(100, base_spo2 + random.uniform(-0.8, 0.5))
            sys_bp = 120 + random.uniform(-3, 3) if pid != "p2" else 145 + random.uniform(-4, 4)
            dia_bp = 80 + random.uniform(-2, 2) if pid != "p2" else 92 + random.uniform(-3, 3)

            cursor.execute("""
                INSERT INTO measurements (measurement_id, patient_id, heart_rate, temperature, spo2, systolic_bp, diastolic_bp, fall_detected, data_accuracy, timestamp, source, validation_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, 98.5, ?, 'simulator', 'valid')
            """, (
                f"init_{pid}_{i}", pid, round(hr), round(temp, 1), round(spo2),
                round(sys_bp), round(dia_bp), t_offset.isoformat()
            ))

    conn.commit()
    conn.close()

    log_audit_event("SYSTEM_SEED", actor="seed.py", new_val="Populated demo patients, caregivers, medicines, and threshold configs")
    print("Seed complete! CareBeat database successfully initialized.")

if __name__ == "__main__":
    seed()
