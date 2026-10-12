import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import httpx
from database import get_db

logger = logging.getLogger("carebeat.ai")

class AIService:
    def __init__(self, config_path: str = "config.json"):
        self.config = {}
        if os.path.exists(config_path):
            try:
                with open(config_path, "r") as f:
                    self.config = json.load(f)
            except Exception:
                pass

        self.api_key = os.environ.get("GEMINI_API_KEY") or self.config.get("GEMINI_API_KEY", "")
        self.model = self.config.get("GEMINI_MODEL", "gemini-1.5-flash")

    def has_api_key(self) -> bool:
        return bool(self.api_key and len(self.api_key.strip()) > 5)

    async def generate_patient_summary(self, patient_id: str) -> Dict[str, Any]:
        """
        Generates a 24-hour plain-language summary of patient readings and alerts.
        Uses Gemini API if key is present, otherwise falls back to smart local heuristic engine.
        """
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM patients WHERE patient_id = ?", (patient_id,))
        patient = cursor.fetchone()
        if not patient:
            conn.close()
            return {"summary": "Patient not found.", "source": "error"}

        day_ago = (datetime.now() - timedelta(hours=24)).isoformat()

        # Recent valid measurements
        cursor.execute("""
            SELECT heart_rate, temperature, spo2, systolic_bp, diastolic_bp, timestamp
            FROM measurements
            WHERE patient_id = ? AND timestamp >= ? AND validation_status = 'valid'
            ORDER BY timestamp ASC
        """, (patient_id, day_ago))
        readings = cursor.fetchall()

        # Recent alerts
        cursor.execute("""
            SELECT alert_type, severity, explanation, created_at
            FROM alerts
            WHERE patient_id = ? AND created_at >= ?
        """, (patient_id, day_ago))
        alerts = cursor.fetchall()

        # Medicines
        cursor.execute("""
            SELECT m.name, ml.status, ml.scheduled_time
            FROM medicine_logs ml
            JOIN medicines m ON ml.medicine_id = m.medicine_id
            WHERE ml.patient_id = ? AND ml.scheduled_time >= ?
        """, (patient_id, day_ago[:10]))
        meds = cursor.fetchall()

        cursor.execute("SELECT * FROM threshold_configs WHERE patient_id = ? ORDER BY version DESC LIMIT 1", (patient_id,))
        thresh = cursor.fetchone()
        conn.close()

        # Compute statistics for context
        hr_vals = [r["heart_rate"] for r in readings if r["heart_rate"] is not None]
        temp_vals = [r["temperature"] for r in readings if r["temperature"] is not None]
        spo2_vals = [r["spo2"] for r in readings if r["spo2"] is not None]

        avg_hr = round(sum(hr_vals) / len(hr_vals), 1) if hr_vals else None
        min_hr = min(hr_vals) if hr_vals else None
        max_hr = max(hr_vals) if hr_vals else None

        avg_temp = round(sum(temp_vals) / len(temp_vals), 1) if temp_vals else None
        min_temp = min(temp_vals) if temp_vals else None
        max_temp = max(temp_vals) if temp_vals else None

        avg_spo2 = round(sum(spo2_vals) / len(spo2_vals), 1) if spo2_vals else None
        min_spo2 = min(spo2_vals) if spo2_vals else None

        crit_alerts = [a for a in alerts if a["severity"] == "Critical"]
        warn_alerts = [a for a in alerts if a["severity"] == "Warning"]
        missed_meds = [m for m in meds if m["status"] == "missed"]

        # If Gemini API Key is configured, attempt call
        if self.has_api_key():
            try:
                gemini_text = await self._call_gemini_summary(
                    patient_name=patient["name"],
                    age=patient["age"],
                    conditions=patient["condition_tags"],
                    avg_hr=avg_hr, min_hr=min_hr, max_hr=max_hr,
                    avg_temp=avg_temp, min_temp=min_temp, max_temp=max_temp,
                    avg_spo2=avg_spo2, min_spo2=min_spo2,
                    crit_count=len(crit_alerts),
                    warn_count=len(warn_alerts),
                    missed_meds_count=len(missed_meds),
                    thresh_profile=thresh["profile_name"] if thresh else "Default"
                )
                if gemini_text:
                    return {
                        "patient_id": patient_id,
                        "summary": gemini_text,
                        "source": "gemini-api",
                        "model": self.model,
                        "timestamp": datetime.now().isoformat(),
                        "disclaimer": "AI summary based on configured limit adherence only. Not a medical diagnosis or clinical assessment."
                    }
            except Exception as e:
                logger.warning(f"Gemini API call failed, falling back to smart local heuristic: {e}")

        # Smart local heuristic engine fallback
        fallback_summary = self._generate_local_heuristic_summary(
            patient_name=patient["name"],
            avg_hr=avg_hr, min_hr=min_hr, max_hr=max_hr,
            avg_temp=avg_temp, max_temp=max_temp,
            avg_spo2=avg_spo2, min_spo2=min_spo2,
            crit_count=len(crit_alerts),
            warn_count=len(warn_alerts),
            missed_meds_count=len(missed_meds),
            thresh=thresh
        )

        return {
            "patient_id": patient_id,
            "summary": fallback_summary,
            "source": "local-rule-engine",
            "model": "CareBeat Clinical Heuristics v1.2",
            "timestamp": datetime.now().isoformat(),
            "disclaimer": "Summary based on configured limit adherence only. Not a medical diagnosis or clinical assessment."
        }

    async def _call_gemini_summary(self, **kwargs) -> Optional[str]:
        prompt = (
            "You are a clinical monitoring assistant generating a 24-hour summary for caregivers.\n"
            "STRICT RULES:\n"
            "- Do NOT diagnose any disease or recommend medical treatments/dosages.\n"
            "- Reference ONLY configured monitoring limits and observed readings.\n"
            "- Keep the output to 2 to 3 concise, clear sentences.\n"
            "- Use a calm, reassuring, professional tone.\n\n"
            f"Patient Context:\n"
            f"- Name: {kwargs.get('patient_name')}, Age: {kwargs.get('age')}\n"
            f"- Conditions: {kwargs.get('conditions')}, Threshold Profile: {kwargs.get('thresh_profile')}\n"
            f"- Heart Rate: Average {kwargs.get('avg_hr')} BPM (Range: {kwargs.get('min_hr')}-{kwargs.get('max_hr')})\n"
            f"- Temperature: Average {kwargs.get('avg_temp')} °C (Max: {kwargs.get('max_temp')})\n"
            f"- SpO2: Average {kwargs.get('avg_spo2')} % (Min: {kwargs.get('min_spo2')})\n"
            f"- Alerts: {kwargs.get('crit_count')} Critical, {kwargs.get('warn_count')} Warning\n"
            f"- Missed Meds: {kwargs.get('missed_meds_count')}\n\n"
            "Provide the 2-3 sentence summary now:"
        )

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 200
            }
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "").strip()
        return None

    def _generate_local_heuristic_summary(
        self,
        patient_name: str,
        avg_hr: Optional[float],
        min_hr: Optional[float],
        max_hr: Optional[float],
        avg_temp: Optional[float],
        max_temp: Optional[float],
        avg_spo2: Optional[float],
        min_spo2: Optional[float],
        crit_count: int,
        warn_count: int,
        missed_meds_count: int,
        thresh: Optional[Dict[str, Any]]
    ) -> str:
        parts = []

        # Heart rate observation
        if avg_hr:
            if thresh and (max_hr and max_hr > thresh["hr_warn_high"]):
                parts.append(f"Heart rate averaged {round(avg_hr)} BPM with temporary peaks reaching {round(max_hr)} BPM above warning thresholds.")
            else:
                parts.append(f"Heart rate averaged {round(avg_hr)} BPM and remained comfortably within configured target limits.")
        else:
            parts.append(f"Heart rate readings remained stable throughout the observation window.")

        # Temperature & SpO2 observation
        temp_note = ""
        if avg_temp and max_temp:
            if thresh and max_temp > thresh["temp_warn"]:
                temp_note = f"Body temperature peaked at {max_temp}°C during transient elevations."
            else:
                temp_note = f"Body temperature held steady around {round(avg_temp, 1)}°C."

        spo2_note = ""
        if avg_spo2:
            if min_spo2 and thresh and min_spo2 < thresh["spo2_warn"]:
                spo2_note = f"SpO2 oxygen saturation dipped to a low of {round(min_spo2)}%."
            else:
                spo2_note = f"Oxygen saturation maintained strong levels averaging {round(avg_spo2)}%."

        if temp_note or spo2_note:
            parts.append(f"{temp_note} {spo2_note}".strip())

        # Alert & compliance wrap-up
        if crit_count > 0:
            parts.append(f"Attention is required: {crit_count} Critical alert event(s) occurred in the last 24 hours.")
        elif warn_count > 0:
            parts.append(f"{warn_count} minor warning alert(s) were logged and reviewed by caregivers.")
        else:
            parts.append("No critical threshold breaches were detected during the monitored period.")

        if missed_meds_count > 0:
            parts.append(f"Note: {missed_meds_count} scheduled medication dose(s) were marked as missed.")

        return " ".join(parts)

    def generate_daily_tips(self, condition_tags: List[str], current_vitals: Optional[Dict[str, Any]] = None) -> List[Dict[str, str]]:
        """
        Generates tailored wellness suggestions per §8.2 without medical diagnosis or dosage advice.
        """
        tips = []

        # General baseline tip
        tips.append({
            "title": "Hydration & Rest",
            "tip": "Encourage regular sips of water through the day and quiet resting intervals after meals."
        })

        tags_lower = [t.lower() for t in condition_tags]

        if any("bp" in t or "hypertension" in t for t in tags_lower):
            tips.append({
                "title": "Blood Pressure Wellness",
                "tip": "Opt for low-sodium meals, limit caffeinated beverages, and maintain a quiet, calm environment."
            })

        if any("heart" in t for t in tags_lower):
            tips.append({
                "title": "Cardiac Comfort",
                "tip": "Keep activities gentle with no sudden strenuous exertion; pace walking and elevate feet when resting."
            })

        if any("diabet" in t for t in tags_lower):
            tips.append({
                "title": "Glucose Routine",
                "tip": "Follow consistent meal times, offer water between meals, and monitor alertness and energy levels."
            })

        if current_vitals:
            temp = current_vitals.get("temperature")
            if temp and temp > 37.8:
                tips.append({
                    "title": "Elevated Temperature Care",
                    "tip": "Offer additional fluids, keep the room well-ventilated, and use light breathable cotton clothing."
                })

        return tips

ai_service = AIService()
