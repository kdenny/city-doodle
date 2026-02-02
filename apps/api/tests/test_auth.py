"""Tests for authentication endpoints."""

import pytest

from city_api.routers.auth import hash_password, verify_password, generate_session_token


class TestPasswordHashing:
    """Tests for password hashing utilities."""

    def test_hash_password_returns_string(self):
        """Hash password should return a string."""
        result = hash_password("test_password")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_hash_password_different_each_time(self):
        """Same password should produce different hashes (due to salt)."""
        hash1 = hash_password("test_password")
        hash2 = hash_password("test_password")
        assert hash1 != hash2

    def test_verify_password_correct(self):
        """Verify password should return True for correct password."""
        password = "test_password"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """Verify password should return False for incorrect password."""
        hashed = hash_password("correct_password")
        assert verify_password("wrong_password", hashed) is False


class TestSessionToken:
    """Tests for session token generation."""

    def test_generate_session_token_length(self):
        """Session token should be 64 characters (32 bytes hex)."""
        token = generate_session_token()
        assert len(token) == 64

    def test_generate_session_token_unique(self):
        """Each token should be unique."""
        tokens = [generate_session_token() for _ in range(100)]
        assert len(set(tokens)) == 100

    def test_generate_session_token_hex(self):
        """Token should be valid hexadecimal."""
        token = generate_session_token()
        int(token, 16)  # Should not raise


class TestAuthEndpoints:
    """Integration tests for auth endpoints."""

    def test_register_endpoint_exists(self):
        """Register endpoint should be defined."""
        from city_api.routers.auth import register
        assert register is not None

    def test_login_endpoint_exists(self):
        """Login endpoint should be defined."""
        from city_api.routers.auth import login
        assert login is not None

    def test_logout_endpoint_exists(self):
        """Logout endpoint should be defined."""
        from city_api.routers.auth import logout
        assert logout is not None

    def test_me_endpoint_exists(self):
        """Me endpoint should be defined."""
        from city_api.routers.auth import get_me
        assert get_me is not None
