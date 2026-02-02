"""Job repository - data access for background jobs."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from city_api.models import Job as JobModel
from city_api.schemas import Job, JobCreate, JobStatus


async def create_job(db: AsyncSession, job_create: JobCreate, user_id: UUID) -> Job:
    """Create a new job."""
    job = JobModel(
        user_id=user_id,
        type=job_create.type.value,
        status=JobStatus.PENDING.value,
        tile_id=job_create.tile_id,
        params=job_create.params or {},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return _to_schema(job)


async def get_job(db: AsyncSession, job_id: UUID) -> Job | None:
    """Get a job by ID."""
    result = await db.execute(select(JobModel).where(JobModel.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        return None
    return _to_schema(job)


async def list_jobs_by_user(db: AsyncSession, user_id: UUID, limit: int = 50) -> list[Job]:
    """List jobs for a user, most recent first."""
    result = await db.execute(
        select(JobModel)
        .where(JobModel.user_id == user_id)
        .order_by(JobModel.created_at.desc())
        .limit(limit)
    )
    jobs = result.scalars().all()
    return [_to_schema(j) for j in jobs]


async def list_jobs_by_tile(db: AsyncSession, tile_id: UUID, limit: int = 50) -> list[Job]:
    """List jobs for a tile, most recent first."""
    result = await db.execute(
        select(JobModel)
        .where(JobModel.tile_id == tile_id)
        .order_by(JobModel.created_at.desc())
        .limit(limit)
    )
    jobs = result.scalars().all()
    return [_to_schema(j) for j in jobs]


async def update_job_status(
    db: AsyncSession,
    job_id: UUID,
    status: JobStatus,
    result: dict | None = None,
    error: str | None = None,
) -> Job | None:
    """Update job status and optionally set result/error."""
    query_result = await db.execute(select(JobModel).where(JobModel.id == job_id))
    job = query_result.scalar_one_or_none()
    if job is None:
        return None

    now = datetime.now(UTC)
    job.status = status.value

    if status == JobStatus.RUNNING:
        job.claimed_at = now
    elif status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
        job.completed_at = now

    if result is not None:
        job.result = result
    if error is not None:
        job.error = error

    await db.commit()
    await db.refresh(job)
    return _to_schema(job)


async def cancel_job(db: AsyncSession, job_id: UUID, user_id: UUID) -> Job | None:
    """Cancel a job if it's pending and owned by the user."""
    result = await db.execute(select(JobModel).where(JobModel.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        return None
    if job.user_id != user_id:
        return None
    if job.status != JobStatus.PENDING.value:
        return None

    return await update_job_status(db, job_id, JobStatus.CANCELLED)


def _to_schema(job: JobModel) -> Job:
    """Convert SQLAlchemy model to Pydantic schema."""
    return Job(
        id=job.id,
        user_id=job.user_id,
        type=job.type,
        status=job.status,
        tile_id=job.tile_id,
        params=job.params,
        result=job.result,
        error=job.error,
        created_at=job.created_at,
        started_at=job.claimed_at,  # Map claimed_at to started_at for schema compatibility
        completed_at=job.completed_at,
    )
