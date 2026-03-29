from fastapi import APIRouter, Request, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from authlib.integrations.starlette_client import OAuth
from authlib.integrations.starlette_client import OAuthError
from dotenv import load_dotenv
import os
import logging

from database import SessionLocal
from models import User
from auth import create_token

logger = logging.getLogger(__name__)
load_dotenv()

router = APIRouter()

oauth = OAuth()

# Register Google OAuth
oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
    authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
    token_url="https://oauth2.googleapis.com/token",
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/google")
async def google_auth(request: Request):
    """Initiate Google OAuth flow"""
    try:
        redirect_uri = str(request.base_url).rstrip("/") + "/auth/google/callback"
        return await oauth.google.authorize_redirect(request, redirect_uri)
    except Exception as e:
        logger.error(f"Google auth error: {str(e)}")
        raise HTTPException(status_code=500, detail="OAuth initialization failed")


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    """Handle Google OAuth callback"""
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = token.get("userinfo")
        
        if not user_info:
            raise HTTPException(status_code=400, detail="Failed to get user info")

        email = user_info.get("email")
        google_id = user_info.get("sub")

        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")

        # Check if user exists
        db_user = db.query(User).filter(User.email == email).first()

        if not db_user:
            # Create new user with Google auth
            db_user = User(email=email, google_id=google_id)
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
            # Don't refresh, just use the object
        elif db_user.google_id is None:
            # Update google_id if user exists but doesn't have it
            db_user.google_id = google_id
            db.commit()

        # Create JWT token
        jwt_token = create_token({"user_id": db_user.id})
        
        # Redirect to frontend with token
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        return RedirectResponse(
            url=f"{frontend_url}/oauth-success?token={jwt_token}",
            status_code=302
        )
        
    except OAuthError as e:
        logger.error(f"OAuth error: {str(e)}")
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        return RedirectResponse(url=f"{frontend_url}/?error=oauth_failed")
    except Exception as e:
        logger.error(f"Callback error: {str(e)}", exc_info=True)
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
        return RedirectResponse(url=f"{frontend_url}/?error=server_error")