import os
import csv
import math
import random
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable

from database import get_db
from engine import engine

logger = logging.getLogger("carebeat.simulator")

DEMO_PATIENTS_BASELINES = {
    "p1": {"hr": 75, "temp": 36.6, "spo2": 98, "sys_bp": 124, "dia_bp": 82, "name": "Demo Patient A", "condition": "heart patient"},
    "p2": {"hr": 80, "temp": 36.8, "spo2": 97, "sys_bp": 146, "dia_bp": 94, "name": "Demo Patient B", "condition": "high BP"},
    "p3": {"hr": 72, "temp": 37.0, "spo2": 96, "sys_bp": 120, "dia_bp": 80, "name": "Demo Patient C", "condition": "diabetic"},
    "p4": {"hr": 70, "temp": 36.5, "spo2": 98, "sys_bp": 118, "dia_bp": 78, "name": "Demo Patient D", "condition": "none"}
}

class HealthcareSimulator:
    def __init__(self, csv_path: str = "Synthetic_patient-HealthCare-Monitoring_dataset.csv"):
        self.source = "simulator" # "simulator" or "dataset-replay"
        self.csv_path = csv_path
        self.running = False
        self.t = 0.0

        # Anomaly overrides: patient_id -> {"type": str, "expire_at": float, "params": dict}
        self.active_anomalies: Dict[str, Dict[str, Any]] = {}

        # CSV Replayer state
        self.csv_file = None
        self.csv_reader = None
        self.csv_row_count = 0
        self.csv_loop_count = 0
        self.csv_patients_cycle = ["p1", "p2", "p3", "p4"]
        self.csv_cycle_idx = 0

        # Listeners / callbacks for WebSocket broadcast
        self.broadcast_callbacks: List[Callable[[Dict[str, Any]], Any]] = []

    def set_source(self, new_source: str):
        if new_source in ["simulator", "dataset-replay"]:
            self.source = new_source
            logger.info(f"Switched data source to: {self.source}")
            return True
        return False

    def get_source(self) -> str:
        return self.source

    def register_broadcast_callback(self, cb: Callable[[Dict[str, Any]], Any]):
        self.broadcast_callbacks.append(cb)

    async def broadcast(self, payload: Dict[str, Any]):
        for cb in self.broadcast_callbacks:
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(payload)
                else:
                    cb(payload)
            except Exception as e:
                logger.error(f"Error in broadcast callback: {e}")

    def trigger_anomaly(self, patient_id: str, anomaly_type: str, duration_sec: int = 30):
        expire_at = datetime.now().timestamp() + duration_sec
        self.active_anomalies[patient_id] = {
            "type": anomaly_type,
            "expire_at": expire_at,
            "duration": duration_sec
        }
        logger.info(f"Triggered anomaly '{anomaly_type}' on {patient_id} for {duration_sec}s")

    def generate_simulated_reading(self, patient_id: str, baseline: Dict[str, Any], t: float) -> Dict[str, Any]:
        now_ts = datetime.now().timestamp()
        anomaly = self.active_anomalies.get(patient_id)
        is_anomaly = anomaly and now_ts < anomaly["expire_at"]

        # Math drift and realistic noise
        hr = baseline["hr"] + 4 * math.sin(t / 25) + random.gauss(0, 1.8)
        temp = baseline["temp"] + 0.12 * math.sin(t / 50) + random.gauss(0, 0.05)
        spo2 = baseline["spo2"] + random.gauss(0, 0.4)
        sys_bp = baseline["sys_bp"] + 3 * math.sin(t / 30) + random.gauss(0, 2.0)
        dia_bp = baseline["dia_bp"] + 2 * math.sin(t / 30) + random.gauss(0, 1.5)
        fall = 0

        # Apply active anomaly if present
        if is_anomaly:
            atype = anomaly["type"]
            if atype == "tachycardia":
                hr = random.uniform(132, 145)
            elif atype == "fever":
                temp = random.uniform(38.6, 39.3)
            elif atype == "low_spo2":
                spo2 = random.uniform(85, 88.5)
            elif atype == "emergency":
                hr = random.uniform(135, 148)
                temp = random.uniform(38.8, 39.4)
                spo2 = random.uniform(84, 88)
                sys_bp = random.uniform(170, 185)
                dia_bp = random.uniform(105, 115)
        elif anomaly and now_ts >= anomaly["expire_at"]:
            del self.active_anomalies[patient_id]

        # Clamp physically
        spo2 = min(100.0, max(80.0, spo2))

        return {
            "patient_id": patient_id,
            "heart_rate": round(hr),
            "temperature": round(temp, 1),
            "spo2": round(spo2),
            "systolic_bp": round(sys_bp),
            "diastolic_bp": round(dia_bp),
            "fall_detected": fall,
            "data_accuracy": 98.5,
            "timestamp": datetime.now().isoformat(),
            "source": "simulator"
        }

    def _init_csv_reader(self):
        if os.path.exists(self.csv_path):
            try:
                self.csv_file = open(self.csv_path, "r", encoding="utf-8")
                self.csv_reader = csv.DictReader(self.csv_file)
            except Exception as e:
                logger.error(f"Failed to open CSV dataset: {e}")

    def read_next_csv_row(self) -> Optional[Dict[str, Any]]:
        if not self.csv_reader:
            self._init_csv_reader()
            if not self.csv_reader:
                return None

        try:
            row = next(self.csv_reader)
        except (StopIteration, TypeError):
            # Loop dataset
            self.csv_loop_count += 1
            if self.csv_file:
                self.csv_file.close()
            self._init_csv_reader()
            if not self.csv_reader:
                return None
            row = next(self.csv_reader)

        self.csv_row_count += 1

        # Cycle target patient
        patient_id = self.csv_patients_cycle[self.csv_cycle_idx % len(self.csv_patients_cycle)]
        self.csv_cycle_idx += 1

        try:
            hr = float(row.get("Heart Rate (bpm)", 75))
            spo2 = float(row.get("SpO2 Level (%)", 98))
            temp = float(row.get("Body Temperature (°C)", 36.6))
            sys_bp = float(row.get("Systolic Blood Pressure (mmHg)", 120))
            dia_bp = float(row.get("Diastolic Blood Pressure (mmHg)", 80))
            fall = 1 if row.get("Fall Detection", "No").strip().lower() == "yes" else 0
            accuracy = float(row.get("Data Accuracy (%)", 95))
        except Exception:
            return None

        return {
            "patient_id": patient_id,
            "heart_rate": round(hr),
            "temperature": round(temp, 1),
            "spo2": round(spo2),
            "systolic_bp": round(sys_bp),
            "diastolic_bp": round(dia_bp),
            "fall_detected": fall,
            "data_accuracy": accuracy,
            "timestamp": datetime.now().isoformat(),
            "source": f"dataset-replay"
        }

    async def step(self):
        try:
            if self.source == "simulator":
                for pid, baseline in DEMO_PATIENTS_BASELINES.items():
                    reading = self.generate_simulated_reading(pid, baseline, self.t)
                    alert = await engine.process_measurement(reading)
                    payload = {
                        "type": "vital_update",
                        "data": reading,
                        "source": "simulator"
                    }
                    await self.broadcast(payload)
                    if alert:
                        await self.broadcast({
                            "type": "alert_new",
                            "data": alert
                        })
                self.t += 1.0
            elif self.source == "dataset-replay":
                reading = self.read_next_csv_row()
                if reading:
                    alert = await engine.process_measurement(reading)
                    await self.broadcast({
                        "type": "vital_update",
                        "data": reading,
                        "source": "dataset-replay",
                        "row_num": self.csv_row_count
                    })
                    if alert:
                        await self.broadcast({
                            "type": "alert_new",
                            "data": alert
                        })
            escalations = await engine.check_escalations_and_offline()
            if escalations:
                for esc in escalations:
                    await self.broadcast({
                        "type": "alert_escalated",
                        "data": esc
                    })
        except Exception as e:
            logger.error(f"Error in simulator step: {e}", exc_info=True)

    async def run_loop(self):
        self.running = True
        logger.info("CareBeat Simulator loop started.")
        while self.running:
            await self.step()
            await asyncio.sleep(1.0)

    def stop(self):
        self.running = False
        if self.csv_file:
            self.csv_file.close()

simulator = HealthcareSimulator()
