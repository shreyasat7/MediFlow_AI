"""Authentication & authorization primitives.

Password hashing uses bcrypt directly (avoids passlib/bcrypt version issues).
Tokens are stateless JWTs. Role checks are expressed as FastAPI dependencies.
"""
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from models import database, schemas

SECRET_KEY = os.getenv("JWT_SECRET", "dev-insecure-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

ROLES = ["Admin", "Doctor", "Nurse", "Receptionist"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(database.get_db),
) -> schemas.User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exc
    except jwt.PyJWTError:
        raise credentials_exc

    user = db.query(schemas.User).filter(schemas.User.username == username).first()
    if user is None or not user.is_active:
        raise credentials_exc
    return user


def require_roles(*allowed_roles: str):
    """Dependency factory: allow the route only for the given roles."""
    def checker(current_user: schemas.User = Depends(get_current_user)) -> schemas.User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {', '.join(allowed_roles)}",
            )
        return current_user
    return checker


def scope_patients(query, user):
    if user.role == "Doctor":
        return query.filter(schemas.Patient.assigned_doctor == user.full_name)
    if user.role == "Patient":
        return query.filter(schemas.Patient.patient_id == user.patient_id)
    return query


def can_access_patient(patient, user) -> bool:
    if user.role == "Doctor":
        return patient.assigned_doctor == user.full_name
    if user.role == "Patient":
        return patient.patient_id == user.patient_id
    return True


def authorize_patient(patient, user):
    if not can_access_patient(patient, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This patient is not assigned to you.",
        )
