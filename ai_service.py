"""
CareBeat AI Service — Three-Tier LLM Architecture
===================================================
Tier 1: Groq API  (Primary  — ultra-fast inference, llama-3.1-8b-instant or mixtral-8x7b)
Tier 2: Gemini API (Secondary — Google Gemini 1.5 Flash, fallback if Groq unavailable)
Tier 3: Local Clinical Heuristics Engine (Final fallback — 100% offline, zero latency)

All tiers are strictly non-diagnostic. Emergency alerts NEVER depend on AI.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import httpx

# Load .env.local first (local dev), then fall back to .env
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env.local", override=False)
load_dotenv(dotenv_path=".env", override=False)

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

        # --- Groq (Tier 1 — Primary LLM) ---
        self.groq_api_key = (
            os.environ.get("GROQ_API_KEY")
            or self.config.get("GROQ_API_KEY", "")
        )
        self.groq_model = (
            os.environ.get("GROQ_MODEL")
            or self.config.get("GROQ_MODEL", "openai/gpt-oss-20b")
        )
        self.groq_base_url = "https://api.groq.com/openai/v1/chat/completions"

        # --- Gemini (Tier 2 — Secondary LLM) ---
        self.gemini_api_key = (
            os.environ.get("GEMINI_API_KEY")
            or self.config.get("GEMINI_API_KEY", "")
        )
        self.gemini_model = self.config.get("GEMINI_MODEL", "gemini-1.5-flash")

    # ------------------------------------------------------------------
    # API Key Checks
    # ------------------------------------------------------------------
    def has_groq_key(self) -> bool:
        return bool(self.groq_api_key and len(self.groq_api_key.strip()) > 5)

    def has_gemini_key(self) -> bool:
        return bool(self.gemini_api_key and len(self.gemini_api_key.strip()) > 5)

    # ------------------------------------------------------------------
    # Public: Generate 24-Hour Patient Summary
    # ------------------------------------------------------------------
    async def generate_patient_summary(self, patient_id: str) -> Dict[str, Any]:
        """
        Generates a 24-hour plain-language summary of patient readings and alerts.

        Resolution order:
          1. Groq API  (primary — fastest, free tier available)
          2. Gemini API (secondary — fallback if Groq key missing or call fails)
          3. Local heuristic engine (final fallback — always succeeds, fully offline)
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
        cursor.execute(
            """
            SELECT heart_rate, temperature, spo2, systolic_bp, diastolic_bp, timestamp
            FROM measurements
            WHERE patient_id = ? AND timestamp >= ? AND validation_status = 'valid'
            ORDER BY timestamp ASC
            """,
            (patient_id, day_ago),
        )
        readings = cursor.fetchall()

        # Recent alerts
        cursor.execute(
            """
            SELECT alert_type, severity, explanation, created_at
            FROM alerts
            WHERE patient_id = ? AND created_at >= ?
            """,
            (patient_id, day_ago),
        )
        alerts = cursor.fetchall()

        # Medicines
        cursor.execute(
            """
            SELECT m.name, ml.status, ml.scheduled_time
            FROM medicine_logs ml
            JOIN medicines m ON ml.medicine_id = m.medicine_id
            WHERE ml.patient_id = ? AND ml.scheduled_time >= ?
            """,
            (patient_id, day_ago[:10]),
        )
        meds = cursor.fetchall()

        cursor.execute(
            "SELECT * FROM threshold_configs WHERE patient_id = ? ORDER BY version DESC LIMIT 1",
            (patient_id,),
        )
        thresh = cursor.fetchone()
        conn.close()

        # Compute 24-hour statistics
        hr_vals   = [r["heart_rate"]  for r in readings if r["heart_rate"]   is not None]
        temp_vals = [r["temperature"] for r in readings if r["temperature"]  is not None]
        spo2_vals = [r["spo2"]        for r in readings if r["spo2"]         is not None]

        avg_hr   = round(sum(hr_vals)   / len(hr_vals),   1) if hr_vals   else None
        min_hr   = min(hr_vals)   if hr_vals   else None
        max_hr   = max(hr_vals)   if hr_vals   else None
        avg_temp = round(sum(temp_vals) / len(temp_vals), 1) if temp_vals else None
        max_temp = max(temp_vals) if temp_vals else None
        avg_spo2 = round(sum(spo2_vals) / len(spo2_vals), 1) if spo2_vals else None
        min_spo2 = min(spo2_vals) if spo2_vals else None

        crit_alerts  = [a for a in alerts if a["severity"] == "Critical"]
        warn_alerts  = [a for a in alerts if a["severity"] == "Warning"]
        missed_meds  = [m for m in meds   if m["status"]   == "missed"]

        # Shared kwargs for all LLM/heuristic calls
        ctx = dict(
            patient_name=patient["name"],
            age=patient["age"],
            conditions=patient["condition_tags"],
            avg_hr=avg_hr, min_hr=min_hr, max_hr=max_hr,
            avg_temp=avg_temp, max_temp=max_temp,
            avg_spo2=avg_spo2, min_spo2=min_spo2,
            crit_count=len(crit_alerts),
            warn_count=len(warn_alerts),
            missed_meds_count=len(missed_meds),
            thresh_profile=thresh["profile_name"] if thresh else "Default",
        )

        # ── Tier 1: Groq API ──
        if self.has_groq_key():
            try:
                text = await self._call_groq_summary(**ctx)
                if text:
                    return {
                        "patient_id": patient_id,
                        "summary": text,
                        "source": "groq-api",
                        "model": self.groq_model,
                        "timestamp": datetime.now().isoformat(),
                        "disclaimer": (
                            "AI summary based on configured limit adherence only. "
                            "Not a medical diagnosis or clinical assessment."
                        ),
                    }
            except Exception as e:
                logger.warning(f"Groq API call failed, trying Gemini: {e}")

        # ── Tier 2: Gemini API ──
        if self.has_gemini_key():
            try:
                text = await self._call_gemini_summary(**ctx)
                if text:
                    return {
                        "patient_id": patient_id,
                        "summary": text,
                        "source": "gemini-api",
                        "model": self.gemini_model,
                        "timestamp": datetime.now().isoformat(),
                        "disclaimer": (
                            "AI summary based on configured limit adherence only. "
                            "Not a medical diagnosis or clinical assessment."
                        ),
                    }
            except Exception as e:
                logger.warning(f"Gemini API call failed, falling back to heuristics: {e}")

        # ── Tier 3: Local Clinical Heuristics Engine ──
        fallback_summary = self._generate_local_heuristic_summary(
            patient_name=patient["name"],
            avg_hr=avg_hr, min_hr=min_hr, max_hr=max_hr,
            avg_temp=avg_temp, max_temp=max_temp,
            avg_spo2=avg_spo2, min_spo2=min_spo2,
            crit_count=len(crit_alerts),
            warn_count=len(warn_alerts),
            missed_meds_count=len(missed_meds),
            thresh=thresh,
        )
        return {
            "patient_id": patient_id,
            "summary": fallback_summary,
            "source": "local-rule-engine",
            "model": "CareBeat Clinical Heuristics v1.2",
            "timestamp": datetime.now().isoformat(),
            "disclaimer": (
                "Summary based on configured limit adherence only. "
                "Not a medical diagnosis or clinical assessment."
            ),
        }

    # ------------------------------------------------------------------
    # Tier 1: Groq API Call (OpenAI-compatible REST endpoint)
    # ------------------------------------------------------------------
    async def _call_groq_summary(self, **kwargs) -> Optional[str]:
        """
        Calls the Groq Cloud API using the OpenAI-compatible /chat/completions endpoint.
        Default model: llama-3.1-8b-instant (fast, free-tier available).
        """
        system_prompt = (
            "You are a clinical monitoring assistant that writes 24-hour patient summaries "
            "for caregivers. "
            "STRICT RULES: "
            "(1) Do NOT diagnose any disease or recommend treatments, medications, or dosages. "
            "(2) Reference ONLY the configured monitoring thresholds and the observed readings. "
            "(3) Keep output to 2–3 concise, clear sentences in a calm, professional tone. "
            "(4) Never speculate on causes; only describe what was observed."
        )
        user_prompt = (
            f"Patient: {kwargs.get('patient_name')}, Age {kwargs.get('age')}. "
            f"Conditions on file: {kwargs.get('conditions')}. "
            f"Threshold profile: {kwargs.get('thresh_profile')}.\n"
            f"24-hour vitals — "
            f"Heart Rate: avg {kwargs.get('avg_hr')} BPM (range {kwargs.get('min_hr')}–{kwargs.get('max_hr')}); "
            f"Temperature: avg {kwargs.get('avg_temp')}°C (max {kwargs.get('max_temp')}); "
            f"SpO₂: avg {kwargs.get('avg_spo2')}% (min {kwargs.get('min_spo2')}).\n"
            f"Alerts: {kwargs.get('crit_count')} Critical, {kwargs.get('warn_count')} Warning. "
            f"Missed medications: {kwargs.get('missed_meds_count')}.\n"
            "Write the 2–3 sentence caregiver summary now:"
        )

        payload = {
            "model": self.groq_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 220,
        }
        headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(self.groq_base_url, json=payload, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                choices = data.get("choices", [])
                if choices:
                    return choices[0].get("message", {}).get("content", "").strip()
        logger.warning(f"Groq API returned status {resp.status_code}: {resp.text[:200]}")
        return None

    # ------------------------------------------------------------------
    # Tier 2: Gemini API Call
    # ------------------------------------------------------------------
    async def _call_gemini_summary(self, **kwargs) -> Optional[str]:
        prompt = (
            "You are a clinical monitoring assistant generating a 24-hour summary for caregivers.\n"
            "STRICT RULES:\n"
            "- Do NOT diagnose any disease or recommend medical treatments or dosages.\n"
            "- Reference ONLY configured monitoring limits and observed readings.\n"
            "- Keep output to 2–3 concise, clear sentences in a calm, professional tone.\n\n"
            f"Patient Context:\n"
            f"- Name: {kwargs.get('patient_name')}, Age: {kwargs.get('age')}\n"
            f"- Conditions: {kwargs.get('conditions')}, Threshold Profile: {kwargs.get('thresh_profile')}\n"
            f"- Heart Rate: avg {kwargs.get('avg_hr')} BPM (Range: {kwargs.get('min_hr')}–{kwargs.get('max_hr')})\n"
            f"- Temperature: avg {kwargs.get('avg_temp')}°C (Max: {kwargs.get('max_temp')})\n"
            f"- SpO₂: avg {kwargs.get('avg_spo2')}% (Min: {kwargs.get('min_spo2')})\n"
            f"- Alerts: {kwargs.get('crit_count')} Critical, {kwargs.get('warn_count')} Warning\n"
            f"- Missed Meds: {kwargs.get('missed_meds_count')}\n\n"
            "Provide the 2–3 sentence caregiver summary now:"
        )

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.gemini_model}:generateContent?key={self.gemini_api_key}"
        )
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 220},
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
        logger.warning(f"Gemini API returned status {resp.status_code}: {resp.text[:200]}")
        return None

    # ------------------------------------------------------------------
    # Tier 3: Local Clinical Heuristics Engine (always-on fallback)
    # ------------------------------------------------------------------
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
        thresh: Optional[Any],
    ) -> str:
        parts = []

        # Heart rate
        if avg_hr:
            if thresh and max_hr and max_hr > thresh["hr_warn_high"]:
                parts.append(
                    f"Heart rate averaged {round(avg_hr)} BPM with temporary peaks "
                    f"reaching {round(max_hr)} BPM above warning thresholds."
                )
            else:
                parts.append(
                    f"Heart rate averaged {round(avg_hr)} BPM and remained within configured limits."
                )
        else:
            parts.append("Heart rate readings remained stable throughout the observation window.")

        # Temperature & SpO₂
        temp_note = ""
        if avg_temp and max_temp:
            if thresh and max_temp > thresh["temp_warn"]:
                temp_note = f"Body temperature peaked at {max_temp}°C during transient elevations."
            else:
                temp_note = f"Body temperature held steady around {round(avg_temp, 1)}°C."

        spo2_note = ""
        if avg_spo2:
            if min_spo2 and thresh and min_spo2 < thresh["spo2_warn"]:
                spo2_note = f"SpO₂ dipped to a low of {round(min_spo2)}%."
            else:
                spo2_note = f"Oxygen saturation maintained strong levels averaging {round(avg_spo2)}%."

        if temp_note or spo2_note:
            parts.append(f"{temp_note} {spo2_note}".strip())

        # Alert & compliance wrap-up
        if crit_count > 0:
            parts.append(
                f"Attention required: {crit_count} Critical alert event(s) occurred in the last 24 hours."
            )
        elif warn_count > 0:
            parts.append(
                f"{warn_count} minor warning alert(s) were logged and reviewed by caregivers."
            )
        else:
            parts.append("No critical threshold breaches were detected during the monitored period.")

        if missed_meds_count > 0:
            parts.append(
                f"Note: {missed_meds_count} scheduled medication dose(s) were marked as missed."
            )

        return " ".join(parts)

    # ------------------------------------------------------------------
    # Daily Care Tips (deterministic, no external API call)
    # ------------------------------------------------------------------
    def generate_daily_tips(
        self,
        condition_tags: List[str],
        current_vitals: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, str]]:
        """
        Generates condition-aware wellness suggestions for caregivers.
        Pure local logic — no API call. Non-diagnostic by design.
        """
        tips = []

        tips.append({
            "title": "Hydration & Rest",
            "tip": "Encourage regular sips of water through the day and quiet resting intervals after meals.",
        })

        tags_lower = [t.lower() for t in condition_tags]

        if any("bp" in t or "hypertension" in t for t in tags_lower):
            tips.append({
                "title": "Blood Pressure Wellness",
                "tip": "Opt for low-sodium meals, limit caffeinated beverages, and maintain a calm environment.",
            })

        if any("heart" in t for t in tags_lower):
            tips.append({
                "title": "Cardiac Comfort",
                "tip": "Keep activities gentle with no sudden strenuous exertion; pace walking and elevate feet when resting.",
            })

        if any("diabet" in t for t in tags_lower):
            tips.append({
                "title": "Glucose Routine",
                "tip": "Follow consistent meal times, offer water between meals, and monitor alertness and energy levels.",
            })

        if current_vitals:
            temp = current_vitals.get("temperature")
            if temp and temp > 37.8:
                tips.append({
                    "title": "Elevated Temperature Care",
                    "tip": "Offer additional fluids, keep the room well-ventilated, and use light breathable cotton clothing.",
                })

        return tips


ai_service = AIService()
