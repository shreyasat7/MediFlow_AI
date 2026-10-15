from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models import database, schemas
from auth import security

router = APIRouter()


@router.get("/")
def get_beds(db: Session = Depends(database.get_db),
             _: schemas.User = Depends(security.require_roles("Admin", "Nurse"))):
    return db.query(schemas.Bed).all()


@router.patch("/{bed_id}/status")
def update_bed_status(bed_id: int, payload: dict,
                      db: Session = Depends(database.get_db),
                      user: schemas.User = Depends(security.require_roles("Admin", "Nurse"))):
    bed = db.query(schemas.Bed).filter(schemas.Bed.id == bed_id).first()
    if bed:
        bed.status = payload.get("status", bed.status)
        db.add(schemas.AgentLog(agent_name="Bed Management", action_type="BED",
                                message=f"Bed {bed.bed_number} set to {bed.status}.",
                                actor=user.full_name))
        db.commit()
        db.refresh(bed)
    return bed
