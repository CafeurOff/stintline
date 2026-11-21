from pathlib import Path

import pytest

from config.settings import base


def test_release_version_reads_the_tag_written_at_the_release_root(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    (tmp_path / "VERSION").write_text("v1.4.2\n", encoding="utf-8")
    monkeypatch.setattr(base, "REPO_ROOT", tmp_path)

    assert base._release_version() == "1.4.2"


def test_release_version_falls_back_without_a_release(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(base, "REPO_ROOT", tmp_path)

    assert base._release_version() == "0.1.0"
