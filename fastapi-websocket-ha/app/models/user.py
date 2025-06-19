from typing import Optional
from pydantic import BaseModel


class User(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    is_active: bool = True


class UserAuth(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    is_active: bool
