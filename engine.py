import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from database import get_db, log_audit_event
from notifications import notification_service

logger = logging.getLogger("carebeat.engine")

class AlertRulesEngine:
    def __init__(self, config_path: str = "config.json"):
        self.config = {}
        if os.path.exists(config_path):
            try:
                with open(config_path, "r") as f:
                    self.config = json.load(f)
            except Exception:
                pass

        self.false_alarm_seconds = self.config.get("false_alarm_seconds", 5)
        self.offline_alert_seconds = self.config.get("offline_alert_seconds", 120)
        self.escalation_timeout_seconds = self.config.get("escalation_timeout_seconds", 120)

        # In-memory tracking
        # patient_id -> {"hr": count, "temp": count, "spo2": count}
        self.consecutive_breaches: Dict[str, Dict[str, int]] = {}
        # patient_id -> list of (timestamp_float, hr) for trend detection (last 60s)
        self.hr_history: Dict[str, List[Tuple[float, float]]] = {}
        # patient_id -> last_reading_time_float
        self.last_seen: Dict[str, float] = {}
        # alert_id -> created_time_float
        self.active_alert_timers: Dict[str, float] = {}

        # Evaluation metrics counters
        self.alerts_raised_count = {"Warning": 0, "Critical": 0}
        self.alerts_suppressed_count = 0
        self.sensor_errors_quarantined_count = 0

    def validate_reading(self, reading: Dict[str, Any]) -> Tuple[bool, str]:
        """Validates reading for physically impossible values."""
        hr = reading.get("heart_rate")
        temp = reading.get("temperature")
        spo2 = reading.get("spo2")

        if hr is not None and (hr < 20 or hr > 250):
            return False, f"Impossible heart rate: {hr} BPM (valid range: 20-250)"
        if temp is not None and (temp < 30.0 or temp > 45.0):
            return False, f"Impossible temperature: {temp} °C (valid range: 30.0-45.0)"
        if spo2 is not None and (spo2 < 50.0 or spo2 > 100.0):
            return False, f"Impossible SpO2: {spo2} % (valid range: 50.0-100.0)"

        return True, "valid"

    async def process_measurement(self, measurement: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        patient_id = measurement["patient_id"]
        now = datetime.now()
        now_ts = now.timestamp()
        now_iso = now.isoformat()
        self.last_seen[patient_id] = now_ts

        # 1. Validation check
        is_valid, reason = self.validate_reading(measurement)
        conn = get_db()
        cursor = conn.cursor()

        if not is_valid:
            self.sensor_errors_quarantined_count += 1
            # Save as quarantined in DB
            cursor.execute("""
                INSERT INTO measurements (measurement_id, patient_id, heart_rate, temperature, spo2, systolic_bp, diastolic_bp, fall_detected, data_accuracy, timestamp, source, validation_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'quarantined')
            """, (
                measurement.get("measurement_id", f"m_{int(now_ts*1000)}"),
                patient_id, measurement.get("heart_rate"), measurement.get("temperature"),
                measurement.get("spo2"), measurement.get("systolic_bp"), measurement.get("diastolic_bp"),
                measurement.get("fall_detected", 0), measurement.get("data_accuracy", 0.0),
                measurement.get("timestamp", now_iso), measurement.get("source", "simulator")
            ))
            conn.commit()
            conn.close()
            logger.warning(f"Quarantined reading for {patient_id}: {reason}")
            return None

        # Record valid reading
        meas_id = measurement.get("measurement_id", f"m_{int(now_ts*1000)}")
        cursor.execute("""
            INSERT INTO measurements (measurement_id, patient_id, heart_rate, temperature, spo2, systolic_bp, diastolic_bp, fall_detected, data_accuracy, timestamp, source, validation_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'valid')
        """, (
            meas_id, patient_id, measurement.get("heart_rate"), measurement.get("temperature"),
            measurement.get("spo2"), measurement.get("systolic_bp"), measurement.get("diastolic_bp"),
            measurement.get("fall_detected", 0), measurement.get("data_accuracy", 100.0),
            measurement.get("timestamp", now_iso), measurement.get("source", "simulator")
        ))
        conn.commit()

        # Fetch patient profile and threshold config
        cursor.execute("SELECT * FROM patients WHERE patient_id = ?", (patient_id,))
        patient = cursor.fetchone()
        if not patient:
            conn.close()
            return None

        cursor.execute("SELECT * FROM threshold_configs WHERE patient_id = ? ORDER BY version DESC LIMIT 1", (patient_id,))
        thresh = cursor.fetchone()
        conn.close()

        # 2. Fall detection check (bypasses false alarm filter)
        if measurement.get("fall_detected") == 1:
            alert = await self._create_alert(
                patient_id=patient_id,
                measurement_id=meas_id,
                alert_type="fall",
                severity="Critical",
                explanation=f"High Impact / Fall Event Detected for {patient['name']}! Immediate emergency attention required."
            )
            return alert

        # 3. Trend spike check: HR rise > 25 BPM in 30 seconds
        hr = measurement.get("heart_rate")
        if hr is not None:
            if patient_id not in self.hr_history:
                self.hr_history[patient_id] = []
            self.hr_history[patient_id].append((now_ts, hr))
            # Keep only last 35 seconds
            self.hr_history[patient_id] = [(t, v) for (t, v) in self.hr_history[patient_id] if now_ts - t <= 35]

            # Check earliest reading in window
            earliest = min(self.hr_history[patient_id], key=lambda x: x[0])
            if (now_ts - earliest[0]) >= 10 and (hr - earliest[1]) >= 25:
                # Spike detected
                alert = await self._create_alert(
                    patient_id=patient_id,
                    measurement_id=meas_id,
                    alert_type="trend",
                    severity="Warning",
                    explanation=f"Rapid heart rate spike: increased by +{round(hr - earliest[1])} BPM in {round(now_ts - earliest[0])}s (from {round(earliest[1])} to {round(hr)} BPM)."
                )
                if alert:
                    return alert

        # 4. Threshold checks with consecutive seconds false-alarm filter
        if thresh:
            temp = measurement.get("temperature")
            spo2 = measurement.get("spo2")

            if patient_id not in self.consecutive_breaches:
                self.consecutive_breaches[patient_id] = {"hr": 0, "temp": 0, "spo2": 0}

            breaches = []

            # HR check
            if hr is not None:
                if hr >= thresh["hr_crit_high"] or hr <= thresh["hr_crit_low"]:
                    self.consecutive_breaches[patient_id]["hr"] += 1
                    breaches.append(("hr", "Critical", f"Heart rate critical: {round(hr)} BPM is outside critical range ({thresh['hr_crit_low']}-{thresh['hr_crit_high']} BPM) for {thresh['profile_name']} profile."))
                elif hr >= thresh["hr_warn_high"] or hr <= thresh["hr_warn_low"]:
                    self.consecutive_breaches[patient_id]["hr"] += 1
                    breaches.append(("hr", "Warning", f"Heart rate warning: {round(hr)} BPM is outside warning range ({thresh['hr_warn_low']}-{thresh['hr_warn_high']} BPM) for {thresh['profile_name']} profile."))
                else:
                    self.consecutive_breaches[patient_id]["hr"] = 0

            # Temp check
            if temp is not None:
                if temp >= thresh["temp_crit"]:
                    self.consecutive_breaches[patient_id]["temp"] += 1
                    breaches.append(("temp", "Critical", f"Body temperature critical: {round(temp, 1)}°C exceeds critical limit of {thresh['temp_crit']}°C for {thresh['profile_name']} profile."))
                elif temp >= thresh["temp_warn"]:
                    self.consecutive_breaches[patient_id]["temp"] += 1
                    breaches.append(("temp", "Warning", f"Body temperature warning: {round(temp, 1)}°C exceeds warning limit of {thresh['temp_warn']}°C for {thresh['profile_name']} profile."))
                else:
                    self.consecutive_breaches[patient_id]["temp"] = 0

            # SpO2 check
            if spo2 is not None:
                if spo2 <= thresh["spo2_crit"]:
                    self.consecutive_breaches[patient_id]["spo2"] += 1
                    breaches.append(("spo2", "Critical", f"SpO2 oxygen saturation critical: {round(spo2)}% is at or below critical threshold of {thresh['spo2_crit']}%."))
                elif spo2 <= thresh["spo2_warn"]:
                    self.consecutive_breaches[patient_id]["spo2"] += 1
                    breaches.append(("spo2", "Warning", f"SpO2 oxygen saturation warning: {round(spo2)}% is below warning threshold of {thresh['spo2_warn']}%."))
                else:
                    self.consecutive_breaches[patient_id]["spo2"] = 0

            # Evaluate false-alarm filtering
            for vital_key, severity, expl in breaches:
                consecutive = self.consecutive_breaches[patient_id][vital_key]
                if consecutive < self.false_alarm_seconds:
                    self.alerts_suppressed_count += 1
                    logger.debug(f"Suppressed {vital_key} alert for {patient_id}: sustained for {consecutive}s (< {self.false_alarm_seconds}s)")
                else:
                    # Sustained for >= N consecutive seconds -> trigger alert
                    alert = await self._create_alert(
                        patient_id=patient_id,
                        measurement_id=meas_id,
                        alert_type="threshold",
                        severity=severity,
                        explanation=expl
                    )
                    if alert:
                        return alert

        return None

    async def _create_alert(
        self,
        patient_id: str,
        measurement_id: Optional[str],
        alert_type: str,
        severity: str,
        explanation: str
    ) -> Optional[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()

        # Check cooldown: don't recreate identical active alert if one exists within 30s
        cursor.execute("""
            SELECT * FROM alerts
            WHERE patient_id = ? AND alert_type = ? AND state IN ('Active', 'Escalated')
            ORDER BY created_at DESC LIMIT 1
        """, (patient_id, alert_type))
        existing = cursor.fetchone()
        if existing:
            # Check elapsed seconds
            try:
                created_dt = datetime.fromisoformat(existing["created_at"])
                if (datetime.now() - created_dt).total_seconds() < 25:
                    conn.close()
                    return None
            except Exception:
                pass

        alert_id = f"alt_{int(datetime.now().timestamp()*1000)}"
        now_iso = datetime.now().isoformat()

        cursor.execute("""
            INSERT INTO alerts (alert_id, patient_id, measurement_id, alert_type, severity, explanation, state, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'Active', ?)
        """, (alert_id, patient_id, measurement_id, alert_type, severity, explanation, now_iso))
        conn.commit()

        # Update metrics
        if severity in self.alerts_raised_count:
            self.alerts_raised_count[severity] += 1

        self.active_alert_timers[alert_id] = datetime.now().timestamp()

        # Get patient name
        cursor.execute("SELECT name FROM patients WHERE patient_id = ?", (patient_id,))
        p = cursor.fetchone()
        p_name = p["name"] if p else patient_id
        conn.close()

        # Trigger notification routing
        await notification_service.send_alert_notification(
            alert_id=alert_id,
            patient_id=patient_id,
            patient_name=p_name,
            severity=severity,
            explanation=explanation,
            escalated=False
        )

        log_audit_event("ALERT_TRIGGERED", actor="AlertRulesEngine", patient_id=patient_id, new_val=f"{severity}: {explanation}")

        return {
            "alert_id": alert_id,
            "patient_id": patient_id,
            "patient_name": p_name,
            "alert_type": alert_type,
            "severity": severity,
            "explanation": explanation,
            "state": "Active",
            "created_at": now_iso
        }

    async def trigger_sos(self, patient_id: str, reason: str = "Patient SOS Button Triggered") -> Dict[str, Any]:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM patients WHERE patient_id = ?", (patient_id,))
        p = cursor.fetchone()
        p_name = p["name"] if p else patient_id
        conn.close()

        alert_id = f"sos_{int(datetime.now().timestamp()*1000)}"
        now_iso = datetime.now().isoformat()
        expl = f"EMERGENCY SOS: Help requested by {p_name}! ({reason})"

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO alerts (alert_id, patient_id, alert_type, severity, explanation, state, created_at)
            VALUES (?, ?, 'sos', 'Critical', ?, 'Active', ?)
        """, (alert_id, patient_id, expl, now_iso))
        conn.commit()
        conn.close()

        self.alerts_raised_count["Critical"] += 1
        self.active_alert_timers[alert_id] = datetime.now().timestamp()

        await notification_service.send_alert_notification(
            alert_id=alert_id,
            patient_id=patient_id,
            patient_name=p_name,
            severity="Critical",
            explanation=expl,
            escalated=False
        )
        log_audit_event("SOS_TRIGGERED", actor=f"Patient:{patient_id}", patient_id=patient_id, new_val=expl)

        return {
            "alert_id": alert_id,
            "patient_id": patient_id,
            "patient_name": p_name,
            "alert_type": "sos",
            "severity": "Critical",
            "explanation": expl,
            "state": "Active",
            "created_at": now_iso
        }

    async def check_escalations_and_offline(self) -> List[Dict[str, Any]]:
        """Periodic background task to check unacknowledged alert escalation and offline devices."""
        now_ts = datetime.now().timestamp()
        escalated_alerts = []

        # 1. Check escalation timeout
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM alerts WHERE state = 'Active'")
        active_alerts = cursor.fetchall()

        for alt in active_alerts:
            alert_id = alt["alert_id"]
            created_ts = datetime.fromisoformat(alt["created_at"]).timestamp()
            elapsed = now_ts - created_ts

            if elapsed >= self.escalation_timeout_seconds:
                # Escalate
                now_iso = datetime.now().isoformat()
                cursor.execute("""
                    UPDATE alerts SET state = 'Escalated', escalated_at = ?
                    WHERE alert_id = ?
                """, (now_iso, alert_id))
                conn.commit()

                # Get patient name
                cursor.execute("SELECT name FROM patients WHERE patient_id = ?", (alt["patient_id"],))
                p = cursor.fetchone()
                p_name = p["name"] if p else alt["patient_id"]

                # Send escalation notification
                await notification_service.send_alert_notification(
                    alert_id=alert_id,
                    patient_id=alt["patient_id"],
                    patient_name=p_name,
                    severity=alt["severity"],
                    explanation=f"ESCALATION: Unacknowledged after {round(elapsed)}s. {alt['explanation']}",
                    escalated=True
                )
                log_audit_event("ALERT_ESCALATED", actor="EscalationScheduler", patient_id=alt["patient_id"], new_val=f"Escalated to secondary family contact: {alert_id}")
                escalated_alerts.append({"alert_id": alert_id, "patient_id": alt["patient_id"], "state": "Escalated"})

        # 2. Check offline devices (>120s without reading)
        cursor.execute("SELECT patient_id, name FROM patients")
        all_patients = cursor.fetchall()
        for p in all_patients:
            pid = p["patient_id"]
            last = self.last_seen.get(pid)
            if last and (now_ts - last) >= self.offline_alert_seconds:
                # Check if offline alert already exists
                cursor.execute("""
                    SELECT * FROM alerts
                    WHERE patient_id = ? AND alert_type = 'offline' AND state IN ('Active', 'Escalated')
                """, (pid,))
                if not cursor.fetchone():
                    # Fire device offline alert
                    alt_id = f"off_{int(now_ts*1000)}"
                    now_iso = datetime.now().isoformat()
                    expl = f"Device offline alert: No vital reading received from {p['name']} for > {self.offline_alert_seconds}s."
                    cursor.execute("""
                        INSERT INTO alerts (alert_id, patient_id, alert_type, severity, explanation, state, created_at)
                        VALUES (?, ?, 'offline', 'Critical', ?, 'Active', ?)
                    """, (alt_id, pid, expl, now_iso))
                    conn.commit()

                    await notification_service.send_alert_notification(
                        alert_id=alt_id,
                        patient_id=pid,
                        patient_name=p["name"],
                        severity="Critical",
                        explanation=expl,
                        escalated=False
                    )
                    log_audit_event("DEVICE_OFFLINE", actor="AlertRulesEngine", patient_id=pid, new_val=expl)

        conn.close()
        return escalated_alerts

    def calculate_health_score(self, patient_id: str) -> Dict[str, Any]:
        """Calculates rule-based Health Score (0-100) with full breakdown transparency."""
        conn = get_db()
        cursor = conn.cursor()

        # Vitals within normal range in last hour: 50 pts
        one_hour_ago = (datetime.now() - timedelta(hours=1)).isoformat()
        cursor.execute("""
            SELECT * FROM measurements
            WHERE patient_id = ? AND timestamp >= ? AND validation_status = 'valid'
            ORDER BY timestamp DESC LIMIT 60
        """, (patient_id, one_hour_ago))
        recent_meas = cursor.fetchall()

        vitals_pts = 50
        deductions = []

        cursor.execute("SELECT * FROM threshold_configs WHERE patient_id = ? ORDER BY version DESC LIMIT 1", (patient_id,))
        thresh = cursor.fetchone()

        if recent_meas and thresh:
            abnormal_count = 0
            for m in recent_meas:
                hr = m["heart_rate"]
                temp = m["temperature"]
                spo2 = m["spo2"]
                is_abn = False
                if hr and (hr > thresh["hr_warn_high"] or hr < thresh["hr_warn_low"]):
                    is_abn = True
                if temp and (temp > thresh["temp_warn"]):
                    is_abn = True
                if spo2 and (spo2 < thresh["spo2_warn"]):
                    is_abn = True
                if is_abn:
                    abnormal_count += 1

            if abnormal_count > 0:
                fraction_bad = abnormal_count / len(recent_meas)
                penalty = min(50, round(fraction_bad * 60))
                vitals_pts = max(0, 50 - penalty)
                deductions.append(f"Vitals outside configured normal limits in recent readings: -{penalty} pts")
        elif not recent_meas:
            vitals_pts = 30
            deductions.append("No readings in last hour: -20 pts")

        # No Critical alerts in last 24h: 20 pts
        day_ago = (datetime.now() - timedelta(hours=24)).isoformat()
        cursor.execute("""
            SELECT COUNT(*) as cnt FROM alerts
            WHERE patient_id = ? AND severity = 'Critical' AND created_at >= ?
        """, (patient_id, day_ago))
        crit_count = cursor.fetchone()["cnt"]
        alert_pts = 20 if crit_count == 0 else 0
        if crit_count > 0:
            deductions.append(f"{crit_count} Critical alert(s) in last 24h: -20 pts")

        # Medicines taken on time: 20 pts
        cursor.execute("""
            SELECT status FROM medicine_logs
            WHERE patient_id = ? AND scheduled_time >= ?
        """, (patient_id, day_ago[:10]))
        med_logs = cursor.fetchall()
        medicine_pts = 20
        if med_logs:
            missed = sum(1 for m in med_logs if m["status"] == "missed")
            if missed > 0:
                medicine_pts = max(0, 20 - (missed * 10))
                deductions.append(f"{missed} Missed medicine dose(s): -{missed * 10} pts")

        # "I'm OK" check-in completed: 10 pts
        cursor.execute("""
            SELECT COUNT(*) as cnt FROM check_ins
            WHERE patient_id = ? AND timestamp >= ? AND status = 'ok'
        """, (patient_id, day_ago[:10]))
        checkin_cnt = cursor.fetchone()["cnt"]
        checkin_pts = 10 if checkin_cnt > 0 else 0
        if checkin_cnt == 0:
            deductions.append("No 'I'm OK' check-in completed today: -10 pts")

        total_score = vitals_pts + alert_pts + medicine_pts + checkin_pts
        conn.close()

        return {
            "patient_id": patient_id,
            "score": total_score,
            "breakdown": {
                "vitals_pts": vitals_pts,
                "vitals_max": 50,
                "alert_pts": alert_pts,
                "alert_max": 20,
                "medicine_pts": medicine_pts,
                "medicine_max": 20,
                "checkin_pts": checkin_pts,
                "checkin_max": 10
            },
            "deductions": deductions,
            "disclaimer": "This score reflects configured-limit compliance only. It is not a clinical health assessment."
        }

engine = AlertRulesEngine()
