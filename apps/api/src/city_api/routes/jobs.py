"""Job endpoints for background processing."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from city_api.dependencies import get_current_user
from city_api.repositories import job_repository
from city_api.schemas import Job, JobCreate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("", response_model=Job, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_create: JobCreate,
    user_id: UUID = Depends(get_current_user),
) -> Job:
    """
    Create a new background job.

    Jobs are created with 'pending' status and will be picked up by
    a worker process for execution.

    Job types:
    - terrain_generation: Generate terrain for a tile
    - seed_placement: Place a seed on a tile
    - growth_simulation: Simulate city growth
    - vmt_calculation: Calculate VMT metrics
    - export_png: Export as PNG image
    - export_gif: Export as GIF animation
    """
    return job_repository.create(job_create, user_id)


@router.get("", response_model=list[Job])
async def list_jobs(
    tile_id: UUID | None = Query(default=None, description="Filter by tile ID"),
    limit: int = Query(default=50, ge=1, le=100, description="Max results"),
    user_id: UUID = Depends(get_current_user),
) -> list[Job]:
    """
    List jobs for the current user.

    Returns most recent jobs first. Optionally filter by tile ID.
    """
    if tile_id:
        # Filter to jobs the user owns on this tile
        tile_jobs = job_repository.list_by_tile(tile_id, limit)
        return [j for j in tile_jobs if j.user_id == user_id][:limit]
    return job_repository.list_by_user(user_id, limit)


@router.get("/{job_id}", response_model=Job)
async def get_job(
    job_id: UUID,
    user_id: UUID = Depends(get_current_user),
) -> Job:
    """
    Get a job by ID.

    Returns the job status and result (if completed).
    Only the job owner can access their jobs.
    """
    job = job_repository.get(job_id)
    if job is None:
        logger.warning("Job not found: job_id=%s user_id=%s", job_id, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )
    if job.user_id != user_id:
        logger.warning(
            "Unauthorized job access: job_id=%s owner=%s requester=%s",
            job_id,
            job.user_id,
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access job owned by another user",
        )
    return job


@router.post("/{job_id}/cancel", response_model=Job)
async def cancel_job(
    job_id: UUID,
    user_id: UUID = Depends(get_current_user),
) -> Job:
    """
    Cancel a pending job.

    Only the job owner can cancel a job, and only if it's still pending.
    Jobs that are already running cannot be cancelled.
    """
    job = job_repository.get(job_id)
    if job is None:
        logger.warning("Cancel failed - job not found: job_id=%s user_id=%s", job_id, user_id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    cancelled = job_repository.cancel(job_id, user_id)
    if cancelled is None:
        if job.user_id != user_id:
            logger.warning(
                "Unauthorized job cancel: job_id=%s owner=%s requester=%s",
                job_id,
                job.user_id,
                user_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot cancel job owned by another user",
            )
        logger.info(
            "Cannot cancel job in current state: job_id=%s status=%s user_id=%s",
            job_id,
            job.status.value,
            user_id,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot cancel job with status '{job.status.value}'",
        )

    return cancelled
