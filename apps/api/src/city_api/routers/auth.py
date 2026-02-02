"""Authentication router."""

import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

import bcrypt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from city_api.config import settings
from city_api.database import get_db
from city_api.dependencies import get_current_user_model
from city_api.models import Session, User
from city_api.schemas import AuthResponse, SessionResponse, UserCreate, UserLogin, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def generate_session_token() -> str:
    """Generate a secure random session token."""
    return secrets.token_hex(32)


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """Register a new user."""
    password_hash = hash_password(user_data.password)
    token = generate_session_token()
    expires_at = datetime.now(UTC) + timedelta(days=settings.session_expire_days)

    user = User(email=user_data.email, password_hash=password_hash)
    db.add(user)

    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    session = Session(user_id=user.id, token=token, expires_at=expires_at)
    db.add(session)
    await db.commit()
    await db.refresh(user)

    return AuthResponse(
        user=UserResponse(id=user.id, email=user.email, created_at=user.created_at),
        session=SessionResponse(token=token, expires_at=expires_at),
    )


@router.post("/login", response_model=AuthResponse)
async def login(
    credentials: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """Login with email and password."""
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = generate_session_token()
    expires_at = datetime.now(UTC) + timedelta(days=settings.session_expire_days)

    session = Session(user_id=user.id, token=token, expires_at=expires_at)
    db.add(session)
    await db.commit()

    return AuthResponse(
        user=UserResponse(id=user.id, email=user.email, created_at=user.created_at),
        session=SessionResponse(token=token, expires_at=expires_at),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Logout and invalidate the current session."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )

    token = authorization[7:]

    result = await db.execute(select(Session).where(Session.token == token))
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session token",
        )

    await db.delete(session)
    await db.commit()


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[User, Depends(get_current_user_model)],
) -> UserResponse:
    """Get the current authenticated user."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        created_at=current_user.created_at,
    )
