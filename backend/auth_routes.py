from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models import User
from auth import hash_password, verify_password, create_token
from pydantic import BaseModel
from dependencies import get_db
from email_validator import validate_email, EmailNotValidError
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class UserCreate(BaseModel):
    email: str
    password: str

def validate_user_email(email: str) -> str:
    try:
        valid = validate_email(email.strip().lower())
        return valid.email
    except EmailNotValidError:
        raise HTTPException(status_code=400, detail="Invalid email format")


@router.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    clean_email = validate_user_email(user.email)
    logger.info(f"Signup attempt for email: {clean_email}")
    
    existing_user = db.query(User).filter(User.email == clean_email).first()

    if existing_user:
        logger.warning(f"Signup failed: email already exists - {clean_email}")
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=clean_email,
        password=hash_password(user.password)
    )

    db.add(new_user)
    db.commit()
    logger.info(f"User created successfully: {clean_email}")
    return {"status": "success", "message": "User created successfully"}
@router.post("/login")
def login(user: UserCreate, db: Session = Depends(get_db)):
    clean_email = validate_user_email(user.email)
    logger.info(f"Login attempt for email: {clean_email}")

    db_user = db.query(User).filter(User.email == clean_email).first()

    if not db_user:
        logger.warning(f"Login failed: user not found - {clean_email}")
        raise HTTPException(status_code=400, detail="Invalid credentials")

    if not verify_password(user.password, db_user.password):
        logger.warning(f"Login failed: wrong password - {clean_email}")
        raise HTTPException(status_code=400, detail="Invalid credentials")

    token = create_token({"user_id": db_user.id})
    logger.info(f"User logged in successfully: {clean_email}")
    return {"status": "success", "token": token}

@router.post("/logout")
def logout():
    """Logout endpoint - clears client-side token"""
    logger.info("User logged out")
    return {"status": "success", "message": "Logged out successfully"}