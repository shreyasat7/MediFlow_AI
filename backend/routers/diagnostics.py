from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import database, schemas
from pydantic import BaseModel
from auth import security

router = APIRouter()


class DiagnosticCreate(BaseModel):
    patient_id: str
    patient_name: str
    test_name: str


@router.get("/")
def get_diagnostics(db: Session = Depends(database.get_db),
                    user: schemas.User = Depends(security.require_roles("Admin", "Doctor", "Nurse"))):
    q = db.query(schemas.DiagnosticTest)
    if user.role == "Doctor":
        # Only tests for this doctor's patients.
        mine = [p.patient_id for p in security.scope_patients(db.query(schemas.Patient), user).all()]
        q = q.filter(schemas.DiagnosticTest.patient_id.in_(mine or ["__none__"]))
    return q.order_by(schemas.DiagnosticTest.id.desc()).all()


@router.post("/")
def schedule_diagnostic(test: DiagnosticCreate,
                        db: Session = Depends(database.get_db),
                        user: schemas.User = Depends(security.require_roles("Admin", "Doctor", "Nurse"))):
    new_test = schemas.DiagnosticTest(**test.model_dump(), status="Pending")
    db.add(new_test)
    db.add(schemas.AgentLog(agent_name="Diagnostic", action_type="SCHEDULE",
                            message=f"Scheduled {test.test_name} for {test.patient_name}.",
                            actor=user.full_name))
    db.commit()
    db.refresh(new_test)
    return new_test


@router.patch("/{test_id}/status")
def update_test_status(test_id: int, payload: dict,
                       db: Session = Depends(database.get_db),
                       user: schemas.User = Depends(security.require_roles("Admin", "Doctor", "Nurse"))):
    test = db.query(schemas.DiagnosticTest).filter(schemas.DiagnosticTest.id == test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    test.status = payload.get("status", test.status)
    if "result" in payload:
        test.result = payload.get("result")
    db.add(schemas.AgentLog(agent_name="Diagnostic", action_type="UPDATE",
                            message=f"Test '{test.test_name}' for {test.patient_name} updated to {test.status}.",
                            actor=user.full_name))
    db.commit()
    db.refresh(test)
    return test
