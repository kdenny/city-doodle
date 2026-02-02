"""Worker configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Worker settings loaded from environment variables."""

    database_url: str = "postgresql+asyncpg://localhost/city_doodle"

    # Worker configuration
    poll_interval_seconds: float = 1.0
    max_concurrent_jobs: int = 2
    job_timeout_seconds: int = 300

    # Logging
    log_level: str = "info"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
