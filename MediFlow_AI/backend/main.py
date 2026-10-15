import asyncio
import contextlib
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

# Load .env (GROQ_API_KEY, JWT_SECRET, FERNET_KEY, ...) BEFORE importing modules
# that read those keys — though the AI helpers also read lazily, just in case.
load_dotenv()

from models import database, schemas
from auth import security
from routers import (
    auth, patients, clinical, system, doctors, beds,
    diagnostics, billing, appointments, ai as ai_router, fhir as fhir_router,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("mediflow")

# Create tables
schemas.Base.metadata.create_all(bind=database.engine)

SEED_USER_PASSWORD = os.getenv("SEED_USER_PASSWORD", "changeme123")

# Professional doctor roster (username, full_name, specialization). full_name is
# the key patients link to via assigned_doctor, so it must stay stable.
SEED_DOCTORS = [
    ("dr.sharma", "Dr. Aarav Sharma", "Cardiology"),
    ("dr.rao", "Dr. Vikram Rao", "Cardiology"),
    ("dr.nair", "Dr. Priya Nair", "Neurology"),
    ("dr.oberoi", "Dr. Rohan Oberoi", "Orthopedics"),
    ("dr.gupta", "Dr. Neha Gupta", "General"),
    ("dr.reddy", "Dr. Karan Reddy", "Pediatrics"),
    ("dr.mehta", "Dr. Anjali Mehta", "Emergency"),
    ("dr.kapoor", "Dr. Sana Kapoor", "Maternity"),
]

# Non-doctor staff (username, full_name, role).
SEED_STAFF = [
    ("admin", "System Administrator", "Admin"),
    ("nurse.joy", "Nurse Joy Mathew", "Nurse"),
    ("reception.desk", "Reception Desk", "Receptionist"),
]


def _run_lightweight_migrations():
    """Add any columns missing from an older DB (SQLite ALTER TABLE ADD COLUMN).

    Idempotent: only adds a column if it isn't already present. Keeps existing
    data intact so we never have to wipe mediflow.db to pick up a new field.
    """
    added_columns = {
        "patients": [
            ("contact", "VARCHAR"), ("date_of_birth", "VARCHAR"), ("gender", "VARCHAR"),
            ("blood_group", "VARCHAR"), ("address", "VARCHAR"),
            ("emergency_contact_name", "VARCHAR"), ("emergency_contact_phone", "VARCHAR"),
            ("insurance_provider", "VARCHAR"), ("insurance_id", "VARCHAR"),
            ("allergies", "VARCHAR"), ("chronic_conditions", "VARCHAR"),
            ("identity_confirmed", "BOOLEAN DEFAULT 1"),
        ],
        "agent_logs": [("actor", "VARCHAR")],
        "diagnostic_tests": [("result", "VARCHAR")],
        "prescriptions": [("notes", "VARCHAR")],
        "users": [("failed_attempts", "INTEGER DEFAULT 0"), ("locked_until", "DATETIME"),
                  ("patient_id", "VARCHAR")],
    }
    with database.engine.begin() as conn:
        for table, cols in added_columns.items():
            try:
                existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            except Exception:
                continue
            if not existing:
                continue
            for name, decl in cols:
                if name not in existing:
                    try:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {decl}"))
                        logger.info("migration: added %s.%s", table, name)
                    except Exception as exc:
                        logger.warning("migration skip %s.%s: %s", table, name, exc)


def _seed(db):
    """Idempotently ensure the seed doctors, staff users and beds exist."""
    # Doctor pool records + doctor user accounts
    for username, full_name, spec in SEED_DOCTORS:
        if not db.query(schemas.Doctor).filter(schemas.Doctor.name == full_name).first():
            db.add(schemas.Doctor(name=full_name, specialization=spec,
                                  status="Available", current_patient_count=0))
        if not db.query(schemas.User).filter(schemas.User.username == username).first():
            db.add(schemas.User(username=username, full_name=full_name,
                                hashed_password=security.hash_password(SEED_USER_PASSWORD),
                                role="Doctor", is_active=True))
    # Non-doctor staff accounts
    for username, full_name, role in SEED_STAFF:
        if not db.query(schemas.User).filter(schemas.User.username == username).first():
            db.add(schemas.User(username=username, full_name=full_name,
                                hashed_password=security.hash_password(SEED_USER_PASSWORD),
                                role=role, is_active=True))
    # Beds
    if not db.query(schemas.Bed).first():
        beds_list = []
        for w in ["General", "ICU", "Maternity"]:
            for i in range(1, 7):
                beds_list.append(schemas.Bed(bed_number=f"{w[0]}-{100 + i}", ward=w, status="Available"))
        db.add_all(beds_list)
    db.commit()


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    _run_lightweight_migrations()
    db = database.SessionLocal()
    with db:
        _seed(db)

    # Insecure-default warnings
    if security.SECRET_KEY == "dev-insecure-secret-change-me":
        logger.warning("JWT_SECRET is the insecure dev default — set JWT_SECRET in production.")
    import crypto
    if crypto.USING_DEV_KEY:
        logger.warning("FERNET_KEY is the dev default — PHI encryption is not production-secure.")
    if SEED_USER_PASSWORD == "changeme123":
        logger.warning("SEED_USER_PASSWORD is the default 'changeme123' — change it in production.")
    yield


app = FastAPI(title="MediFlow AI API", lifespan=lifespan)

_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router mounts
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(patients.router, prefix="/api/patients", tags=["Patients"])
app.include_router(clinical.router, prefix="/api/patients", tags=["Clinical Record"])
app.include_router(system.router, prefix="/api/system", tags=["System (Coordinator Agent)"])
app.include_router(doctors.router, prefix="/api/doctors", tags=["Doctors"])
app.include_router(beds.router, prefix="/api/beds", tags=["Bed Management"])
app.include_router(diagnostics.router, prefix="/api/diagnostics", tags=["Diagnostics"])
app.include_router(billing.router, prefix="/api/billing", tags=["Billing"])
app.include_router(appointments.router, prefix="/api/appointments", tags=["Appointments"])
app.include_router(ai_router.router, prefix="/api/ai", tags=["AI Assistant"])
app.include_router(fhir_router.router, prefix="/fhir", tags=["FHIR R4"])


@app.get("/")
def read_root():
    groq_status = "✅ Connected" if os.getenv("GROQ_API_KEY") else "⚠️ Not set (using rule-based fallback)"
    return {"message": "Welcome to MediFlow AI API", "groq_status": groq_status, "docs": "/docs"}


@app.websocket("/ws/activity")
async def ws_activity(websocket: WebSocket):
    """Live agent-activity feed. Auth via ?token=<jwt> query param (browsers
    can't set headers on the WS handshake). Polls AgentLog and pushes new rows."""
    token = websocket.query_params.get("token", "")
    try:
        import jwt as _jwt
        _jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
    except Exception:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    last_id = 0
    db = database.SessionLocal()
    try:
        # Prime last_id to the newest existing log so we only stream new activity.
        latest = db.query(schemas.AgentLog).order_by(schemas.AgentLog.id.desc()).first()
        last_id = latest.id if latest else 0
        while True:
            rows = (db.query(schemas.AgentLog)
                    .filter(schemas.AgentLog.id > last_id)
                    .order_by(schemas.AgentLog.id.asc()).all())
            for r in rows:
                last_id = r.id
                await websocket.send_json({
                    "id": r.id, "agent_name": r.agent_name, "action_type": r.action_type,
                    "message": r.message, "actor": r.actor,
                    "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                })
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
    finally:
        db.close()
