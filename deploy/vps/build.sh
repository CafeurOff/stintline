#!/bin/bash
# Builds one StintLine release. Run by vps-infra app-release as `deploy` inside the new release
# directory ($1), with NO secrets and no database, before anything served changes.
#
#   - API: venv in apps/api/venv by uv (the version and lockfile CI uses), workspace packages
#     installed non-editable, static files collected (whitenoise manifest).
#   - Web: built with a pinned Node 22 (Debian ships 20) and pnpm, into apps/web/dist: nginx
#     serves its files, the API renders every page head from its index.html (ADR 0025).
#     node_modules are removed afterwards; pnpm's store in deploy's home keeps rebuilds fast.
# Migrations need the real database: deploy/vps/release.sh.
set -euo pipefail
REL="${1:?release dir}"
cd "$REL"
log() { echo "[build] $*"; }

UV_VERSION=0.13.3
NODE_VERSION=v22.23.5
NODE_SHA256=cdeb8670a0c81f51b4dc4ac61919f9b1ad917b304bf8221eb939570663d240f8
PNPM_VERSION="$(sed -n 's/.*"packageManager": "pnpm@\([0-9.]*\)".*/\1/p' package.json)"
tools="$HOME/tools"

# --- Python ------------------------------------------------------------------------------
wanted="$(tr -d '[:space:]' <.python-version)"
have="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
[[ "$have" == "$wanted" ]] || { echo "python3 is $have, this release expects $wanted" >&2; exit 1; }

uv="$tools/uv-$UV_VERSION/bin/uv"
if [[ ! -x "$uv" ]]; then
    rm -rf "$tools/uv-$UV_VERSION"
    python3 -m venv "$tools/uv-$UV_VERSION"
    "$tools/uv-$UV_VERSION/bin/pip" install -q --disable-pip-version-check "uv==$UV_VERSION"
fi

UV_PROJECT_ENVIRONMENT="$REL/apps/api/venv" UV_CACHE_DIR="$HOME/.cache/uv" \
    "$uv" sync -q --frozen --package stintline-api --no-dev --no-editable \
    --no-python-downloads --python "$(command -v python3)" --compile-bytecode
log "API dependencies installed (python $have, uv $UV_VERSION)"

# --- Web ---------------------------------------------------------------------------------
node_dir="$tools/node-$NODE_VERSION"
if [[ ! -x "$node_dir/bin/node" ]]; then
    tarball="$(mktemp)"
    curl -fsSL --proto '=https' -o "$tarball" \
        "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz"
    echo "$NODE_SHA256  $tarball" | sha256sum -c --quiet - \
        || { rm -f "$tarball"; echo "node tarball checksum mismatch" >&2; exit 1; }
    rm -rf "$node_dir.tmp" && mkdir -p "$node_dir.tmp"
    tar -xJf "$tarball" -C "$node_dir.tmp" --strip-components=1
    rm -f "$tarball"
    mv "$node_dir.tmp" "$node_dir"
fi
pnpm_dir="$tools/pnpm-$PNPM_VERSION"
if [[ ! -x "$pnpm_dir/bin/pnpm" ]]; then
    PATH="$node_dir/bin:$PATH" npm install -g -s --prefix "$pnpm_dir" "pnpm@$PNPM_VERSION"
fi
export PATH="$pnpm_dir/bin:$node_dir/bin:$PATH" CI=true
pnpm install -s --frozen-lockfile --store-dir "$HOME/.cache/pnpm-store"
pnpm --filter web build >/dev/null
[[ -f apps/web/dist/index.html && -f apps/web/dist/.vite/manifest.json ]] \
    || { echo "web build produced no index.html / manifest" >&2; exit 1; }
find . -name node_modules -type d -prune -exec rm -rf {} +
log "web app built (node $NODE_VERSION, pnpm $PNPM_VERSION)"

# --- Static files ------------------------------------------------------------------------
cd apps/api
DJANGO_SETTINGS_MODULE=config.settings.prod DJANGO_SECRET_KEY=build-only \
    DATABASE_URL=sqlite://:memory: venv/bin/python manage.py collectstatic --noinput -v 0
venv/bin/celery --version >/dev/null
venv/bin/uvicorn --version >/dev/null
log "release ready: $(cat "$REL/VERSION" 2>/dev/null || echo '?') $(cat "$REL/REVISION" 2>/dev/null || true)"
