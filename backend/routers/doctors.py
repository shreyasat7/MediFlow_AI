from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models import database, schemas
from auth import security

router = APIRouter()


@router.get("/")
def get_doctors(db: Session = Depends(database.get_db),
                _: schemas.User = Depends(security.get_current_user)):
    return db.query(schemas.Doctor).all()
