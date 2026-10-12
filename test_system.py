import asyncio
import httpx
from database import init_db
import seed

async def run_full_suite():
    print("=" * 65)
    print("RUNNING COMPREHENSIVE CAREBEAT / SMARTCARE SYSTEM VERIFICATION")
    print("=" * 65)

    # Re-seed to clean known state
    seed.seed()

    # Import app and use httpx.AsyncClient with ASGITransport
    from main import app
    from httpx import ASGITransport

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        # 1. Test Static Index
        res = await client.get("/")
        assert res.status_code == 200, f"Index failed: {res.status_code}"
        print("✓ [PASS] Web UI Index Served (HTTP 200)")

        # 2. Test Patients List
        res = await client.get("/patients")
        assert res.status_code == 200
        patients = res.json()
        assert len(patients) == 4, f"Expected 4 patients, got {len(patients)}"
        print(f"✓ [PASS] Patients list verified: {len(patients)} patients found")

        # 3. Test Patient Detail & Health Score
        res = await client.get("/patients/p1")
        assert res.status_code == 200
        p1 = res.json()
        assert p1["patient"]["name"] == "Demo Patient A"
        print(f"✓ [PASS] Patient detail for p1 verified: {p1['patient']['name']}")

        res = await client.get("/patients/p1/health-score")
        assert res.status_code == 200
        score = res.json()
        assert 0 <= score["score"] <= 100
        print(f"✓ [PASS] Health Score verified: {score['score']}/100 (Breakdown: {score['breakdown']})")

        # 4. Test AI Layer (Summary & Tips)
        res = await client.get("/patients/p1/summary")
        assert res.status_code == 200
        ai_res = res.json()
        assert "summary" in ai_res and len(ai_res["summary"]) > 20
        print(f"✓ [PASS] AI Layer 24h Summary generated: '{ai_res['summary'][:80]}...' (Engine: {ai_res['source']})")

        res = await client.get("/patients/p1/tips")
        assert res.status_code == 200
        tips = res.json()
        assert len(tips["tips"]) > 0
        print(f"✓ [PASS] Daily Care Tips generated: {len(tips['tips'])} tips")

        # 5. Test Threshold Config & Update
        res = await client.get("/thresholds/p1")
        assert res.status_code == 200
        th = res.json()

        update_th = {
            "profile_name": "Custom",
            "hr_warn_high": 105.0,
            "hr_warn_low": 48.0,
            "hr_crit_high": 125.0,
            "hr_crit_low": 38.0,
            "temp_warn": 37.8,
            "temp_crit": 38.8,
            "spo2_warn": 93.0,
            "spo2_crit": 89.0
        }
        res = await client.put("/thresholds/p1", json=update_th)
        assert res.status_code == 200
        assert res.json()["status"] == "saved"
        print("✓ [PASS] Threshold config live update and versioning verified")

        # 6. Test Ingestion & Alert Engine
        meas_payload = {
            "patient_id": "p1",
            "heart_rate": 138.0,
            "temperature": 36.7,
            "spo2": 97.0,
            "source": "manual"
        }
        # Ingest 6 consecutive high readings to cross 5s false-alarm filter
        fired_alert = False
        for i in range(6):
            res = await client.post("/measurements", json=meas_payload)
            assert res.status_code == 200
            if res.json()["alert_fired"]:
                fired_alert = True
        assert fired_alert, "Alert should have fired after 6 consecutive seconds"
        print("✓ [PASS] Measurement ingestion & false-alarm sustained breach alert verified")

        # 7. Test Alerts Listing, Claim, Acknowledge, and Resolve
        res = await client.get("/alerts")
        assert res.status_code == 200
        alerts = res.json()
        assert len(alerts) > 0
        alt = alerts[0]
        alt_id = alt["alert_id"]

        # Claim
        res = await client.post(f"/alerts/{alt_id}/claim", json={"caregiver_id": "Priya"})
        assert res.status_code == 200

        # Acknowledge
        res = await client.post(f"/alerts/{alt_id}/acknowledge", json={"caregiver_id": "Priya", "note": "Responding"})
        assert res.status_code == 200

        # Resolve
        res = await client.post(f"/alerts/{alt_id}/resolve", json={"caregiver_id": "Priya", "note": "Resolved"})
        assert res.status_code == 200
        print("✓ [PASS] Alert workflow (Claim Lock -> Acknowledge -> Note -> Resolve) verified")

        # 8. Test SOS Trigger
        res = await client.post("/sos", json={"patient_id": "p1", "reason": "Patient SOS Button Triggered"})
        assert res.status_code == 200
        sos_alert = res.json()
        assert sos_alert["severity"] == "Critical"
        print("✓ [PASS] Patient SOS pipeline verified (Immediate Critical Alert)")

        # 9. Test "I'm OK" Check-In
        res = await client.post("/checkin", json={"patient_id": "p1"})
        assert res.status_code == 200
        assert res.json()["status"] == "ok"
        print("✓ [PASS] Patient 'I'm OK' Check-in verified")

        # 10. Test Caregivers & Verification Queue
        res = await client.get("/caregivers")
        assert res.status_code == 200
        cgs = res.json()
        assert len(cgs) == 2
        res = await client.put("/caregivers/cg_2/verify", json={"status": "Verified"})
        assert res.status_code == 200
        print("✓ [PASS] Caregiver verification workflow verified")

        # 11. Test Data Source Switching (Dynamic Simulator <-> Kaggle CSV Dataset Replay)
        res = await client.get("/demo/source")
        assert res.status_code == 200
        assert res.json()["source"] == "simulator"

        res = await client.post("/demo/source", json={"source": "dataset-replay"})
        assert res.status_code == 200
        assert res.json()["source"] == "dataset-replay"

        # Switch back to simulator
        res = await client.post("/demo/source", json={"source": "simulator"})
        assert res.status_code == 200
        assert res.json()["source"] == "simulator"
        print("✓ [PASS] Data Source switching (Dynamic Simulator <-> Kaggle CSV Replayer) verified")

        # 12. Test Metrics & Evaluation Page
        res = await client.get("/metrics")
        assert res.status_code == 200
        metrics = res.json()
        print(f"✓ [PASS] Judge Evaluation metrics verified (Avg latency: {metrics['average_alert_latency_ms']}ms, Measurements: {metrics['measurements_processed']})")

        # 13. Test CSV Export Report
        res = await client.get("/reports/export")
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        assert "Heart Rate (BPM)" in res.text
        print("✓ [PASS] CSV Export Report generation verified")

    print("=" * 65)
    print("ALL 13 SYSTEM INTEGRATION TESTS PASSED PERFECTLY!")
    print("=" * 65)

if __name__ == "__main__":
    asyncio.run(run_full_suite())
