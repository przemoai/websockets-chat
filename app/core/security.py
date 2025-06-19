from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Union

import jose.exceptions
from jose import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import ValidationError

from app.core.config import settings
from app.core.logger import logger
from app.models.token import TokenPayload
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def create_access_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token.
    """
    if expires_delta:
        expire = datetime.now() + expires_delta
    else:
        expire = datetime.now() + timedelta(
            minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    logger.info(f"Created token for subject: {subject}, expires: {expire}")
    return encoded_jwt


def decode_token(token: str) -> Dict[str, Any]:
    """
    Decode a JWT token and return its payload.
    """
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        logger.info(f"Token decoded successfully for subject: {payload.get('sub')}")
        return payload
    except jose.JWTError as e:
        logger.error(f"JWT decode error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    """
    Get the current user from the token.
    """
    try:
        payload = decode_token(token)
        token_data = TokenPayload(**payload)

        current_time = datetime.now().timestamp()
        if token_data.exp < current_time:
            logger.error(
                f"Token expired. Exp: {token_data.exp}, Current: {current_time}"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except (jose.JWTError, ValidationError) as e:
        logger.error(f"Token validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = User(id=token_data.sub, username=token_data.sub)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def validate_websocket_token(token: str) -> Dict[str, Any]:
    """Validate JWT token for WebSocket connections."""
    try:
        payload = decode_token(token)
        return payload
    except HTTPException:
        logger.error("WebSocket token validation failed")
        raise
