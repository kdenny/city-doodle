"""FastAPI dependencies for City Doodle API."""

from uuid import UUID

from fastapi import Header, HTTPException, status

# Placeholder user ID for development (will be replaced with real auth in CITY-7)
DEV_USER_ID = UUID("00000000-0000-0000-0000-000000000001")


async def get_current_user(
    x_user_id: str | None = Header(default=None, description="User ID (dev only)"),
) -> UUID:
    """
    Get the current authenticated user.

    For development, accepts X-User-Id header.
    Will be replaced with proper JWT/session auth in CITY-7.
    """
    if x_user_id:
        try:
            return UUID(x_user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format",
            )
    # Default to dev user if no header provided
    return DEV_USER_ID
