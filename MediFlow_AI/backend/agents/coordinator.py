"""
Coordinator Agent - The main brain. Orchestrates all sub-agents in sequence
when a new patient is registered. This is what makes the system truly "agentic".

Flow:
  1. Intake Agent    -> analyze symptoms, assign priority
  2. Doctor Agent    -> assign best doctor
  3. Diagnostic Agent -> suggest tests
  4. Bed Agent       -> assign bed (if Emergency/High)
  5. Log all actions to AgentLog table
"""

from agents.intake_agent import run_intake_agent
from agents.doctor_agent import run_doctor_assignment_agent
from agents.diagnostic_agent import run_diagnostic_agent
from agents.bed_agent import run_bed_agent


def run_coordinator(patient_name: str, age: int, symptoms: str, db_session) -> dict:
    """
    Full agentic pipeline. Runs all agents in sequence.
    Returns a dict with all decisions made.
    """
    from models import schemas

    results = {}
    logs = []

    # ──────────────────────────────────────────────
    # STEP 1: Patient Intake Agent
    # ──────────────────────────────────────────────
    print(f"[Coordinator] Running Intake Agent for {patient_name}...")
    intake_result = run_intake_agent(patient_name, age, symptoms)
    priority = intake_result["priority"]
    specialization = intake_result["recommended_specialization"]
    results["intake"] = intake_result

    logs.append(schemas.AgentLog(
        agent_name="Patient Intake",
        action_type="TRIAGE",
        message=f"Patient '{patient_name}' assessed as {priority} priority. Reason: {intake_result['reason']} [via {intake_result.get('source', 'unknown')}]"
    ))

    # ──────────────────────────────────────────────
    # STEP 2: Doctor Assignment Agent
    # ──────────────────────────────────────────────
    print(f"[Coordinator] Running Doctor Assignment Agent (need: {specialization})...")
    all_doctors = [
        {"id": d.id, "name": d.name, "specialization": d.specialization,
         "status": d.status, "current_patient_count": d.current_patient_count}
        for d in db_session.query(schemas.Doctor).all()
    ]
    doctor_result = run_doctor_assignment_agent(patient_name, symptoms, specialization, all_doctors)
    results["doctor"] = doctor_result

    logs.append(schemas.AgentLog(
        agent_name="Doctor Assignment",
        action_type="ASSIGN",
        message=f"Assigned {doctor_result['doctor_name']} to '{patient_name}'. {doctor_result['reason']}"
    ))

    # Update doctor's patient count in DB
    if doctor_result["doctor_id"]:
        doc = db_session.query(schemas.Doctor).filter(schemas.Doctor.id == doctor_result["doctor_id"]).first()
        if doc:
            doc.current_patient_count += 1
            if doc.current_patient_count >= 5:
                doc.status = "Busy"

    # ──────────────────────────────────────────────
    # STEP 3: Diagnostic Agent
    # ──────────────────────────────────────────────
    print(f"[Coordinator] Running Diagnostic Agent...")
    suggested_tests = run_diagnostic_agent(patient_name, symptoms, priority)
    results["diagnostics"] = suggested_tests

    for test_name in suggested_tests:
        db_session.add(schemas.DiagnosticTest(
            patient_id="PENDING",  # updated after patient record created
            patient_name=patient_name,
            test_name=test_name,
            status="Pending"
        ))

    logs.append(schemas.AgentLog(
        agent_name="Diagnostic",
        action_type="SCHEDULE",
        message=f"Suggested tests for '{patient_name}': {', '.join(suggested_tests)}"
    ))

    # ──────────────────────────────────────────────
    # STEP 4: Bed Management Agent (Emergency + High)
    # ──────────────────────────────────────────────
    # ──────────────────────────────────────────────
    # STEP 4: Bed Management Agent (All Admitted Patients)
    # ──────────────────────────────────────────────
    print(f"[Coordinator] Running Bed Agent for {priority} patient...")
    all_beds = [
        {"id": b.id, "bed_number": b.bed_number, "ward": b.ward, "status": b.status}
        for b in db_session.query(schemas.Bed).all()
    ]
    
    # Pass priority AND symptoms to the new upgraded agent
    bed_result = run_bed_agent(priority, symptoms, all_beds)
    results["bed"] = bed_result

    # Note: We don't need to update the DB status here anymore because 
    # we already added that logic into patients.py in our last step!

    logs.append(schemas.AgentLog(
        agent_name="Bed Management",
        action_type="ALLOCATE",
        message=f"Bed {bed_result.get('bed_number', 'N/A')} ({bed_result.get('ward', 'N/A')}) assigned to '{patient_name}'. {bed_result['reason']}"
    ))

    results["bed"] = bed_result

    # ──────────────────────────────────────────────
    # STEP 5: Save all logs
    # ──────────────────────────────────────────────
    for log in logs:
        db_session.add(log)

    db_session.add(schemas.AgentLog(
        agent_name="Coordinator",
        action_type="COMPLETE",
        message=f"All agents completed for '{patient_name}'. Doctor: {doctor_result['doctor_name']}, Tests: {', '.join(suggested_tests)}, Bed: {bed_result.get('bed_number', 'N/A')}"
    ))

    db_session.commit()
    print(f"[Coordinator] Pipeline complete for {patient_name}.")
    return results
