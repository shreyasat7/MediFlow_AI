"""Authentication + user administration endpoints."""
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models import database, schemas
from auth import security

router = APIRouter()

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    is_active: bool
    patient_id: Optional[str] = None

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserCreate(BaseModel):
    username: str
    full_name: str
    password: str
    role: str
    specialization: Optional[str] = None


class SignupRequest(BaseModel):
    username: str
    full_name: str
    password: str
    role: str
    specialization: Optional[str] = None


def _create_user_record(db, username, full_name, password, role,
                        specialization=None, actor=None, min_len=8):
    if role not in security.ROLES:
        raise HTTPException(status_code=400, detail=f"Role must be one of {security.ROLES}")
    if len(password) < min_len:
        raise HTTPException(status_code=400, detail=f"Password must be at least {min_len} characters")
    if not username.strip() or not full_name.strip():
        raise HTTPException(status_code=400, detail="Username and full name are required")
    if db.query(schemas.User).filter(schemas.User.username == username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = schemas.User(username=username, full_name=full_name,
                        hashed_password=security.hash_password(password),
                        role=role, is_active=True)
    db.add(user)
    if role == "Doctor":
        db.add(schemas.Doctor(name=full_name, specialization=specialization or "General",
                              status="Available", current_patient_count=0))
    db.add(schemas.AgentLog(agent_name="Access", action_type="SIGNUP",
                            message=f"Account '{username}' ({role}) created.", actor=actor))
    db.commit()
    db.refresh(user)
    return user


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ActiveToggle(BaseModel):
    is_active: bool


def _now():
    return datetime.now(timezone.utc)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(database.get_db)):
    # Accept either the user ID (username) or the full name as the login identifier.
    ident = (payload.username or "").strip()
    user = db.query(schemas.User).filter(
        (schemas.User.username == ident) | (schemas.User.full_name == ident)
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    locked_until = user.locked_until
    if locked_until:
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until > _now():
            mins = int((locked_until - _now()).total_seconds() // 60) + 1
            raise HTTPException(status_code=423, detail=f"Account locked. Try again in {mins} minute(s).")

    if not security.verify_password(payload.password, user.hashed_password):
        user.failed_attempts = (user.failed_attempts or 0) + 1
        if user.failed_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = _now() + timedelta(minutes=LOCKOUT_MINUTES)
            user.failed_attempts = 0
            db.add(schemas.AgentLog(agent_name="Access", action_type="LOCKOUT",
                                    message=f"Account '{user.username}' locked after repeated failed logins.",
                                    actor=user.username))
        db.commit()
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    user.failed_attempts = 0
    user.locked_until = None
    db.commit()
    token = security.create_access_token(subject=user.username, role=user.role)
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/register", response_model=TokenResponse)
def register(payload: SignupRequest, db: Session = Depends(database.get_db)):
    """Public self-service signup — creates the account and logs the user in."""
    user = _create_user_record(db, username=payload.username, full_name=payload.full_name,
                               password=payload.password, role=payload.role,
                               specialization=payload.specialization, actor=payload.username)
    token = security.create_access_token(subject=user.username, role=user.role)
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def me(current_user: schemas.User = Depends(security.get_current_user)):
    return current_user


@router.post("/change-password")
def change_password(payload: PasswordChange, db: Session = Depends(database.get_db),
                    current_user: schemas.User = Depends(security.get_current_user)):
    if not security.verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    current_user.hashed_password = security.hash_password(payload.new_password)
    db.add(schemas.AgentLog(agent_name="Access", action_type="PASSWORD",
                            message=f"{current_user.full_name} changed their password.",
                            actor=current_user.full_name))
    db.commit()
    return {"message": "Password updated"}


@router.get("/users", response_model=List[UserResponse])
def list_users(db: Session = Depends(database.get_db),
               _: schemas.User = Depends(security.require_roles("Admin"))):
    return db.query(schemas.User).order_by(schemas.User.id.asc()).all()


@router.post("/users", response_model=UserResponse)
def create_user(payload: UserCreate, db: Session = Depends(database.get_db),
                admin: schemas.User = Depends(security.require_roles("Admin"))):
    return _create_user_record(db, username=payload.username, full_name=payload.full_name,
                               password=payload.password, role=payload.role,
                               specialization=payload.specialization, actor=admin.full_name)


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(database.get_db),
                admin: schemas.User = Depends(security.require_roles("Admin"))):
    user = db.query(schemas.User).filter(schemas.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    if user.role == "Doctor":
        doc = db.query(schemas.Doctor).filter(schemas.Doctor.name == user.full_name).first()
        if doc:
            has_patients = db.query(schemas.Patient).filter(
                schemas.Patient.assigned_doctor == user.full_name).first()
            if has_patients:
                doc.status = "Off-Duty"
            else:
                db.delete(doc)
    db.add(schemas.AgentLog(agent_name="Access", action_type="DELETE",
                            message=f"{admin.full_name} deleted account '{user.username}' ({user.role}).",
                            actor=admin.full_name))
    db.delete(user)
    db.commit()
    return {"message": f"Deleted account {user.username}"}


class PasswordReset(BaseModel):
    new_password: str


@router.post("/users/{user_id}/reset-password")
def admin_reset_password(user_id: int, payload: PasswordReset,
                         db: Session = Depends(database.get_db),
                         admin: schemas.User = Depends(security.require_roles("Admin"))):
    user = db.query(schemas.User).filter(schemas.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    user.hashed_password = security.hash_password(payload.new_password)
    user.failed_attempts = 0
    user.locked_until = None
    db.add(schemas.AgentLog(agent_name="Access", action_type="RESET",
                            message=f"{admin.full_name} reset the password for {user.username}.",
                            actor=admin.full_name))
    db.commit()
    return {"message": f"Password reset for {user.username}"}


@router.patch("/users/{user_id}/active", response_model=UserResponse)
def set_user_active(user_id: int, payload: ActiveToggle,
                    db: Session = Depends(database.get_db),
                    admin: schemas.User = Depends(security.require_roles("Admin"))):
    user = db.query(schemas.User).filter(schemas.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    user.is_active = payload.is_active
    verb = "activated" if payload.is_active else "deactivated"
    db.add(schemas.AgentLog(agent_name="Access", action_type="USER",
                            message=f"{admin.full_name} {verb} account {user.username}.",
                            actor=admin.full_name))
    db.commit()
    db.refresh(user)
    return user
