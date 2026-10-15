from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import database, schemas
from pydantic import BaseModel
from typing import List, Optional
from agents.coordinator import run_coordinator
from auth import security
from patient_import import create_patient_with_history
import deterioration

router = APIRouter()


class PatientCreate(BaseModel):
    name: str
    age: int
    symptoms: str
    contact: Optional[str] = None
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_id: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None


class PatientResponse(BaseModel):
    id: int
    patient_id: str
    name: str
    age: int
    symptoms: str
    priority: str
    status: str
    assigned_doctor: Optional[str] = None

    class Config:
        from_attributes = True


class PatientFullResponse(PatientResponse):
    suggested_tests: Optional[List[str]] = []
    bed_number: Optional[str] = None
    ward: Optional[str] = None
    triage_reason: Optional[str] = None
    confidence: Optional[float] = None
    alternatives: Optional[List[dict]] = []


class ImportRequest(BaseModel):
    patients: List[dict]


class EmergencyAdmit(BaseModel):
    gender: Optional[str] = None   # "Male"/"Female" if visually apparent, else Unknown
    notes: Optional[str] = None    # e.g. "RTA, unconscious, brought by ambulance"


class IdentifyPatient(BaseModel):
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    contact: Optional[str] = None
    date_of_birth: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None


@router.get("/", response_model=List[PatientResponse])
def get_patients(q: Optional[str] = None, skip: int = 0, limit: int = 200,
                 db: Session = Depends(database.get_db),
                 user: schemas.User = Depends(security.get_current_user)):
    query = db.query(schemas.Patient)
    query = security.scope_patients(query, user)
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            schemas.Patient.name.ilike(term) | schemas.Patient.patient_id.ilike(term)
        )
    return query.order_by(schemas.Patient.id.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=PatientFullResponse)
def register_patient(patient: PatientCreate,
                     db: Session = Depends(database.get_db),
                     user: schemas.User = Depends(security.require_roles("Admin", "Receptionist"))):
    agent_results = run_coordinator(
        patient_name=patient.name, age=patient.age, symptoms=patient.symptoms, db_session=db)

    priority = agent_results["intake"]["priority"]
    doctor_name = agent_results["doctor"].get("doctor_name")
    bed_info = agent_results.get("bed", {})
    suggested_tests = agent_results.get("diagnostics", [])
    status = "In Treatment" if priority == "Emergency" else "Waiting"

    new_patient = schemas.Patient(
        name=patient.name, age=patient.age, symptoms=patient.symptoms,
        priority=priority, status=status, assigned_doctor=doctor_name,
        contact=patient.contact, date_of_birth=patient.date_of_birth, gender=patient.gender,
        blood_group=patient.blood_group, address=patient.address,
        emergency_contact_name=patient.emergency_contact_name,
        emergency_contact_phone=patient.emergency_contact_phone,
        insurance_provider=patient.insurance_provider, insurance_id=patient.insurance_id,
        allergies=patient.allergies, chronic_conditions=patient.chronic_conditions,
    )
    db.add(new_patient)
    db.flush()  # collision-proof MRN from the autoincrement PK
    new_patient.patient_id = f"P-{1000 + new_patient.id}"
    patient_id = new_patient.patient_id

    # Auto-open an encounter for this visit
    db.add(schemas.Encounter(patient_id=patient_id, encounter_type="OPD",
                             reason=patient.symptoms, attending_doctor=doctor_name, status="Open"))

    bed_number = bed_info.get("bed_number")
    if bed_number:
        assigned_bed = db.query(schemas.Bed).filter(schemas.Bed.bed_number == bed_number).first()
        if assigned_bed:
            assigned_bed.status = "Occupied"
            assigned_bed.patient_id = patient_id

    for t in db.query(schemas.DiagnosticTest).filter(
            schemas.DiagnosticTest.patient_name == patient.name,
            schemas.DiagnosticTest.patient_id == "PENDING").all():
        t.patient_id = patient_id

    db.add(schemas.AgentLog(agent_name="Registration", action_type="REGISTER",
                            message=f"Patient {patient.name} registered as {patient_id}.",
                            actor=user.full_name))
    db.commit()
    db.refresh(new_patient)

    return PatientFullResponse(
        id=new_patient.id, patient_id=new_patient.patient_id, name=new_patient.name,
        age=new_patient.age, symptoms=new_patient.symptoms, priority=new_patient.priority,
        status=new_patient.status, assigned_doctor=new_patient.assigned_doctor,
        suggested_tests=suggested_tests, bed_number=bed_info.get("bed_number"),
        ward=bed_info.get("ward"), triage_reason=agent_results["intake"].get("reason"),
        confidence=agent_results["intake"].get("confidence"),
        alternatives=agent_results["intake"].get("alternatives", []))


@router.post("/emergency", response_model=PatientFullResponse)
def emergency_admit(payload: EmergencyAdmit,
                    db: Session = Depends(database.get_db),
                    user: schemas.User = Depends(security.require_roles("Admin", "Doctor", "Nurse", "Receptionist"))):
    """Unknown-patient ("John Doe") admission. Bypasses name/age validation to
    start clinical work immediately: forces Emergency priority, assigns a trauma
    doctor and an ICU bed, and marks the record identity-unconfirmed."""
    gender = payload.gender if payload and payload.gender in ("Male", "Female") else None
    label = gender or "Unknown"
    symptoms = ((payload.notes or "").strip() if payload else "") or \
        "Unidentified emergency admission — history unavailable"

    p = schemas.Patient(name="Unknown", age=None, symptoms=symptoms,
                        priority="Emergency", status="In Treatment",
                        gender=gender, identity_confirmed=False)
    db.add(p)
    db.flush()
    p.patient_id = f"P-{1000 + p.id}"
    p.name = f"Unknown {label} — {p.patient_id}"

    # Trauma doctor: prefer an available Emergency specialist, else least-busy available.
    doc = (db.query(schemas.Doctor)
           .filter(schemas.Doctor.specialization == "Emergency", schemas.Doctor.status == "Available")
           .order_by(schemas.Doctor.current_patient_count.asc()).first()
           or db.query(schemas.Doctor).filter(schemas.Doctor.status == "Available")
           .order_by(schemas.Doctor.current_patient_count.asc()).first())
    if doc:
        p.assigned_doctor = doc.name
        doc.current_patient_count = (doc.current_patient_count or 0) + 1
        if doc.current_patient_count >= 5:
            doc.status = "Busy"

    # ICU bed (fall back to any available bed).
    bed = (db.query(schemas.Bed).filter(schemas.Bed.ward == "ICU", schemas.Bed.status == "Available").first()
           or db.query(schemas.Bed).filter(schemas.Bed.status == "Available").first())
    bed_number = ward = None
    if bed:
        bed.status = "Occupied"
        bed.patient_id = p.patient_id
        bed_number, ward = bed.bed_number, bed.ward

    db.add(schemas.Encounter(patient_id=p.patient_id, encounter_type="Emergency",
                             reason="Unidentified emergency admission",
                             attending_doctor=p.assigned_doctor, status="Open"))
    for agent, act, msg in [
        ("Patient Intake", "TRIAGE", f"UNKNOWN PATIENT {p.patient_id} — identity unconfirmed. Triage forced to EMERGENCY."),
        ("Doctor Assignment", "ASSIGN", f"Trauma doctor {p.assigned_doctor or 'N/A'} assigned to {p.patient_id}."),
        ("Bed Management", "ALLOCATE", f"ICU bed {bed_number or 'N/A'} allocated to {p.patient_id}."),
        ("Coordinator", "EMERGENCY", f"Emergency admission complete for {p.patient_id}. Awaiting identification."),
    ]:
        db.add(schemas.AgentLog(agent_name=agent, action_type=act, message=msg, actor=user.full_name))
    db.commit()
    db.refresh(p)

    return PatientFullResponse(
        id=p.id, patient_id=p.patient_id, name=p.name, age=0, symptoms=p.symptoms,
        priority=p.priority, status=p.status, assigned_doctor=p.assigned_doctor,
        suggested_tests=["ECG", "Trauma Panel (FAST)", "CBC (Complete Blood Count)"],
        bed_number=bed_number, ward=ward,
        triage_reason="Unidentified emergency — clinical work started before identification.")


@router.patch("/{patient_id}/identify")
def identify_patient(patient_id: str, payload: IdentifyPatient,
                     db: Session = Depends(database.get_db),
                     user: schemas.User = Depends(security.require_roles("Admin", "Doctor", "Nurse", "Receptionist"))):
    """Attach real demographics to a previously-unidentified patient."""
    p = db.query(schemas.Patient).filter(schemas.Patient.patient_id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    security.authorize_patient(p, user)
    p.name = payload.name
    for f in ["age", "gender", "contact", "date_of_birth", "blood_group", "address", "allergies", "chronic_conditions"]:
        val = getattr(payload, f)
        if val not in (None, ""):
            setattr(p, f, val)
    p.identity_confirmed = True
    db.add(schemas.AgentLog(agent_name="Registration", action_type="IDENTIFY",
                            message=f"Identity confirmed for {patient_id}: now {payload.name}.",
                            actor=user.full_name))
    db.commit()
    db.refresh(p)
    return {"message": f"Identity confirmed for {patient_id}.", "name": p.name}


class PortalAccess(BaseModel):
    username: str
    password: str


@router.get("/{patient_id}/portal-access")
def portal_access_status(patient_id: str, db: Session = Depends(database.get_db),
                         user: schemas.User = Depends(security.require_roles("Admin", "Receptionist", "Doctor", "Nurse"))):
    u = db.query(schemas.User).filter(schemas.User.role == "Patient",
                                      schemas.User.patient_id == patient_id).first()
    return {"exists": u is not None, "username": u.username if u else None}


@router.post("/{patient_id}/portal-access")
def grant_portal_access(patient_id: str, payload: PortalAccess,
                        db: Session = Depends(database.get_db),
                        user: schemas.User = Depends(security.require_roles("Admin", "Receptionist"))):
    """Create a read-only patient-portal login linked to this patient record."""
    p = db.query(schemas.Patient).filter(schemas.Patient.patient_id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient not found")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if db.query(schemas.User).filter(schemas.User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(schemas.User).filter(schemas.User.role == "Patient",
                                     schemas.User.patient_id == patient_id).first():
        raise HTTPException(status_code=400, detail="This patient already has portal access")
    u = schemas.User(username=payload.username, full_name=p.name,
                     hashed_password=security.hash_password(payload.password),
                     role="Patient", is_active=True, patient_id=patient_id)
    db.add(u)
    db.add(schemas.AgentLog(agent_name="Access", action_type="PORTAL",
                            message=f"Portal access granted for {patient_id} ({payload.username}).",
                            actor=user.full_name))
    db.commit()
    return {"message": f"Portal access created for {p.name}.", "username": payload.username}


@router.post("/import")
def import_patients(payload: ImportRequest,
                    db: Session = Depends(database.get_db),
                    user: schemas.User = Depends(security.require_roles("Admin", "Receptionist"))):
    created = 0
    for pdata in payload.patients:
        create_patient_with_history(db, pdata)
        created += 1
    db.add(schemas.AgentLog(agent_name="Import", action_type="IMPORT",
                            message=f"Bulk-imported {created} patient(s).", actor=user.full_name))
    db.commit()
    return {"message": f"Imported {created} patient(s).", "count": created}


@router.get("/queue")
def get_queue(db: Session = Depends(database.get_db),
              user: schemas.User = Depends(security.get_current_user)):
    """Active queue, risk-ordered: highest NEWS2 (sickest) first, then priority."""
    query = db.query(schemas.Patient).filter(
        schemas.Patient.status.in_(["Waiting", "In Treatment", "Admitted"]))
    query = security.scope_patients(query, user)
    prio = {"Emergency": 0, "High": 1, "Normal": 2}
    out = []
    for p in query.all():
        latest = (db.query(schemas.Vitals).filter(schemas.Vitals.patient_id == p.patient_id)
                  .order_by(schemas.Vitals.id.desc()).first())
        n = deterioration.news2({
            "respiratory_rate": latest.respiratory_rate, "spo2": latest.spo2,
            "temperature_c": latest.temperature_c, "systolic_bp": latest.systolic_bp,
            "heart_rate": latest.heart_rate,
        } if latest else {})
        out.append({
            "id": p.id, "patient_id": p.patient_id, "name": p.name, "age": p.age or 0,
            "symptoms": p.symptoms, "priority": p.priority, "status": p.status,
            "assigned_doctor": p.assigned_doctor, "identity_confirmed": p.identity_confirmed,
            "news2": n["score"], "news2_band": n["band"], "news2_response": n["response"],
        })
    out.sort(key=lambda x: (-(x["news2"] if x["news2"] is not None else -1), prio.get(x["priority"], 3)))
    return out


@router.patch("/{patient_id}/discharge")
def discharge_patient(patient_id: str,
                      db: Session = Depends(database.get_db),
                      user: schemas.User = Depends(security.require_roles("Admin", "Doctor", "Nurse"))):
    patient = db.query(schemas.Patient).filter(schemas.Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    security.authorize_patient(patient, user)

    patient.status = "Discharged"

    bed = db.query(schemas.Bed).filter(schemas.Bed.patient_id == patient_id).first()
    if bed:
        bed.status = "Cleaning"
        bed.patient_id = None

    if patient.assigned_doctor:
        doctor = db.query(schemas.Doctor).filter(schemas.Doctor.name == patient.assigned_doctor).first()
        if doctor and (doctor.current_patient_count or 0) > 0:
            doctor.current_patient_count -= 1

    tests = db.query(schemas.DiagnosticTest).filter(
        schemas.DiagnosticTest.patient_id == patient_id).all()
    items = ["Doctor Consultation (Rs. 500)"]
    total_cost = 500
    for t in tests:
        items.append(f"{t.test_name} (Rs. 800)")
        total_cost += 800

    db.add(schemas.Billing(
        patient_id=patient.patient_id, patient_name=patient.name,
        items=", ".join(items), total_amount=total_cost, payment_status="Pending"))

    # Follow-up / readmission risk (5th agent)
    from agents.followup_agent import assess_readmission
    visit_count = db.query(schemas.Encounter).filter(
        schemas.Encounter.patient_id == patient_id).count()
    has_followup = db.query(schemas.Appointment).filter(
        schemas.Appointment.patient_id == patient_id,
        schemas.Appointment.status == "Scheduled").first() is not None
    risk = assess_readmission(patient, visit_count, has_followup)

    db.add(schemas.ClinicalNote(
        patient_id=patient.patient_id, note_type="Discharge", author=user.full_name,
        content=(f"Patient discharged by {user.full_name}. Final bill Rs. {total_cost}. "
                 f"30-day readmission risk: {risk['band']} (score {risk['score']}). "
                 f"Factors: {'; '.join(risk['factors']) or 'none'}. {risk['advice']}")))

    db.add(schemas.AgentLog(
        agent_name="Follow-up Risk", action_type="READMIT_RISK",
        message=f"{patient.name}: {risk['band']} 30-day readmission risk (score {risk['score']}). {risk['advice']}",
        actor=user.full_name))
    db.add(schemas.AgentLog(
        agent_name="Billing & Discharge", action_type="DISCHARGE",
        message=f"Patient {patient.name} discharged. Bill: Rs. {total_cost}.",
        actor=user.full_name))

    db.commit()
    return {"message": f"Patient {patient.name} discharged successfully.",
            "readmission_risk": risk, "bill_total": total_cost}
