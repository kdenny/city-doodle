"""FastAPI dependencies for City Doodle API."""

from datetime import UTC, datetime
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from city_api.config import settings
from city_api.database import get_db
from city_api.models import Session, User

# Placeholder user ID for development mode
DEV_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


async def get_current_user(
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    db: AsyncSession = Depends(get_db),
) -> UUID:
    """
    Get the current authenticated user ID.

    In dev mode (AUTH_MODE=dev):
        - Accepts X-User-Id header for testing
        - Falls back to DEV_USER_ID if no header provided

    In production mode (AUTH_MODE=production):
        - Requires Authorization: Bearer <token> header
        - Validates token against session database
        - Returns 401 if invalid or expired
    """
    if settings.auth_mode == "dev":
        # Dev mode: use X-User-Id header or default dev user
        if x_user_id:
            try:
                return UUID(x_user_id)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid user ID format",
                )
        return DEV_USER_ID

    # Production mode: require Bearer token
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization[7:]

    result = await db.execute(
        select(Session).where(Session.token == token).where(Session.expires_at > datetime.now(UTC))
    )
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return session.user_id


async def get_current_user_model(
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Get the current authenticated user as a User model.

    Use this when you need the full User object, not just the ID.
    """
    user_id = await get_current_user(authorization, x_user_id, db)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user
