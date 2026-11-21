#!/usr/bin/env bash
# Publish PNG screenshots for a pull request or a proposal, and print Markdown image links.
#
#   .ai/cezar/bin/upload-shots.sh <slug> <file.png>...
#
# Images go to the orphan branch `agent-assets` (never merged, never deployed) under <slug>/,
# and are linked through raw.githubusercontent.com so they show in issues, pull requests and
# the GitHub mobile app. Uses the git credentials of the autopilot GitHub App (`gh auth setup-git`).
set -euo pipefail

slug="${1:?usage: upload-shots.sh <slug> <file.png>...}"
shift
[[ "$slug" =~ ^[a-z0-9][a-z0-9._-]*$ ]] || { echo "bad slug: $slug" >&2; exit 2; }
(($# > 0)) || { echo "no files" >&2; exit 2; }
for f in "$@"; do
  [[ -f "$f" && "$f" == *.png ]] || { echo "not a png file: $f" >&2; exit 2; }
done

remote_url="$(git remote get-url origin)"
repo="$(sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##' <<<"$remote_url")"
branch=agent-assets
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
  git clone --quiet --depth 1 --branch "$branch" --single-branch "$remote_url" "$work/r"
else
  git init --quiet "$work/r"
  git -C "$work/r" checkout --quiet --orphan "$branch"
  git -C "$work/r" remote add origin "$remote_url"
  printf '# agent-assets\n\nScreenshots linked from agent issues and pull requests. Never merged.\n' \
    >"$work/r/README.md"
  git -C "$work/r" add README.md
fi

mkdir -p "$work/r/$slug"
for f in "$@"; do cp "$f" "$work/r/$slug/"; done
git -C "$work/r" add "$slug"
git -C "$work/r" -c user.name="$(git config user.name)" -c user.email="$(git config user.email)" \
  commit --quiet -m "chore: screenshots for $slug"
for attempt in 1 2 3; do
  if git -C "$work/r" push --quiet origin "HEAD:refs/heads/$branch"; then break; fi
  ((attempt == 3)) && { echo "push failed" >&2; exit 1; }
  git -C "$work/r" pull --quiet --rebase origin "$branch"
done

sha="$(git -C "$work/r" rev-parse HEAD)"
for f in "$@"; do
  name="$(basename "$f")"
  echo "![${name%.png}](https://raw.githubusercontent.com/$repo/$sha/$slug/$name)"
done
