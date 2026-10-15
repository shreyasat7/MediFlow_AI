from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
from crypto import EncryptedString


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, unique=True, index=True)  # e.g. P-1001
    name = Column(String, index=True)  # NOT encrypted — searched via SQL LIKE
    age = Column(Integer)
    symptoms = Column(String)
    priority = Column(String)  # Emergency, High, Normal
    status = Column(String)    # Waiting, In Treatment, Admitted, Discharged
    assigned_doctor = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Richer demographics (Phase 1). PHI fields encrypted at rest.
    contact = Column(EncryptedString, nullable=True)
    date_of_birth = Column(EncryptedString, nullable=True)
    gender = Column(String, nullable=True)
    blood_group = Column(String, nullable=True)
    address = Column(EncryptedString, nullable=True)
    emergency_contact_name = Column(EncryptedString, nullable=True)
    emergency_contact_phone = Column(EncryptedString, nullable=True)
    insurance_provider = Column(String, nullable=True)
    insurance_id = Column(EncryptedString, nullable=True)
    allergies = Column(EncryptedString, nullable=True)
    chronic_conditions = Column(EncryptedString, nullable=True)
    # False for unidentified emergency ("John Doe") admissions until confirmed.
    identity_confirmed = Column(Boolean, default=True)


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    specialization = Column(String)
    status = Column(String)  # Available, Busy, Off-Duty
    current_patient_count = Column(Integer, default=0)


class Bed(Base):
    __tablename__ = "beds"

    id = Column(Integer, primary_key=True, index=True)
    bed_number = Column(String, unique=True, index=True)
    ward = Column(String)
    status = Column(String)  # Available, Occupied, Cleaning
    patient_id = Column(String, nullable=True)  # patient_id occupying the bed


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(Integer, primary_key=True, index=True)
    agent_name = Column(String)   # Intake, Coordinator, Access, AI Assist, ...
    action_type = Column(String)  # TRIAGE, VIEW, RECOMMEND, LOCKOUT, SAFETY_OVERRIDE, ...
    message = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    actor = Column(String, nullable=True)  # username/full_name that triggered it


class DiagnosticTest(Base):
    __tablename__ = "diagnostic_tests"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, index=True)
    patient_name = Column(String)
    test_name = Column(String)
    status = Column(String)  # Pending, In Progress, Ready, Completed
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    result = Column(String, nullable=True)


class Billing(Base):
    __tablename__ = "billing"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, index=True)
    patient_name = Column(String)
    items = Column(String)  # JSON list of line items
    total_amount = Column(Integer)
    payment_status = Column(String)  # Pending, Paid, Insurance
    issued_at = Column(DateTime(timezone=True), server_default=func.now())


class Encounter(Base):
    __tablename__ = "encounters"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("patients.patient_id"), index=True)
    encounter_type = Column(String)  # Outpatient, Emergency, Admission, Follow-up
    reason = Column(String)
    attending_doctor = Column(String, nullable=True)
    status = Column(String)  # Open, Closed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at = Column(DateTime(timezone=True), nullable=True)


class Vitals(Base):
    __tablename__ = "vitals"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("patients.patient_id"), index=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id"), nullable=True)
    temperature_c = Column(Float, nullable=True)
    heart_rate = Column(Integer, nullable=True)
    systolic_bp = Column(Integer, nullable=True)
    diastolic_bp = Column(Integer, nullable=True)
    respiratory_rate = Column(Integer, nullable=True)
    spo2 = Column(Integer, nullable=True)
    weight_kg = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    recorded_by = Column(String, nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())


class ClinicalNote(Base):
    __tablename__ = "clinical_notes"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("patients.patient_id"), index=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id"), nullable=True)
    note_type = Column(String)  # Progress, Nursing, Discharge
    author = Column(String, nullable=True)
    content = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Diagnosis(Base):
    __tablename__ = "diagnoses"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("patients.patient_id"), index=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id"), nullable=True)
    code = Column(String, nullable=True)  # ICD-10
    description = Column(String)
    diagnosed_by = Column(String, nullable=True)
    status = Column(String)  # Active, Resolved
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("patients.patient_id"), index=True)
    encounter_id = Column(Integer, ForeignKey("encounters.id"), nullable=True)
    medication = Column(String)
    dosage = Column(String, nullable=True)
    frequency = Column(String, nullable=True)
    duration = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    prescribed_by = Column(String, nullable=True)
    status = Column(String)  # Active, Stopped
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    hashed_password = Column(String)
    role = Column(String)  # Admin, Doctor, Nurse, Receptionist
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    failed_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    # Set for portal (role="Patient") accounts — links to their own record.
    patient_id = Column(String, nullable=True)


class ConsentEvent(Base):
    """Consent / data-sharing ledger (ABDM-style). Records every FHIR export,
    consent grant/deny, and emergency break-glass access next to the audit trail."""
    __tablename__ = "consent_events"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, index=True)
    event_type = Column(String)   # EXPORT, GRANT, DENY, BREAK_GLASS
    actor = Column(String)        # staff member who triggered it
    party = Column(String, nullable=True)   # who the data went to / who granted
    reason = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String, index=True)
    patient_name = Column(String, nullable=True)
    doctor_name = Column(String, nullable=True)
    department = Column(String, nullable=True)
    scheduled_for = Column(String, nullable=True)
    reason = Column(String, nullable=True)
    status = Column(String)  # Scheduled, Completed, Cancelled
    created_at = Column(DateTime(timezone=True), server_default=func.now())
