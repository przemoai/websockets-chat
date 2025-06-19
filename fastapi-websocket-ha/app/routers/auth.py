from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.core.security import create_access_token
from app.models.token import Token

router = APIRouter(prefix="/auth", tags=["Auth"])


# In a real application, you would check against a database
DEMO_USERS = {
    "demo": {
        "username": "demo",
        "password": "password",  # In a real app, store hashed passwords
        "id": "user-1",
    },
    "admin": {"username": "admin", "password": "admin123", "id": "admin-1"},
}


@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    user = DEMO_USERS.get(form_data.username)
    if not user or user["password"] != form_data.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user["id"], expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}
