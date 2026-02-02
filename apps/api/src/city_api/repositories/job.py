"""Job repository - data access for background jobs."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from city_api.schemas import Job, JobCreate, JobStatus


class JobRepository:
    """In-memory job repository. Will be replaced with database."""

    def __init__(self) -> None:
        self._jobs: dict[UUID, dict] = {}  # job_id -> job data

    def create(self, job_create: JobCreate, user_id: UUID) -> Job:
        """Create a new job."""
        now = datetime.now(UTC)
        job_id = uuid4()

        job_data = {
            "id": job_id,
            "type": job_create.type.value,
            "status": JobStatus.PENDING.value,
            "tile_id": job_create.tile_id,
            "params": job_create.params,
            "result": None,
            "error": None,
            "user_id": user_id,
            "created_at": now,
            "started_at": None,
            "completed_at": None,
        }
        self._jobs[job_id] = job_data
        return self._to_model(job_data)

    def get(self, job_id: UUID) -> Job | None:
        """Get a job by ID."""
        job_data = self._jobs.get(job_id)
        if job_data is None:
            return None
        return self._to_model(job_data)

    def list_by_user(self, user_id: UUID, limit: int = 50) -> list[Job]:
        """List jobs for a user, most recent first."""
        user_jobs = [job for job in self._jobs.values() if job["user_id"] == user_id]
        user_jobs.sort(key=lambda j: j["created_at"], reverse=True)
        return [self._to_model(job) for job in user_jobs[:limit]]

    def list_by_tile(self, tile_id: UUID, limit: int = 50) -> list[Job]:
        """List jobs for a tile, most recent first."""
        tile_jobs = [job for job in self._jobs.values() if job["tile_id"] == tile_id]
        tile_jobs.sort(key=lambda j: j["created_at"], reverse=True)
        return [self._to_model(job) for job in tile_jobs[:limit]]

    def update_status(
        self,
        job_id: UUID,
        status: JobStatus,
        result: dict | None = None,
        error: str | None = None,
    ) -> Job | None:
        """Update job status and optionally set result/error."""
        job_data = self._jobs.get(job_id)
        if job_data is None:
            return None

        now = datetime.now(UTC)
        job_data["status"] = status.value

        if status == JobStatus.RUNNING:
            job_data["started_at"] = now
        elif status in (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED):
            job_data["completed_at"] = now

        if result is not None:
            job_data["result"] = result
        if error is not None:
            job_data["error"] = error

        return self._to_model(job_data)

    def cancel(self, job_id: UUID, user_id: UUID) -> Job | None:
        """Cancel a job if it's pending and owned by the user."""
        job_data = self._jobs.get(job_id)
        if job_data is None:
            return None
        if job_data["user_id"] != user_id:
            return None
        if job_data["status"] != JobStatus.PENDING.value:
            return None

        return self.update_status(job_id, JobStatus.CANCELLED)

    def _to_model(self, job_data: dict) -> Job:
        """Convert internal data to Job model."""
        return Job(
            id=job_data["id"],
            user_id=job_data["user_id"],
            type=job_data["type"],
            status=job_data["status"],
            tile_id=job_data["tile_id"],
            params=job_data["params"],
            result=job_data["result"],
            error=job_data["error"],
            created_at=job_data["created_at"],
            started_at=job_data["started_at"],
            completed_at=job_data["completed_at"],
        )


# Singleton instance for the application
job_repository = JobRepository()
