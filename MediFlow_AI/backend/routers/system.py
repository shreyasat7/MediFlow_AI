from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from models import database, schemas
from auth import security

router = APIRouter()


@router.get("/logs")
def get_agent_logs(db: Session = Depends(database.get_db),
                   _: schemas.User = Depends(security.require_roles("Admin"))):
    return db.query(schemas.AgentLog).order_by(schemas.AgentLog.timestamp.desc()).limit(100).all()


@router.get("/kpis")
def get_kpis(db: Session = Depends(database.get_db),
             user: schemas.User = Depends(security.get_current_user)):
    total_patients = security.scope_patients(db.query(schemas.Patient), user).count()
    active_emergencies = security.scope_patients(
        db.query(schemas.Patient).filter(schemas.Patient.priority == "Emergency"), user).count()
    waiting = security.scope_patients(
        db.query(schemas.Patient).filter(schemas.Patient.status.in_(["Waiting", "In Treatment"])), user).count()
    doctors_avail = db.query(schemas.Doctor).filter(schemas.Doctor.status == "Available").count()
    beds_occupied = db.query(schemas.Bed).filter(schemas.Bed.status == "Occupied").count()
    # Live estimate: scales with how many patients are currently in the queue.
    est = waiting * 12
    avg_wait = f"{est} min" if est < 60 else f"{est // 60}h {est % 60}m"
    return {
        "total_patients": total_patients,
        "active_emergencies": active_emergencies,
        "avg_wait_time": avg_wait,
        "doctors_available": doctors_avail,
        "beds_occupied": beds_occupied,
        "in_queue": waiting,
    }


@router.get("/visit-trend")
def visit_trend(db: Session = Depends(database.get_db),
                _: schemas.User = Depends(security.get_current_user)):
    """Encounter (visit) volume grouped by month — the most recent 6 months present."""
    rows = db.execute(text(
        "SELECT strftime('%Y-%m', created_at) AS m, COUNT(*) AS c "
        "FROM encounters WHERE created_at IS NOT NULL GROUP BY m ORDER BY m DESC LIMIT 6"
    )).all()
    return [{"month": m, "visits": c} for m, c in reversed(rows)]


@router.get("/agent-stats")
def get_agent_stats(db: Session = Depends(database.get_db),
                    _: schemas.User = Depends(security.require_roles("Admin"))):
    rows = db.query(schemas.AgentLog.agent_name, func.count(schemas.AgentLog.id)).group_by(
        schemas.AgentLog.agent_name).all()
    return {"by_agent": {name: count for name, count in rows},
            "total_events": db.query(schemas.AgentLog).count()}


@router.get("/patient-flow")
def get_patient_flow(db: Session = Depends(database.get_db),
                     _: schemas.User = Depends(security.require_roles("Admin"))):
    statuses = ["Waiting", "In Treatment", "Admitted", "Discharged"]
    return [{"status": s,
             "count": db.query(schemas.Patient).filter(schemas.Patient.status == s).count()}
            for s in statuses]


@router.get("/analytics")
def get_analytics(db: Session = Depends(database.get_db),
                  _: schemas.User = Depends(security.require_roles("Admin"))):
    priorities = ["Emergency", "High", "Normal"]
    by_priority = [{"priority": p,
                    "count": db.query(schemas.Patient).filter(schemas.Patient.priority == p).count()}
                   for p in priorities]
    by_ward = [{"ward": ward,
                "count": db.query(schemas.Bed).filter(schemas.Bed.ward == ward).count()}
               for (ward,) in db.query(schemas.Bed.ward).distinct().all()]
    by_status = [{"status": s,
                  "count": db.query(schemas.Patient).filter(schemas.Patient.status == s).count()}
                 for s in ["Waiting", "In Treatment", "Admitted", "Discharged"]]

    # Financials
    revenue = db.query(func.coalesce(func.sum(schemas.Billing.total_amount), 0)).scalar() or 0
    by_payment = []
    paid_amount = 0
    for st in ["Paid", "Pending", "Insurance"]:
        q = db.query(schemas.Billing).filter(schemas.Billing.payment_status == st)
        amt = db.query(func.coalesce(func.sum(schemas.Billing.total_amount), 0)).filter(
            schemas.Billing.payment_status == st).scalar() or 0
        by_payment.append({"status": st, "count": q.count(), "amount": amt})
        if st in ("Paid", "Insurance"):
            paid_amount += amt

    total_bills = db.query(schemas.Billing).count()
    total_patients = db.query(schemas.Patient).count()
    avg_bill = int(revenue / total_bills) if total_bills else 0
    collection_rate = round((paid_amount / revenue) * 100) if revenue else 0

    # Top diagnoses
    top_dx = db.execute(text(
        "SELECT description, COUNT(*) c FROM diagnoses WHERE description IS NOT NULL "
        "GROUP BY description ORDER BY c DESC LIMIT 5")).all()

    return {
        "by_priority": by_priority,
        "by_ward": by_ward,
        "by_status": by_status,
        "by_payment": by_payment,
        "total_revenue": revenue,
        "totals": {
            "patients": total_patients, "bills": total_bills, "avg_bill": avg_bill,
            "collected": paid_amount, "outstanding": revenue - paid_amount,
            "collection_rate": collection_rate,
        },
        "top_diagnoses": [{"description": d, "count": c} for d, c in top_dx],
    }
