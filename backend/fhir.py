"""ORM → FHIR R4 resource converters.

Pure functions (no DB access) that turn MediFlow ORM objects into FHIR R4 JSON,
used by routers/fhir.py to expose an interoperability surface at /fhir.
"""

PATIENT_SYS = "urn:mediflow:patient-id"

LOINC = {
    "heart_rate": ("8867-4", "Heart rate", "/min"),
    "systolic_bp": ("8480-6", "Systolic blood pressure", "mm[Hg]"),
    "diastolic_bp": ("8462-4", "Diastolic blood pressure", "mm[Hg]"),
    "temperature_c": ("8310-5", "Body temperature", "Cel"),
    "spo2": ("59408-5", "Oxygen saturation in Arterial blood", "%"),
    "respiratory_rate": ("9279-1", "Respiratory rate", "/min"),
    "weight_kg": ("29463-7", "Body weight", "kg"),
    "height_cm": ("8302-2", "Body height", "cm"),
}

ENCOUNTER_CLASS = {
    "Emergency": ("EMER", "emergency"),
    "OPD": ("AMB", "ambulatory"),
    "Admission": ("IMP", "inpatient encounter"),
    "Follow-up": ("AMB", "ambulatory"),
}


def _dt(x):
    if hasattr(x, "isoformat"):
        return x.isoformat()
    return x


def _ref(patient_id):
    return {"reference": f"Patient/{patient_id}"}


def patient_to_fhir(p):
    parts = (p.name or "").split()
    name = {"text": p.name}
    if len(parts) > 1:
        name["family"] = parts[-1]
        name["given"] = parts[:-1]
    elif parts:
        name["given"] = parts
    res = {
        "resourceType": "Patient",
        "id": p.patient_id,
        "identifier": [{"system": PATIENT_SYS, "value": p.patient_id}],
        "active": True,
        "name": [name],
    }
    if p.gender:
        res["gender"] = p.gender.lower()
    if p.date_of_birth:
        res["birthDate"] = p.date_of_birth
    telecom = []
    if p.contact:
        telecom.append({"system": "phone", "value": p.contact, "use": "home"})
    if telecom:
        res["telecom"] = telecom
    if p.address:
        res["address"] = [{"text": p.address}]
    if p.emergency_contact_name:
        res["contact"] = [{
            "relationship": [{"text": "Emergency Contact"}],
            "name": {"text": p.emergency_contact_name},
            "telecom": ([{"system": "phone", "value": p.emergency_contact_phone}]
                        if p.emergency_contact_phone else []),
        }]
    if p.blood_group:
        res["extension"] = [{
            "url": "urn:mediflow:blood-group",
            "valueString": p.blood_group,
        }]
    return res


def allergies_to_fhir(p):
    out = []
    for i, allergen in enumerate(a.strip() for a in (p.allergies or "").split(",") if a.strip()):
        out.append({
            "resourceType": "AllergyIntolerance",
            "id": f"{p.patient_id}-allergy-{i + 1}",
            "clinicalStatus": {"coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
                "code": "active",
            }]},
            "type": "allergy",
            "criticality": "high",
            "code": {"text": allergen},
            "patient": _ref(p.patient_id),
        })
    return out


def encounter_to_fhir(e):
    code, display = ENCOUNTER_CLASS.get(e.encounter_type, ("AMB", "ambulatory"))
    res = {
        "resourceType": "Encounter",
        "id": f"encounter-{e.id}",
        "status": "in-progress" if e.status == "Open" else "finished",
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": code,
            "display": display,
        },
        "subject": _ref(e.patient_id),
        "period": {"start": _dt(e.created_at)},
    }
    if e.closed_at:
        res["period"]["end"] = _dt(e.closed_at)
    if e.reason:
        res["reasonCode"] = [{"text": e.reason}]
    if e.attending_doctor:
        res["participant"] = [{"individual": {"display": e.attending_doctor}}]
    return res


def vitals_to_observations(v):
    """One FHIR Observation per recorded vital sign."""
    out = []
    for field, (loinc, display, unit) in LOINC.items():
        value = getattr(v, field, None)
        if value is None:
            continue
        out.append({
            "resourceType": "Observation",
            "id": f"vitals-{v.id}-{field}",
            "status": "final",
            "category": [{"coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "vital-signs",
                "display": "Vital Signs",
            }]}],
            "code": {
                "coding": [{"system": "http://loinc.org", "code": loinc, "display": display}],
                "text": display,
            },
            "subject": _ref(v.patient_id),
            "effectiveDateTime": _dt(v.recorded_at),
            "valueQuantity": {
                "value": value, "unit": unit,
                "system": "http://unitsofmeasure.org", "code": unit,
            },
        })
    return out


def test_to_observation(t):
    """Lab/diagnostic result as an Observation (only if a result was captured)."""
    if not t.result:
        return None
    return {
        "resourceType": "Observation",
        "id": f"test-{t.id}",
        "status": "final",
        "category": [{"coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
            "code": "laboratory",
            "display": "Laboratory",
        }]}],
        "code": {"text": t.test_name},
        "subject": _ref(t.patient_id),
        "effectiveDateTime": _dt(t.requested_at),
        "valueString": t.result,
    }


def diagnosis_to_condition(d):
    code = {"text": d.description}
    if d.code:
        code["coding"] = [{
            "system": "http://hl7.org/fhir/sid/icd-10",
            "code": d.code,
            "display": d.description,
        }]
    return {
        "resourceType": "Condition",
        "id": f"condition-{d.id}",
        "clinicalStatus": {"coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
            "code": "active" if d.status == "Active" else "resolved",
        }]},
        "code": code,
        "subject": _ref(d.patient_id),
        "recordedDate": _dt(d.created_at),
        "recorder": {"display": d.diagnosed_by} if d.diagnosed_by else None,
    }


def prescription_to_medreq(m):
    dosage = " ".join(x for x in (m.dosage, m.frequency, m.duration) if x)
    return {
        "resourceType": "MedicationRequest",
        "id": f"medication-{m.id}",
        "status": "active" if m.status == "Active" else "stopped",
        "intent": "order",
        "medicationCodeableConcept": {"text": m.medication},
        "subject": _ref(m.patient_id),
        "authoredOn": _dt(m.created_at),
        "requester": {"display": m.prescribed_by} if m.prescribed_by else None,
        "dosageInstruction": [{"text": dosage}] if dosage else [],
    }


def bundle(resources, bundle_type="searchset"):
    clean = [r for r in resources if r]
    return {
        "resourceType": "Bundle",
        "type": bundle_type,
        "total": len(clean),
        "entry": [{"resource": r} for r in clean],
    }
