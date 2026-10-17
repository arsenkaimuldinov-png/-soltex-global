#!/usr/bin/env bash
# Soltex Global — restore test (Phase N-0, docs/deploy-runbook-ru.md §backups). Run as root once a
# month and after any change to backups: restores the newest dump into a scratch database, checks
# that the content is there, and drops the scratch database. Never touches the live database.
#
#   sudo deploy/scripts/restore-check.sh [dump-file]
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/soltex}"
PG_BIN="${PG_BIN:-}"
DB="soltex_restore_check"
dump="${1:-$(ls -1t "$BACKUP_DIR"/db/soltex-*.dump 2>/dev/null | head -n 1)}"
[ -n "$dump" ] && [ -f "$dump" ] || { echo "restore-check: no dump found in $BACKUP_DIR/db" >&2; exit 2; }

as_pg() { if [ "$(id -un)" = postgres ]; then "$@"; else sudo -u postgres "$@"; fi; }
cleanup() { as_pg "${PG_BIN}dropdb" --if-exists "$DB" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "restore-check: $dump"
cleanup
as_pg "${PG_BIN}createdb" "$DB"
as_pg "${PG_BIN}pg_restore" --no-owner --no-privileges --exit-on-error --dbname="$DB" <"$dump"
q() { as_pg "${PG_BIN}psql" -XAtq -d "$DB" -c "$1"; }
for t in users projects technologies products pages settings media releases audit_events; do
  printf '  %-14s %s rows\n' "$t" "$(q "SELECT count(*) FROM $t")"
done
[ "$(q 'SELECT count(*) FROM settings')" = 1 ] || { echo "restore-check: FAILED (no settings row)" >&2; exit 1; }
[ "$(q 'SELECT count(*) FROM pages')" -gt 0 ] || { echo "restore-check: FAILED (no pages)" >&2; exit 1; }
echo "restore-check: OK ($(q "SELECT max(at) FROM audit_events") = last audit event in the dump)"
