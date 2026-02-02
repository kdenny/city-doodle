"""User and auth schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    """Base user schema."""

    email: EmailStr


class UserCreate(UserBase):
    """User registration request."""

    password: str


class UserLogin(UserBase):
    """User login request."""

    password: str


class UserResponse(UserBase):
    """User response schema."""

    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class SessionResponse(BaseModel):
    """Session response schema."""

    token: str
    expires_at: datetime


class AuthResponse(BaseModel):
    """Authentication response with user and session."""

    user: UserResponse
    session: SessionResponse
