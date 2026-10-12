import os
import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List
import httpx
from database import get_db

logger = logging.getLogger("carebeat.notifications")

def mask_phone(phone: str) -> str:
    cleaned = phone.strip()
    if len(cleaned) < 6:
        return "XXXXXX"
    prefix = cleaned[:5] if len(cleaned) >= 8 else cleaned[:2]
    suffix = cleaned[-2:]
    return f"{prefix}XXXXXX{suffix}"

class NotificationService:
    def __init__(self, config_path: str = "config.json"):
        self.config = {}
        if os.path.exists(config_path):
            try:
                with open(config_path, "r") as f:
                    self.config = json.load(f)
            except Exception as e:
                logger.error(f"Error loading config.json: {e}")
        self.simulated_sms_inbox: List[Dict[str, Any]] = []

    def get_telegram_token(self) -> Optional[str]:
        return os.environ.get("TELEGRAM_BOT_TOKEN") or self.config.get("TELEGRAM_BOT_TOKEN")

    def get_patient_chat_id(self, patient_id: str) -> Optional[str]:
        p_cfg = self.config.get("patients", {}).get(patient_id, {})
        return p_cfg.get("telegram_chat_id")

    async def send_alert_notification(
        self,
        alert_id: str,
        patient_id: str,
        patient_name: str,
        severity: str,
        explanation: str,
        escalated: bool = False
    ) -> List[Dict[str, Any]]:
        conn = get_db()
        cursor = conn.cursor()

        # Get family contacts
        cursor.execute("SELECT * FROM family_contacts WHERE patient_id = ?", (patient_id,))
        contacts = cursor.fetchall()

        # Get assigned caregiver
        cursor.execute("""
            SELECT c.* FROM caregivers c
            JOIN caregiver_assignments ca ON c.caregiver_id = ca.caregiver_id
            WHERE ca.patient_id = ? AND ca.status = 'active'
        """, (patient_id,))
        caregiver = cursor.fetchone()

        deliveries = []
        now_iso = datetime.now().isoformat()
        token = self.get_telegram_token()
        chat_id = self.get_patient_chat_id(patient_id)

        msg_body = f"[{severity.upper()}{' - ESCALATED' if escalated else ''}] CareBeat Alert for {patient_name}:\n{explanation}\nTime: {datetime.now().strftime('%H:%M:%S')}\nStatus: Action required."

        if escalated:
            # Escalated: Route to Secondary family contact
            sec_contact = next((c for c in contacts if c["priority"] == "secondary"), None)
            target_contact = sec_contact if sec_contact else (contacts[0] if contacts else None)
            if target_contact:
                record = self._deliver_sms(
                    alert_id=alert_id,
                    patient_id=patient_id,
                    recipient_id=target_contact["contact_id"],
                    recipient_type="family_secondary",
                    phone=target_contact["phone_raw"],
                    message=f"[ESCALATION NOTICE] {msg_body} (Previous alerts unacknowledged)",
                    now_iso=now_iso
                )
                deliveries.append(record)
        else:
            # Normal routing:
            # If Warning: Caregiver AND primary family (family needs to know too)
            if severity == "Warning":
                if caregiver:
                    record = self._deliver_inapp_or_sms(
                        alert_id, patient_id, caregiver["caregiver_id"], "caregiver", caregiver["phone"], msg_body, now_iso
                    )
                    deliveries.append(record)

                prim_contact = next((c for c in contacts if c["priority"] == "primary"), None)
                if prim_contact:
                    warn_family_msg = f"⚠️ Health Warning for {patient_name}:\n{explanation}\nTime: {datetime.now().strftime('%H:%M:%S')}\nYour caregiver has been notified and is attending to this."
                    record = self._deliver_sms(
                        alert_id, patient_id, prim_contact["contact_id"], "family",
                        prim_contact["phone_raw"], warn_family_msg, now_iso
                    )
                    deliveries.append(record)
                    # Real Telegram if configured
                    if token and chat_id:
                        tg_record = await self._send_telegram(alert_id, patient_id, token, chat_id, warn_family_msg, now_iso)
                        deliveries.append(tg_record)
                    else:
                        deliveries.append(self._record_simulated_telegram(alert_id, patient_id, warn_family_msg, now_iso))

            # If Critical or SOS: Caregiver AND Primary family contact simultaneously
            elif severity == "Critical":
                if caregiver:
                    record = self._deliver_inapp_or_sms(
                        alert_id, patient_id, caregiver["caregiver_id"], "caregiver", caregiver["phone"], msg_body, now_iso
                    )
                    deliveries.append(record)

                prim_contact = next((c for c in contacts if c["priority"] == "primary"), None)
                if prim_contact:
                    record = self._deliver_sms(
                        alert_id, patient_id, prim_contact["contact_id"], "family", prim_contact["phone_raw"], msg_body, now_iso
                    )
                    deliveries.append(record)

                # Real Telegram delivery if configured
                if token and chat_id:
                    tg_record = await self._send_telegram(alert_id, patient_id, token, chat_id, msg_body, now_iso)
                    deliveries.append(tg_record)
                else:
                    # Simulated telegram delivery
                    tg_sim = self._record_simulated_telegram(alert_id, patient_id, msg_body, now_iso)
                    deliveries.append(tg_sim)

        # Commit all notification records
        for d in deliveries:
            cursor.execute("""
                INSERT INTO notifications (notification_id, alert_id, patient_id, recipient_id, recipient_type, channel, status, sent_at, latency_ms, message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                d["notification_id"], d["alert_id"], d["patient_id"], d["recipient_id"],
                d["recipient_type"], d["channel"], d["status"], d["sent_at"], d.get("latency_ms", 120), d["message"]
            ))
        conn.commit()
        conn.close()

        return deliveries

    def _deliver_sms(self, alert_id: str, patient_id: str, recipient_id: str, recipient_type: str, phone: str, message: str, now_iso: str) -> Dict[str, Any]:
        item = {
            "notification_id": f"sms_{int(datetime.now().timestamp()*1000)}_{len(self.simulated_sms_inbox)}",
            "alert_id": alert_id,
            "patient_id": patient_id,
            "recipient_id": recipient_id,
            "recipient_type": recipient_type,
            "channel": "sms",
            "phone_masked": mask_phone(phone),
            "status": "Delivered",
            "sent_at": now_iso,
            "latency_ms": 115,
            "message": message
        }
        self.simulated_sms_inbox.insert(0, item)
        if len(self.simulated_sms_inbox) > 100:
            self.simulated_sms_inbox.pop()
        logger.info(f"[SIMULATED SMS] To: {item['phone_masked']} | Message: {message}")
        return item

    def _deliver_inapp_or_sms(self, alert_id: str, patient_id: str, recipient_id: str, recipient_type: str, phone: str, message: str, now_iso: str) -> Dict[str, Any]:
        item = {
            "notification_id": f"inapp_{int(datetime.now().timestamp()*1000)}",
            "alert_id": alert_id,
            "patient_id": patient_id,
            "recipient_id": recipient_id,
            "recipient_type": recipient_type,
            "channel": "inapp",
            "phone_masked": mask_phone(phone),
            "status": "Delivered",
            "sent_at": now_iso,
            "latency_ms": 95,
            "message": message
        }
        logger.info(f"[IN-APP / CAREGIVER] To: {recipient_id} | Message: {message}")
        return item

    def _record_simulated_telegram(self, alert_id: str, patient_id: str, message: str, now_iso: str) -> Dict[str, Any]:
        item = {
            "notification_id": f"tg_sim_{int(datetime.now().timestamp()*1000)}",
            "alert_id": alert_id,
            "patient_id": patient_id,
            "recipient_id": "telegram_simulated",
            "recipient_type": "caregiver_and_family",
            "channel": "telegram",
            "status": "Delivered (Simulated)",
            "sent_at": now_iso,
            "latency_ms": 130,
            "message": message
        }
        logger.info(f"[TELEGRAM SIMULATED] Message: {message}")
        return item

    async def send_daily_report(self) -> List[Dict[str, Any]]:
        """
        Compose and deliver a morning health summary to every patient's family contacts.
        Includes: overnight vitals summary, medicine adherence, active alerts, caregiver on duty, diet tip.
        """
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM patients")
        patients = cursor.fetchall()

        all_deliveries = []
        now_iso = datetime.now().isoformat()
        report_date = datetime.now().strftime("%d %b %Y")
        token = self.get_telegram_token()

        for p in patients:
            pid = p["patient_id"]
            pname = p["name"]

            # Latest vitals
            cursor.execute("""
                SELECT * FROM measurements WHERE patient_id = ? AND validation_status = 'valid'
                ORDER BY timestamp DESC LIMIT 1
            """, (pid,))
            latest = cursor.fetchone()

            # Last 24h vitals summary
            cursor.execute("""
                SELECT AVG(heart_rate) as avg_hr, MIN(heart_rate) as min_hr, MAX(heart_rate) as max_hr,
                       AVG(spo2) as avg_spo2, MIN(spo2) as min_spo2,
                       AVG(temperature) as avg_temp, MAX(temperature) as max_temp
                FROM measurements
                WHERE patient_id = ? AND validation_status = 'valid'
                  AND timestamp >= datetime('now', '-24 hours')
            """, (pid,))
            stats = cursor.fetchone()

            # Medicine adherence today
            cursor.execute("""
                SELECT COUNT(*) as total FROM medicine_logs
                WHERE patient_id = ? AND scheduled_time >= date('now')
            """, (pid,))
            total_meds = cursor.fetchone()["total"]
            cursor.execute("""
                SELECT COUNT(*) as taken FROM medicine_logs
                WHERE patient_id = ? AND status = 'taken' AND scheduled_time >= date('now')
            """, (pid,))
            taken_meds = cursor.fetchone()["taken"]

            # Active alerts in last 24h
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM alerts
                WHERE patient_id = ? AND created_at >= datetime('now', '-24 hours')
            """, (pid,))
            alert_count = cursor.fetchone()["cnt"]

            # Assigned caregiver
            cursor.execute("""
                SELECT c.name, ca.shift FROM caregivers c
                JOIN caregiver_assignments ca ON c.caregiver_id = ca.caregiver_id
                WHERE ca.patient_id = ? AND ca.status = 'active' LIMIT 1
            """, (pid,))
            cg = cursor.fetchone()
            cg_line = f"{cg['name']} ({cg['shift']})" if cg else "Not assigned"

            # Family contacts
            cursor.execute("SELECT * FROM family_contacts WHERE patient_id = ?", (pid,))
            contacts = cursor.fetchall()

            # Compose the report message
            vitals_line = "No recent readings available."
            if latest:
                vitals_line = (
                    f"HR: {latest['heart_rate']} BPM  |  "
                    f"SpO₂: {latest['spo2']}%  |  "
                    f"Temp: {latest['temperature']}°C"
                )
            stats_line = ""
            if stats and stats["avg_hr"]:
                stats_line = (
                    f"24h: HR {round(stats['min_hr'])}–{round(stats['max_hr'])} BPM avg {round(stats['avg_hr'])}  |  "
                    f"SpO₂ min {round(stats['min_spo2'])}%  |  "
                    f"Temp max {round(stats['max_temp'], 1)}°C"
                )

            med_line = (
                f"{taken_meds}/{total_meds} medicines taken today ✓" if total_meds > 0
                else "No medicines scheduled today"
            )
            alert_line = (
                f"⚠️ {alert_count} alert(s) triggered in the last 24 hours" if alert_count > 0
                else "✓ No alerts in the last 24 hours"
            )

            report_msg = (
                f"🌅 Good Morning — Daily Health Report\n"
                f"Date: {report_date}\n"
                f"Patient: {pname}\n"
                f"{'─' * 30}\n"
                f"📊 Current Vitals:\n  {vitals_line}\n"
                f"📈 Overnight Summary:\n  {stats_line or 'Insufficient data'}\n"
                f"💊 Medication Adherence:\n  {med_line}\n"
                f"🚨 Alerts:\n  {alert_line}\n"
                f"🩺 Caregiver On Duty:\n  {cg_line}\n"
                f"{'─' * 30}\n"
                f"CareBeat SmartCare · Prototype Alert System"
            )

            # Deliver to ALL family contacts (primary + secondary)
            for contact in contacts:
                fake_alert_id = f"daily_report_{pid}_{int(datetime.now().timestamp())}"
                record = self._deliver_sms(
                    alert_id=fake_alert_id,
                    patient_id=pid,
                    recipient_id=contact["contact_id"],
                    recipient_type="family_daily_report",
                    phone=contact["phone_raw"],
                    message=report_msg,
                    now_iso=now_iso
                )
                all_deliveries.append(record)

                # Also save to notifications table
                cursor.execute("""
                    INSERT INTO notifications (notification_id, alert_id, patient_id, recipient_id, recipient_type, channel, status, sent_at, latency_ms, message)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    record["notification_id"], fake_alert_id, pid, contact["contact_id"],
                    "family_daily_report", "sms", "Delivered", now_iso, 120, report_msg
                ))

            # Telegram if configured
            chat_id = self.get_patient_chat_id(pid)
            if token and chat_id:
                tg = await self._send_telegram(fake_alert_id, pid, token, chat_id, report_msg, now_iso)
                all_deliveries.append(tg)
            else:
                tg_sim = self._record_simulated_telegram(fake_alert_id, pid, report_msg, now_iso)
                all_deliveries.append(tg_sim)

        conn.commit()
        conn.close()
        logger.info(f"Daily morning report sent for {len(patients)} patients, {len(all_deliveries)} deliveries.")
        return all_deliveries

    async def _send_telegram(self, alert_id: str, patient_id: str, token: str, chat_id: str, message: str, now_iso: str) -> Dict[str, Any]:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        status = "Delivered"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(url, json={"chat_id": chat_id, "text": message})
                if res.status_code != 200:
                    status = f"Failed ({res.status_code})"
        except Exception as e:
            status = f"Failed ({str(e)})"
            logger.warning(f"Telegram real delivery failed: {e}")

        return {
            "notification_id": f"tg_real_{int(datetime.now().timestamp()*1000)}",
            "alert_id": alert_id,
            "patient_id": patient_id,
            "recipient_id": chat_id,
            "recipient_type": "caregiver_and_family",
            "channel": "telegram",
            "status": status,
            "sent_at": now_iso,
            "latency_ms": 280,
            "message": message
        }

notification_service = NotificationService()
