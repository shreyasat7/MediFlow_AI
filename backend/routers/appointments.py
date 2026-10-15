"""Appointment booking + status updates (doctor-scoped listing)."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models import database, schemas
from auth import security

router = APIRouter()


class AppointmentCreate(BaseModel):
    patient_id: str
    patient_name: Optional[str] = None
    doctor_name: Optional[str] = None
    department: Optional[str] = None
    scheduled_for: Optional[str] = None
    reason: Optional[str] = None


@router.get("/")
def list_appointments(status: Optional[str] = None,
                      db: Session = Depends(database.get_db),
                      user: schemas.User = Depends(security.get_current_user)):
    q = db.query(schemas.Appointment)
    if user.role == "Doctor":
        q = q.filter(schemas.Appointment.doctor_name == user.full_name)
    elif user.role == "Patient":
        q = q.filter(schemas.Appointment.patient_id == user.patient_id)
    if status:
        q = q.filter(schemas.Appointment.status == status)
    return q.order_by(schemas.Appointment.scheduled_for.asc()).all()


@router.post("/")
def create_appointment(payload: AppointmentCreate,
                       db: Session = Depends(database.get_db),
                       user: schemas.User = Depends(security.require_roles("Admin", "Doctor", "Receptionist"))):
    appt = schemas.Appointment(**payload.model_dump(), status="Scheduled")
    db.add(appt)
    db.add(schemas.AgentLog(
        agent_name="Scheduling", action_type="BOOK",
        message=f"Appointment booked for {payload.patient_name} with {payload.doctor_name}.",
        actor=user.full_name,
    ))
    db.commit()
    db.refresh(appt)
    return appt


@router.patch("/{appt_id}/status")
def update_status(appt_id: int, payload: dict,
                  db: Session = Depends(database.get_db),
                  _: schemas.User = Depends(security.require_roles("Admin", "Doctor", "Receptionist"))):
    appt = db.query(schemas.Appointment).filter(schemas.Appointment.id == appt_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    new_status = payload.get("status")
    if new_status not in ("Scheduled", "Completed", "Cancelled"):
        raise HTTPException(status_code=400, detail="Invalid status")
    appt.status = new_status
    db.commit()
    db.refresh(appt)
    return appt
