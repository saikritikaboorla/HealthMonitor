from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class MeasurementInput(BaseModel):
    patient_id: str
    heart_rate: float
    temperature: float
    spo2: float
    systolic_bp: Optional[float] = None
    diastolic_bp: Optional[float] = None
    fall_detected: Optional[int] = 0
    data_accuracy: Optional[float] = 100.0
    timestamp: Optional[str] = None
    source: Optional[str] = "manual"

class PatientCreate(BaseModel):
    name: str
    age: int
    condition_tags: List[str] = []
    care_needs_tags: List[str] = []
    consent: bool = True
    primary_contact_name: str
    primary_contact_relation: str
    primary_contact_phone: str
    secondary_contact_name: Optional[str] = None
    secondary_contact_relation: Optional[str] = None
    secondary_contact_phone: Optional[str] = None

class ThresholdUpdate(BaseModel):
    profile_name: Optional[str] = "Custom"
    hr_warn_high: float
    hr_warn_low: float
    hr_crit_high: float
    hr_crit_low: float
    temp_warn: float
    temp_crit: float
    spo2_warn: float
    spo2_crit: float

class AlertActionRequest(BaseModel):
    caregiver_id: Optional[str] = "Priya"
    note: Optional[str] = None

class SOSRequest(BaseModel):
    patient_id: str
    reason: Optional[str] = "Patient SOS Button Triggered"

class CheckInRequest(BaseModel):
    patient_id: str

class SourceSwitchRequest(BaseModel):
    source: str # "simulator" or "dataset-replay"

class CareTaskUpdate(BaseModel):
    status: str # "done", "missed", "pending"

class MedicineCreate(BaseModel):
    name: str
    schedule_times: List[str] # ["09:00", "21:00"]
    notes: Optional[str] = None

class MedicineLogUpdate(BaseModel):
    status: str # "taken", "missed"
    marked_by: str = "caregiver"
    note: Optional[str] = None

class HandoverNoteCreate(BaseModel):
    caregiver_id: str
    shift: str
    condition_on_arrival: str
    tasks_completed: str
    concerns: str

class CareLogCreate(BaseModel):
    caregiver_id: str
    note: str

class FeeNegotiationCreate(BaseModel):
    patient_id: str
    caregiver_id: str
    proposed_fee: str
    shift: str
    duties: str

class FeeNegotiationRespond(BaseModel):
    status: str # "Agreed", "Counter", "Declined"
    counter_fee: Optional[str] = None

class CaregiverVerifyRequest(BaseModel):
    status: str # "Verified", "Rejected"
    expiry: Optional[str] = "2027-12-31"
