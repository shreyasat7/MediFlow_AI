"""Create a patient plus their historical record from a plain dict.

Shared by the /patients/import endpoint (file upload) and the dataset seeder,
so both build records identically. Dates on history items are honoured, so an
imported patient can carry years of prior visits.
"""
from datetime import datetime
from models import schemas


def _parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", ""))
    except ValueError:
        return None


DEMOGRAPHIC_FIELDS = [
    "gender", "blood_group", "date_of_birth", "contact", "address",
    "emergency_contact_name", "emergency_contact_phone", "insurance_provider",
    "insurance_id", "allergies", "chronic_conditions",
]


def create_patient_with_history(db, d: dict) -> schemas.Patient:
    """Insert one patient (and any nested history) and return the ORM object.

    Caller is responsible for db.commit(). patient_id is assigned from the PK.
    """
    patient = schemas.Patient(
        name=d["name"],
        age=d.get("age"),
        symptoms=d.get("symptoms", ""),
        priority=d.get("priority", "Normal"),
        status=d.get("status", "Discharged"),
        assigned_doctor=d.get("assigned_doctor"),
        **{f: d.get(f) for f in DEMOGRAPHIC_FIELDS},
    )
    registered = _parse_dt(d.get("registered_at") or d.get("created_at"))
    if registered:
        patient.created_at = registered

    db.add(patient)
    db.flush()
    patient.patient_id = f"P-{1000 + patient.id}"
    pid = patient.patient_id
    default_doc = d.get("assigned_doctor")

    def add_vitals(v, encounter_id=None):
        vit = schemas.Vitals(
            patient_id=pid, encounter_id=encounter_id,
            temperature_c=v.get("temperature_c"), heart_rate=v.get("heart_rate"),
            systolic_bp=v.get("systolic_bp"), diastolic_bp=v.get("diastolic_bp"),
            respiratory_rate=v.get("respiratory_rate"), spo2=v.get("spo2"),
            weight_kg=v.get("weight_kg"), height_cm=v.get("height_cm"),
            recorded_by=v.get("recorded_by", "Imported record"),
        )
        dt = _parse_dt(v.get("date") or v.get("recorded_at"))
        if dt:
            vit.recorded_at = dt
        db.add(vit)

    def add_diagnosis(dx, encounter_id=None):
        cond = schemas.Diagnosis(
            patient_id=pid, encounter_id=encounter_id,
            code=dx.get("code"), description=dx.get("description", ""),
            diagnosed_by=dx.get("diagnosed_by") or default_doc,
            status=dx.get("status", "Active"),
        )
        dt = _parse_dt(dx.get("date") or dx.get("created_at"))
        if dt:
            cond.created_at = dt
        db.add(cond)

    def add_medication(m, encounter_id=None):
        rx = schemas.Prescription(
            patient_id=pid, encounter_id=encounter_id,
            medication=m.get("medication", ""), dosage=m.get("dosage"),
            frequency=m.get("frequency"), duration=m.get("duration"),
            prescribed_by=m.get("prescribed_by") or default_doc,
            status=m.get("status", "Active"),
        )
        dt = _parse_dt(m.get("date") or m.get("created_at"))
        if dt:
            rx.created_at = dt
        db.add(rx)

    def add_note(n, encounter_id=None):
        note = schemas.ClinicalNote(
            patient_id=pid, encounter_id=encounter_id,
            note_type=n.get("note_type", "Progress"),
            author=n.get("author") or default_doc,
            content=n.get("content", ""),
        )
        dt = _parse_dt(n.get("date") or n.get("created_at"))
        if dt:
            note.created_at = dt
        db.add(note)

    # Per-encounter history — nested items carry that encounter's id.
    for e in d.get("encounters", []):
        enc = schemas.Encounter(
            patient_id=pid,
            encounter_type=e.get("encounter_type", "OPD"),
            reason=e.get("reason"),
            attending_doctor=e.get("attending_doctor") or default_doc,
            status=e.get("status", "Closed"),
        )
        dt = _parse_dt(e.get("date") or e.get("created_at"))
        if dt:
            enc.created_at = dt
            enc.closed_at = dt
        db.add(enc)
        db.flush()
        for v in e.get("vitals", []):
            add_vitals(v, enc.id)
        for dx in e.get("diagnoses", []):
            add_diagnosis(dx, enc.id)
        for m in e.get("medications", []):
            add_medication(m, enc.id)
        for n in e.get("notes", []):
            add_note(n, enc.id)

    # Top-level (unlinked) history items — encounter_id stays None.
    for v in d.get("vitals", []):
        add_vitals(v)
    for dx in d.get("diagnoses", []):
        add_diagnosis(dx)
    for m in d.get("medications", []):
        add_medication(m)
    for n in d.get("notes", []):
        add_note(n)

    return patient
