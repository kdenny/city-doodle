"""Tests for lib.vibe.config module."""

import json
from pathlib import Path

import pytest

from lib.vibe.config import (
    DEFAULT_CONFIG,
    _deep_update,
    config_exists,
    get_config_path,
    get_value,
    load_config,
    save_config,
    update_config,
)


class TestGetConfigPath:
    def test_returns_default_path_when_no_base(self):
        path = get_config_path()
        assert path == Path(".vibe/config.json")

    def test_returns_path_relative_to_base(self):
        base = Path("/some/project")
        path = get_config_path(base)
        assert path == Path("/some/project/.vibe/config.json")


class TestConfigExists:
    def test_returns_false_when_config_missing(self, tmp_path):
        assert config_exists(tmp_path) is False

    def test_returns_true_when_config_exists(self, tmp_path):
        config_dir = tmp_path / ".vibe"
        config_dir.mkdir()
        (config_dir / "config.json").write_text("{}")
        assert config_exists(tmp_path) is True


class TestLoadConfig:
    def test_returns_default_config_when_file_missing(self, tmp_path):
        config = load_config(tmp_path)
        assert config == DEFAULT_CONFIG

    def test_loads_config_from_file(self, tmp_path):
        config_dir = tmp_path / ".vibe"
        config_dir.mkdir()
        test_config = {"version": "2.0.0", "custom": "value"}
        (config_dir / "config.json").write_text(json.dumps(test_config))

        config = load_config(tmp_path)
        assert config["version"] == "2.0.0"
        assert config["custom"] == "value"


class TestSaveConfig:
    def test_creates_directory_if_missing(self, tmp_path):
        config = {"test": "value"}
        save_config(config, tmp_path)

        config_file = tmp_path / ".vibe" / "config.json"
        assert config_file.exists()

    def test_writes_json_with_indent(self, tmp_path):
        config = {"test": "value"}
        save_config(config, tmp_path)

        config_file = tmp_path / ".vibe" / "config.json"
        content = config_file.read_text()
        assert "  " in content  # Has indentation
        assert content.endswith("\n")  # Ends with newline


class TestDeepUpdate:
    def test_updates_top_level_keys(self):
        base = {"a": 1, "b": 2}
        _deep_update(base, {"a": 10})
        assert base == {"a": 10, "b": 2}

    def test_adds_new_keys(self):
        base = {"a": 1}
        _deep_update(base, {"b": 2})
        assert base == {"a": 1, "b": 2}

    def test_updates_nested_dicts_recursively(self):
        base = {"outer": {"inner": 1, "keep": 2}}
        _deep_update(base, {"outer": {"inner": 10}})
        assert base == {"outer": {"inner": 10, "keep": 2}}

    def test_replaces_non_dict_with_dict(self):
        base = {"a": 1}
        _deep_update(base, {"a": {"nested": "value"}})
        assert base == {"a": {"nested": "value"}}


class TestGetValue:
    def test_gets_top_level_value(self, tmp_path):
        config_dir = tmp_path / ".vibe"
        config_dir.mkdir()
        (config_dir / "config.json").write_text(json.dumps({"version": "1.0.0"}))

        value = get_value("version", tmp_path)
        assert value == "1.0.0"

    def test_gets_nested_value_with_dot_notation(self, tmp_path):
        config_dir = tmp_path / ".vibe"
        config_dir.mkdir()
        (config_dir / "config.json").write_text(
            json.dumps({"github": {"owner": "test-owner"}})
        )

        value = get_value("github.owner", tmp_path)
        assert value == "test-owner"

    def test_returns_none_for_missing_key(self, tmp_path):
        config_dir = tmp_path / ".vibe"
        config_dir.mkdir()
        (config_dir / "config.json").write_text(json.dumps({}))

        value = get_value("nonexistent.key", tmp_path)
        assert value is None


class TestUpdateConfig:
    def test_updates_and_persists_config(self, tmp_path):
        config_dir = tmp_path / ".vibe"
        config_dir.mkdir()
        (config_dir / "config.json").write_text(json.dumps({"version": "1.0.0"}))

        result = update_config({"version": "2.0.0"}, tmp_path)
        assert result["version"] == "2.0.0"

        # Verify persisted
        reloaded = load_config(tmp_path)
        assert reloaded["version"] == "2.0.0"
