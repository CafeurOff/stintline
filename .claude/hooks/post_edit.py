#!/usr/bin/env python3
"""Claude Code PostToolUse hook: format the edited file, then remind which tests to run.

Contract: reads the hook payload (JSON) on stdin and never blocks the edit. It always
exits 0. Formatting is skipped silently when the toolchain is not installed yet
(e.g. before Phase 2 scaffolding).
"""

from __future__ import annotations

import contextlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

PRETTIER_SUFFIXES = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
    ".css",
    ".html",
}
PRETTIER_ROOTS = ("apps/web/", "packages/api-types/")
API_CONTRACT_FILES = ("serializers.py", "views.py", "urls.py")


def run(cmd: list[str], cwd: Path) -> None:
    with contextlib.suppress(OSError, subprocess.TimeoutExpired):
        subprocess.run(cmd, cwd=cwd, capture_output=True, timeout=45, check=False)


def format_file(root: Path, rel: str, path: Path) -> None:
    if path.suffix == ".py" and shutil.which("uv") and (root / "pyproject.toml").exists():
        run(["uv", "run", "--quiet", "ruff", "format", str(path)], root)
        run(
            ["uv", "run", "--quiet", "ruff", "check", "--fix", "--quiet", str(path)],
            root,
        )
    elif (
        path.suffix in PRETTIER_SUFFIXES
        and rel.startswith(PRETTIER_ROOTS)
        and (root / "node_modules" / ".bin" / "prettier").exists()
    ):
        run(
            ["pnpm", "exec", "prettier", "--write", "--log-level", "warn", str(path)],
            root,
        )


def test_hint(rel: str) -> str | None:
    if rel.startswith("packages/strategy/"):
        return "uv run pytest packages/strategy"
    if rel.startswith("packages/racedata/"):
        return "uv run pytest packages/racedata"
    if rel.startswith("apps/api/stintline/"):
        app = rel.split("/")[3] if rel.count("/") >= 4 else ""
        target = f"apps/api/stintline/{app}" if app else "apps/api"
        hint = f"uv run pytest {target}"
        if rel.endswith(API_CONTRACT_FILES):
            hint += " ; API contract may have changed: run `make types`"
        return hint
    if rel.startswith("apps/api/"):
        return "uv run pytest apps/api"
    if rel.startswith("apps/web/src/"):
        return f"pnpm --filter web exec vitest related --run {rel.removeprefix('apps/web/')}"
    return None


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return
    file_path = (payload.get("tool_input") or {}).get("file_path")
    root = Path(os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or ".").resolve()
    if not file_path:
        return
    path = Path(file_path).resolve()
    try:
        rel = path.relative_to(root).as_posix()
    except ValueError:
        return  # outside the repository
    if path.exists():
        format_file(root, rel, path)
    hint = test_hint(rel)
    if hint:
        print(
            json.dumps(
                {
                    "hookSpecificOutput": {
                        "hookEventName": "PostToolUse",
                        "additionalContext": f"Reminder: run the related tests: {hint}",
                    }
                }
            )
        )


if __name__ == "__main__":
    main()
    sys.exit(0)
