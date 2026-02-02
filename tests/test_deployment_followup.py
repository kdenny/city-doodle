"""Tests for deployment follow-up (HUMAN ticket generation)."""

import pytest

from lib.vibe.deployment_followup import (
    build_human_followup_body,
    detect_deployment_platforms,
    get_default_human_followup_title,
)


def test_detect_platforms_from_changed_files() -> None:
    platforms = detect_deployment_platforms(
        changed_files=["fly.toml", "vercel.json", ".env.example"]
    )
    names = [p[0] for p in platforms]
    assert "Fly.io" in names
    assert "Vercel" in names
    assert "Env" in names


def test_detect_platforms_from_changed_files_partial() -> None:
    platforms = detect_deployment_platforms(changed_files=["vercel.json"])
    assert len(platforms) == 1
    assert platforms[0][0] == "Vercel"


def test_detect_platforms_empty_files() -> None:
    platforms = detect_deployment_platforms(changed_files=[])
    assert platforms == []


def test_build_human_followup_body_includes_vercel_and_fly() -> None:
    platforms = [
        ("Vercel", "Web app hosting"),
        ("Fly.io", "API / worker hosting"),
    ]
    body = build_human_followup_body(
        platforms=platforms,
        repo_owner="myorg",
        repo_name="myrepo",
    )
    assert "myorg/myrepo" in body
    assert "Vercel" in body
    assert "vercel.com" in body
    assert "Fly.io" in body
    assert "fly.io" in body
    assert "Prerequisites" in body
    assert "Verification" in body


def test_build_human_followup_body_includes_parent_ticket() -> None:
    platforms = [("Env", "Environment variables template")]
    body = build_human_followup_body(
        platforms=platforms,
        parent_ticket_id="PROJ-123",
    )
    assert "PROJ-123" in body
    assert "Context" in body


def test_get_default_human_followup_title() -> None:
    title = get_default_human_followup_title()
    assert "production infrastructure" in title.lower()
    assert "human" in title.lower()
