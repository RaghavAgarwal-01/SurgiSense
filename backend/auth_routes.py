from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from models import User
from auth import hash_password, verify_password, create_token
from pydantic import BaseModel
router = APIRouter()
class UserCreate(BaseModel):
    email: str
    password: str
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):

    new_user = User(
        email=user.email,
        password=hash_password(user.password)
    )

    db.add(new_user)
    db.commit()

    return {"message": "User created"}

@router.post("/login")
def login(user: UserCreate, db: Session = Depends(get_db)):

    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user:
        raise HTTPException(status_code=400, detail="User not found")

    if not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=400, detail="Wrong password")

    token = create_token({"user_id": db_user.id})

    return {"token": token}