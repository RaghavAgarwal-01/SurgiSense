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
    clean_email = user.email.strip().lower()
    
    # DEBUG PRINT: Watch your terminal when you click the button
    print(f"--- SIGNUP ATTEMPT: {clean_email} ---")
    
    existing_user = db.query(User).filter(User.email == clean_email).first()
    
    # DEBUG PRINT: This will tell us if the DB actually found a match
    print(f"Existing user found in DB? {existing_user is not None}")

    if existing_user:
        print("MATCH FOUND: Sending 400 Error")
        raise HTTPException(status_code=400, detail="Email already registered")

    print("NO MATCH: Creating new user...")
    new_user = User(
        email=clean_email,
        password=hash_password(user.password)
    )

    db.add(new_user)
    db.commit()
    return {"message": "User created"}
@router.get("/debug/users")
def get_all_users(db: Session = Depends(get_db)):
    # This will fetch every single user in the database
    users = db.query(User).all()
    return [{"id": u.id, "email": u.email, "google_id": u.google_id} for u in users]
@router.post("/login")
def login(user: UserCreate, db: Session = Depends(get_db)):

    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user:
        raise HTTPException(status_code=400, detail="User not found")

    if not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=400, detail="Wrong password")

    token = create_token({"user_id": db_user.id})

    return {"token": token}

@router.post("/logout")
def logout():
    """Logout endpoint - clears client-side token"""
    return {"message": "Logged out successfully"}