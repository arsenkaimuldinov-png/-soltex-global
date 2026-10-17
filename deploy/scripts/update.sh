#!/usr/bin/env bash
# Soltex Global — install a new version of the code on the server (Phase N-0,
# docs/deploy-runbook-ru.md §update). Run as root from the checkout:
#
#   sudo /opt/soltex/app/deploy/scripts/update.sh [bundle-or-git-ref]
#
#   1. the code: fast-forward to the given ref (default origin/main), or to `main` of a git bundle
#      file — never a reset, never a rewrite of history;
#   2. dependencies (npm ci), checks (lint, unit tests);
#   3. database migrations with the migration role (/etc/soltex/migrate.env);
#   4. the admin build → /srv/soltex/admin;
#   5. restart of the API, worker and preview server, then the smoke test.
# Content is NOT re-imported (db:import would overwrite what editors changed). The public site
# changes only when someone publishes a release in the admin.
set -euo pipefail

APP=/opt/soltex/app
SRC="${1:-origin/main}"
cd "$APP"
log() { printf '\n== %s\n' "$*"; }

log "code: $SRC"
before="$(git rev-parse HEAD)"
if [ -f "$SRC" ]; then
  git fetch -q "$SRC" main:refs/remotes/bundle/main
  git merge --ff-only -q bundle/main
  git update-ref -d refs/remotes/bundle/main
else
  git fetch -q origin
  git merge --ff-only -q "$SRC"
fi
after="$(git rev-parse HEAD)"
echo "$before → $after"
git log --oneline "$before..$after" | sed 's/^/  /'

log "dependencies"
npm ci --no-audit --no-fund

log "checks"
npm run lint
npm test

log "database migrations"
set -a
# shellcheck disable=SC1091
. /etc/soltex/migrate.env
set +a
npm run db:migrate

log "admin build"
npm run build:admin
mkdir -p /srv/soltex/admin
rsync -a --delete apps/admin/dist/ /srv/soltex/admin/
chmod -R a+rX /srv/soltex/admin

log "restart"
systemctl restart soltex-api soltex-worker soltex-preview
sleep 3
systemctl --no-pager --lines=0 status soltex-api soltex-worker soltex-preview | grep -E '^●|Active:'

log "smoke test"
"$APP/deploy/scripts/smoke.sh"
