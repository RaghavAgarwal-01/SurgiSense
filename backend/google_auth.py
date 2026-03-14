from fastapi import APIRouter, Request, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
from dotenv import load_dotenv
import os

from database import SessionLocal
from models import User
from auth import create_token

load_dotenv()

router = APIRouter()

oauth = OAuth()

oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/google")
async def login_google(request: Request):

    redirect_uri = request.url_for("google_callback")

    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):

    token = await oauth.google.authorize_access_token(request)

    user = token["userinfo"]

    email = user["email"]
    google_id = user["sub"]

    # check if user exists
    db_user = db.query(User).filter(User.email == email).first()

    if not db_user:

        db_user = User(
            email=email,
            google_id=google_id
        )

        db.add(db_user)
        db.commit()
        db.refresh(db_user)

    # create JWT token
    jwt_token = create_token({"user_id": db_user.id})

    # redirect to frontend
    return RedirectResponse(
        f"http://localhost:5173/oauth-success?token={jwt_token}"
    )