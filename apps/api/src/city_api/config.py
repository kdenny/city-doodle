"""Application configuration."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    database_url: str = "postgresql+asyncpg://localhost/city_doodle"
    database_url_sync: str = "postgresql://localhost/city_doodle"

    session_expire_days: int = 7

    # Auth mode: "dev" uses X-User-Id header, "production" uses Bearer token
    auth_mode: str = "dev"

    # CORS configuration
    frontend_url: str = "http://localhost:5173"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://city-doodle-web.vercel.app",
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
