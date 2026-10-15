"""Patient chart + clinical record CRUD (encounters, vitals, notes, diagnoses,
prescriptions). Every chart open is logged for PHI-access audit; prescribing is
a hard-stop (HTTP 409) unless an audited override is supplied."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from models import database, schemas
from auth import security
import clinical_safety
import deterioration

router = APIRouter()

# Physiologic sanity bounds for validation (reject impossible values at the API).
VITAL_BOUNDS = {
    "temperature_c": (25, 45),
    "heart_rate": (0, 300),
    "systolic_bp": (0, 400),
    "diastolic_bp": (0, 300),
    "respiratory_rate": (0, 100),
    "spo2": (0, 100),
    "weight_kg": (0, 500),
    "height_cm": (0, 260),
}


def _serialize_vitals(v):
    """Vitals row + computed out-of-range safety flags."""
    data = {
        "id": v.id, "patient_id": v.patient_id, "encounter_id": v.encounter_id,
        "temperature_c": v.temperature_c, "heart_rate": v.heart_rate,
        "systolic_bp": v.systolic_bp, "diastolic_bp": v.diastolic_bp,
        "respiratory_rate": v.respiratory_rate, "spo2": v.spo2,
        "weight_kg": v.weight_kg, "height_cm": v.height_cm,
        "recorded_by": v.recorded_by,
        "recorded_at": v.recorded_at.isoformat() if v.recorded_at else None,
    }
    data["flags"] = clinical_safety.flag_vitals(data)
    data["news2"] = deterioration.news2(data)
    return data


def _get_patient_or_404(patient_id, db, user):
    patient = db.query(schemas.Patient).filter(schemas.Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    security.authorize_patient(patient, user)
    return patient


@router.get("/{patient_id}/chart")
def get_patient_chart(patient_id: str,
                      db: Session = Depends(database.get_db),
                      user: schemas.User = Depends(security.get_current_user)):
    patient = _get_patient_or_404(patient_id, db, user)
    # PHI access audit
    db.add(schemas.AgentLog(agent_name="Access", action_type="VIEW",
                            message=f"{user.full_name} ({user.role}) opened chart for {patient_id}.",
                            actor=user.full_name))
    db.commit()
    db.refresh(patient)
    encounters = db.query(schemas.Encounter).filter(
        schemas.Encounter.patient_id == patient_id).order_by(schemas.Encounter.id.desc()).all()
    vitals = [_serialize_vitals(v) for v in db.query(schemas.Vitals).filter(
        schemas.Vitals.patient_id == patient_id).order_by(schemas.Vitals.id.desc()).all()]
    notes = db.query(schemas.ClinicalNote).filter(
        schemas.ClinicalNote.patient_id == patient_id).order_by(schemas.ClinicalNote.id.desc()).all()
    diagnoses = db.query(schemas.Diagnosis).filter(
        schemas.Diagnosis.patient_id == patient_id).order_by(schemas.Diagnosis.id.desc()).all()
    prescriptions = db.query(schemas.Prescription).filter(
        schemas.Prescription.patient_id == patient_id).order_by(schemas.Prescription.id.desc()).all()
    tests = db.query(schemas.DiagnosticTest).filter(
        schemas.DiagnosticTest.patient_id == patient_id).order_by(schemas.DiagnosticTest.id.desc()).all()
    bills = db.query(schemas.Billing).filter(
        schemas.Billing.patient_id == patient_id).order_by(schemas.Billing.id.desc()).all()
    return {"patient": patient, "encounters": encounters, "vitals": vitals, "notes": notes,
            "diagnoses": diagnoses, "prescriptions": prescriptions, "tests": tests, "bills": bills}


class EncounterCreate(BaseModel):
    encounter_type: str
    reason: Optional[str] = None
    attending_doctor: Optional[str] = None


@router.get("/{patient_id}/encounters")
def list_encounters(patient_id: str, db: Session = Depends(database.get_db),
                    user: schemas.User = Depends(security.get_current_user)):
    _get_patient_or_404(patient_id, db, user)
    return db.query(schemas.Encounter).filter(
        schemas.Encounter.patient_id == patient_id).order_by(schemas.Encounter.id.desc()).all()


@router.post("/{patient_id}/encounters")
def create_encounter(patient_id: str, payload: EncounterCreate,
                     db: Session = Depends(database.get_db),
                     user: schemas.User = Depends(security.require_roles("Admin", "Doctor", "Receptionist"))):
    _get_patient_or_404(patient_id, db, user)
    enc = schemas.Encounter(patient_id=patient_id, status="Open", **payload.model_dump())
    db.add(enc)
    db.commit()
    db.refresh(enc)
    return enc


@router.patch("/{patient_id}/encounters/{encounter_id}/close")
def close_encounter(patient_id: str, encounter_id: int,
                    db: Session = Depends(database.get_db),
                    user: schemas.User = Depends(security.require_roles("Admin", "Doctor"))):
    enc = db.query(schemas.Encounter).filter(
        schemas.Encounter.id == encounter_id, schemas.Encounter.patient_id == patient_id).first()
    if not enc:
        raise HTTPException(status_code=404, detail="Encounter not found")
    enc.status = "Closed"
    enc.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(enc)
    return enc


class VitalsCreate(BaseModel):
    encounter_id: Optional[int] = None
    temperature_c: Optional[float] = None
    heart_rate: Optional[int] = None
    systolic_bp: Optional[int] = None
    diastolic_bp: Optional[int] = None
    respiratory_rate: Optional[int] = None
    spo2: Optional[int] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None

    @field_validator("temperature_c", "heart_rate", "systolic_bp", "diastolic_bp",
                     "respiratory_rate", "spo2", "weight_kg", "height_cm")
    @classmethod
    def _within_bounds(cls, v, info):
        if v is None:
            return None
        lo, hi = VITAL_BOUNDS[info.field_name]
        if not (lo <= v <= hi):
            raise ValueError(f"{info.field_name.replace('_', ' ')} must be between {lo} and {hi}")
        return v


@router.get("/{patient_id}/vitals")
def list_vitals(patient_id: str, db: Session = Depends(database.get_db),
                user: schemas.User = Depends(security.get_current_user)):
    _get_patient_or_404(patient_id, db, user)
    rows = db.query(schemas.Vitals).filter(
        schemas.Vitals.patient_id == patient_id).order_by(schemas.Vitals.id.desc()).all()
    return [_serialize_vitals(v) for v in rows]


@router.post("/{patient_id}/vitals")
def add_vitals(patient_id: str, payload: VitalsCreate,
               db: Session = Depends(database.get_db),
               user: schemas.User = Depends(security.require_roles("Admin", "Doctor", "Nurse"))):
    _get_patient_or_404(patient_id, db, user)
    v = schemas.Vitals(patient_id=patient_id, recorded_by=user.full_name, **payload.model_dump())
    db.add(v)
    db.flush()
    out = _serialize_vitals(v)
    critical = [k for k, level in out["flags"].items() if level == "critical"]
    if critical:
        action = "CRITICAL"
        msg = f"CRITICAL vitals for {patient_id} ({', '.join(critical)}) recorded by {user.full_name}."
    else:
        action = "RECORD"
        msg = f"Vitals recorded for {patient_id} by {user.full_name}."
    db.add(schemas.AgentLog(agent_name="Vitals", action_type=action, message=msg, actor=user.full_name))
    db.commit()
    return out


class NoteCreate(BaseModel):
    encounter_id: Optional[int] = None
    note_type: str = "Progress"
    content: str


@router.get("/{patient_id}/notes")
def list_notes(patient_id: str, db: Session = Depends(database.get_db),
               user: schemas.User = Depends(security.get_current_user)):
    _get_patient_or_404(patient_id, db, user)
    return db.query(schemas.ClinicalNote).filter(
        schemas.ClinicalNote.patient_id == patient_id).order_by(schemas.ClinicalNote.id.desc()).all()


@router.post("/{patient_id}/notes")
def add_note(patient_id: str, payload: NoteCreate,
             db: Session = Depends(database.get_db),
             user: schemas.User = Depends(security.require_roles("Admin", "Doctor", "Nurse"))):
    _get_patient_or_404(patient_id, db, user)
    note = schemas.ClinicalNote(patient_id=patient_id, author=user.full_name, **payload.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


class DiagnosisCreate(BaseModel):
    encounter_id: Optional[int] = None
    code: Optional[str] = None
    description: str
    status: str = "Active"


@router.get("/{patient_id}/diagnoses")
def list_diagnoses(patient_id: str, db: Session = Depends(database.get_db),
                   user: schemas.User = Depends(security.get_current_user)):
    _get_patient_or_404(patient_id, db, user)
    return db.query(schemas.Diagnosis).filter(
        schemas.Diagnosis.patient_id == patient_id).order_by(schemas.Diagnosis.id.desc()).all()


@router.post("/{patient_id}/diagnoses")
def add_diagnosis(patient_id: str, payload: DiagnosisCreate,
                  db: Session = Depends(database.get_db),
                  user: schemas.User = Depends(security.require_roles("Admin", "Doctor"))):
    _get_patient_or_404(patient_id, db, user)
    dx = schemas.Diagnosis(patient_id=patient_id, diagnosed_by=user.full_name, **payload.model_dump())
    db.add(dx)
    db.commit()
    db.refresh(dx)
    return dx


class PrescriptionCreate(BaseModel):
    encounter_id: Optional[int] = None
    medication: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    notes: Optional[str] = None
    override: bool = False
    override_reason: Optional[str] = None


@router.get("/{patient_id}/prescriptions")
def list_prescriptions(patient_id: str, db: Session = Depends(database.get_db),
                       user: schemas.User = Depends(security.get_current_user)):
    _get_patient_or_404(patient_id, db, user)
    return db.query(schemas.Prescription).filter(
        schemas.Prescription.patient_id == patient_id).order_by(schemas.Prescription.id.desc()).all()


def _active_meds(patient_id, db):
    return [p.medication for p in db.query(schemas.Prescription).filter(
        schemas.Prescription.patient_id == patient_id,
        schemas.Prescription.status == "Active").all()]


@router.post("/{patient_id}/prescriptions/safety-check")
def prescription_safety_check(patient_id: str, payload: PrescriptionCreate,
                              db: Session = Depends(database.get_db),
                              user: schemas.User = Depends(security.require_roles("Admin", "Doctor"))):
    """Pre-flight safety check without persisting — lets the UI warn before submit."""
    patient = _get_patient_or_404(patient_id, db, user)
    active = _active_meds(patient_id, db)
    warnings = clinical_safety.check_prescription(payload.medication, patient.allergies, active)
    return {"warnings": warnings}


@router.post("/{patient_id}/prescriptions")
def add_prescription(patient_id: str, payload: PrescriptionCreate,
                     db: Session = Depends(database.get_db),
                     user: schemas.User = Depends(security.require_roles("Admin", "Doctor"))):
    patient = _get_patient_or_404(patient_id, db, user)
    active = _active_meds(patient_id, db)
    warnings = clinical_safety.check_prescription(payload.medication, patient.allergies, active)
    if warnings and not payload.override:
        raise HTTPException(status_code=409,
                            detail={"message": "Clinical safety check failed", "warnings": warnings})
    fields = payload.model_dump(exclude={"override", "override_reason"})
    rx = schemas.Prescription(patient_id=patient_id, prescribed_by=user.full_name, **fields)
    db.add(rx)
    db.add(schemas.AgentLog(agent_name="Pharmacy", action_type="PRESCRIBE",
                            message=f"{payload.medication} prescribed for {patient_id} by {user.full_name}.",
                            actor=user.full_name))
    if warnings and payload.override:
        reason = payload.override_reason or "no reason given"
        crit = "; ".join(w["message"] for w in warnings)
        db.add(schemas.AgentLog(
            agent_name="Pharmacy", action_type="SAFETY_OVERRIDE",
            message=(f"{user.full_name} OVERRODE safety warnings for {payload.medication} "
                     f"({patient_id}). Reason: {reason}. Warnings: {crit}"),
            actor=user.full_name))
    db.commit()
    db.refresh(rx)
    return rx


@router.patch("/{patient_id}/prescriptions/{rx_id}/stop")
def stop_prescription(patient_id: str, rx_id: int,
                      db: Session = Depends(database.get_db),
                      user: schemas.User = Depends(security.require_roles("Admin", "Doctor"))):
    rx = db.query(schemas.Prescription).filter(
        schemas.Prescription.id == rx_id, schemas.Prescription.patient_id == patient_id).first()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    rx.status = "Stopped"
    db.commit()
    db.refresh(rx)
    return rx


class ConsentCreate(BaseModel):
    event_type: str            # GRANT, DENY, BREAK_GLASS
    party: Optional[str] = None
    reason: Optional[str] = None


@router.get("/{patient_id}/consent")
def list_consent(patient_id: str, db: Session = Depends(database.get_db),
                 user: schemas.User = Depends(security.get_current_user)):
    _get_patient_or_404(patient_id, db, user)
    rows = (db.query(schemas.ConsentEvent).filter(schemas.ConsentEvent.patient_id == patient_id)
            .order_by(schemas.ConsentEvent.id.desc()).all())
    return rows


@router.post("/{patient_id}/consent")
def add_consent(patient_id: str, payload: ConsentCreate,
                db: Session = Depends(database.get_db),
                user: schemas.User = Depends(security.get_current_user)):
    """Record a consent grant/deny or an emergency break-glass access."""
    _get_patient_or_404(patient_id, db, user)
    if payload.event_type not in ("GRANT", "DENY", "BREAK_GLASS"):
        raise HTTPException(status_code=400, detail="Invalid consent event type")
    ev = schemas.ConsentEvent(patient_id=patient_id, event_type=payload.event_type,
                              actor=user.full_name, party=payload.party, reason=payload.reason)
    db.add(ev)
    db.add(schemas.AgentLog(agent_name="Consent", action_type=payload.event_type,
                            message=f"{payload.event_type} for {patient_id}"
                                    + (f" — {payload.reason}" if payload.reason else ""),
                            actor=user.full_name))
    db.commit()
    db.refresh(ev)
    return ev
