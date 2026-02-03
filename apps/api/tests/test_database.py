"""Tests for database module."""

from city_api.database import transform_database_url_for_asyncpg


class TestTransformDatabaseUrl:
    """Tests for URL transformation."""

    def test_transforms_sslmode_to_ssl(self):
        """Test that sslmode=require becomes ssl=require."""
        url = "postgresql+asyncpg://user:pass@host/db?sslmode=require"
        result = transform_database_url_for_asyncpg(url)
        assert "ssl=require" in result
        assert "sslmode=require" not in result

    def test_handles_url_without_sslmode(self):
        """Test that URLs without sslmode are unchanged."""
        url = "postgresql+asyncpg://user:pass@host/db"
        result = transform_database_url_for_asyncpg(url)
        assert result == url

    def test_handles_neon_style_url(self):
        """Test with a typical Neon database URL."""
        url = "postgresql+asyncpg://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
        result = transform_database_url_for_asyncpg(url)
        assert "ssl=require" in result
        assert "sslmode=" not in result
        # Ensure rest of URL is preserved
        assert "ep-xxx.us-east-1.aws.neon.tech" in result
        assert "neondb" in result

    def test_handles_different_ssl_modes(self):
        """Test that other SSL modes are also transformed."""
        url = "postgresql+asyncpg://host/db?sslmode=verify-full"
        result = transform_database_url_for_asyncpg(url)
        assert "ssl=verify-full" in result
        assert "sslmode=" not in result
