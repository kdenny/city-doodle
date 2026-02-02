"""Application configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    database_url: str = "postgresql+asyncpg://localhost/city_doodle"
    database_url_sync: str = "postgresql://localhost/city_doodle"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
