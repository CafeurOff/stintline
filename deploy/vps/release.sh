#!/bin/bash
# Run by vps-infra app-release as stintline with /etc/stintline/{vps,stintline}.env, in the new
# release ($1), BEFORE the switch; beat is stopped meanwhile (HOOK_STOPS). A failure aborts
# the release. Rollbacks never revert migrations: keep them backward compatible.
set -euo pipefail
cd "$1/apps/api"
export DJANGO_SETTINGS_MODULE=config.settings.prod
venv/bin/python manage.py check --deploy --fail-level ERROR
venv/bin/python manage.py migrate --noinput
