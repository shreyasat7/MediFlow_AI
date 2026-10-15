"""FHIR R4 interoperability endpoints. Mounted at /fhir (NOT under /api)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from models import database, schemas
from auth import security
import fhir as F

router = APIRouter()


def _patient_or_404(patient_id, db, user):
    p = db.query(schemas.Patient).filter(schemas.Patient.patient_id == patient_id).first()
    if not p:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    security.authorize_patient(p, user)
    return p


@router.get("/metadata")
def capability_statement():
    """Minimal CapabilityStatement so clients can discover what we support."""
    resources = [
        {"type": r, "interaction": [{"code": "read"}, {"code": "search-type"}]}
        for r in ("Patient", "Encounter", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance")
    ]
    return {
        "resourceType": "CapabilityStatement",
        "status": "active",
        "kind": "instance",
        "fhirVersion": "4.0.1",
        "format": ["json"],
        "software": {"name": "MediFlow AI"},
        "rest": [{
            "mode": "server",
            "resource": resources,
            "operation": [{"name": "everything", "definition": "Patient/$everything"}],
        }],
    }


@router.get("/Patient")
def search_patients(name: str = "",
                    db: Session = Depends(database.get_db),
                    user: schemas.User = Depends(security.get_current_user)):
    q = db.query(schemas.Patient)
    if name:
        q = q.filter(schemas.Patient.name.ilike(f"%{name}%"))
    patients = q.order_by(schemas.Patient.id.desc()).limit(50).all()
    return F.bundle([F.patient_to_fhir(p) for p in patients])


@router.get("/Patient/{patient_id}")
def read_patient(patient_id: str,
                 db: Session = Depends(database.get_db),
                 user: schemas.User = Depends(security.get_current_user)):
    return F.patient_to_fhir(_patient_or_404(patient_id, db, user))


@router.get("/Patient/{patient_id}/$everything")
def patient_everything(patient_id: str,
                       db: Session = Depends(database.get_db),
                       user: schemas.User = Depends(security.get_current_user)):
    """The whole record as a single FHIR Bundle — ideal for hand-off/export."""
    patient = _patient_or_404(patient_id, db, user)
    resources = [F.patient_to_fhir(patient)] + F.allergies_to_fhir(patient)
    for e in db.query(schemas.Encounter).filter(schemas.Encounter.patient_id == patient_id).all():
        resources.append(F.encounter_to_fhir(e))
    for v in db.query(schemas.Vitals).filter(schemas.Vitals.patient_id == patient_id).all():
        resources.extend(F.vitals_to_observations(v))
    for t in db.query(schemas.DiagnosticTest).filter(schemas.DiagnosticTest.patient_id == patient_id).all():
        obs = F.test_to_observation(t)
        if obs:
            resources.append(obs)
    for d in db.query(schemas.Diagnosis).filter(schemas.Diagnosis.patient_id == patient_id).all():
        resources.append(F.diagnosis_to_condition(d))
    for m in db.query(schemas.Prescription).filter(schemas.Prescription.patient_id == patient_id).all():
        resources.append(F.prescription_to_medreq(m))
    # Consent ledger: record that the full record was exported.
    db.add(schemas.ConsentEvent(patient_id=patient_id, event_type="EXPORT",
                                actor=user.full_name, party="FHIR export",
                                reason="Full-record FHIR bundle exported"))
    db.add(schemas.AgentLog(agent_name="Consent", action_type="EXPORT",
                            message=f"FHIR full-record export for {patient_id}.", actor=user.full_name))
    db.commit()
    return F.bundle(resources, bundle_type="document")


@router.get("/Encounter")
def search_encounters(patient: str,
                      db: Session = Depends(database.get_db),
                      user: schemas.User = Depends(security.get_current_user)):
    rows = db.query(schemas.Encounter).filter(schemas.Encounter.patient_id == patient).all()
    return F.bundle([F.encounter_to_fhir(e) for e in rows])


@router.get("/Observation")
def search_observations(patient: str,
                        db: Session = Depends(database.get_db),
                        user: schemas.User = Depends(security.get_current_user)):
    out = []
    for v in db.query(schemas.Vitals).filter(schemas.Vitals.patient_id == patient).all():
        out.extend(F.vitals_to_observations(v))
    for t in db.query(schemas.DiagnosticTest).filter(schemas.DiagnosticTest.patient_id == patient).all():
        obs = F.test_to_observation(t)
        if obs:
            out.append(obs)
    return F.bundle(out)


@router.get("/Condition")
def search_conditions(patient: str,
                      db: Session = Depends(database.get_db),
                      user: schemas.User = Depends(security.get_current_user)):
    rows = db.query(schemas.Diagnosis).filter(schemas.Diagnosis.patient_id == patient).all()
    return F.bundle([F.diagnosis_to_condition(d) for d in rows])


@router.get("/MedicationRequest")
def search_medications(patient: str,
                       db: Session = Depends(database.get_db),
                       user: schemas.User = Depends(security.get_current_user)):
    rows = db.query(schemas.Prescription).filter(schemas.Prescription.patient_id == patient).all()
    return F.bundle([F.prescription_to_medreq(m) for m in rows])


@router.get("/AllergyIntolerance")
def search_allergies(patient: str,
                     db: Session = Depends(database.get_db),
                     user: schemas.User = Depends(security.get_current_user)):
    p = db.query(schemas.Patient).filter(schemas.Patient.patient_id == patient).first()
    if not p:
        raise HTTPException(status_code=404, detail=f"Patient {patient} not found")
    return F.bundle(F.allergies_to_fhir(p))
