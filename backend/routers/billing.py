from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models import database, schemas
from auth import security

router = APIRouter()


@router.get("/")
def get_billing(db: Session = Depends(database.get_db),
                user: schemas.User = Depends(security.require_roles("Admin", "Doctor", "Receptionist"))):
    q = db.query(schemas.Billing)
    if user.role == "Doctor":
        mine = [p.patient_id for p in security.scope_patients(db.query(schemas.Patient), user).all()]
        q = q.filter(schemas.Billing.patient_id.in_(mine or ["__none__"]))
    return q.order_by(schemas.Billing.id.desc()).all()


@router.patch("/{bill_id}/pay")
def pay_bill(bill_id: int,
             db: Session = Depends(database.get_db),
             user: schemas.User = Depends(security.require_roles("Admin", "Receptionist"))):
    bill = db.query(schemas.Billing).filter(schemas.Billing.id == bill_id).first()
    if bill:
        bill.payment_status = "Paid"
        db.add(schemas.AgentLog(agent_name="Billing", action_type="PAYMENT",
                                message=f"Bill #{bill.id} for {bill.patient_name} marked Paid.",
                                actor=user.full_name))
        db.commit()
        db.refresh(bill)
    return bill
