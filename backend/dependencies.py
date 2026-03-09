from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
from jose import jwt
from sqlalchemy.orm import Session
from database import SessionLocal
from models import User
from auth import SECRET_KEY, ALGORITHM

security = HTTPBearer()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token=Depends(security),
    db: Session = Depends(get_db)
):

    payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[ALGORITHM])

    user_id = payload.get("user_id")

    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(status_code=401, detail="Invalid user")

    return user