#!/usr/bin/env bash
# Soltex Global — backup (Phase N-0, docs/deploy-runbook-ru.md §backups). Run nightly by
# soltex-backup.timer as the soltex-backup user; can be run by hand the same way.
#
#   database  pg_dump (custom format) with the read-only soltex_backup role, checked with pg_restore --list
#   media     uploaded files (MEDIA_DIR), as daily snapshots hard-linked to the previous one (rsync --link-dest)
#   retention BACKUP_KEEP_DAYS (default 14) for both
#   offsite   optional: BACKUP_REMOTE (an rsync target, e.g. backup@host:/srv/backups/soltex) gets a copy
#
# Releases are not backed up: every release is rebuilt from its content snapshot, which is in the
# database, and the code (git). On success writes the time to BACKUP_DIR/last-success and to
# BACKUP_STATUS_FILE (readable by the API: «Система» in the admin); exits non-zero on any error.
set -euo pipefail

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is not set}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/soltex}"
MEDIA_DIR="${MEDIA_DIR:-/srv/soltex/media}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
PG_BIN="${PG_BIN:-}"
stamp="$(date -u +%Y%m%d-%H%M%S)"

log() { printf '%s backup: %s\n' "$(date -u +%FT%TZ)" "$*"; }

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/media"
umask 077

# --- database -------------------------------------------------------------------------------------
dump="$BACKUP_DIR/db/soltex-$stamp.dump"
log "database → $dump"
"${PG_BIN}pg_dump" --format=custom --compress=6 --no-owner --no-privileges --file="$dump.partial" "$BACKUP_DATABASE_URL"
"${PG_BIN}pg_restore" --list "$dump.partial" >/dev/null
mv "$dump.partial" "$dump"
log "database ok ($(du -h "$dump" | cut -f1))"

# --- media ------------------------------------------------------------------------------------------
if [ -d "$MEDIA_DIR" ]; then
  last="$(find "$BACKUP_DIR/media" -mindepth 1 -maxdepth 1 -type d -name '20*' | sort | tail -n 1)"
  target="$BACKUP_DIR/media/$stamp"
  log "media $MEDIA_DIR → $target${last:+ (unchanged files linked to $(basename "$last"))}"
  rsync -a --delete ${last:+--link-dest="$last"} "$MEDIA_DIR/" "$target.partial/"
  mv "$target.partial" "$target"
else
  log "media: $MEDIA_DIR does not exist yet, skipped"
fi

# --- retention --------------------------------------------------------------------------------------
find "$BACKUP_DIR/db" -maxdepth 1 -name 'soltex-*.dump' -mtime +"$KEEP_DAYS" -print -delete | sed 's/^/  removed /'
find "$BACKUP_DIR/media" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime +"$KEEP_DAYS" -print -exec rm -rf {} + | sed 's/^/  removed /'
find "$BACKUP_DIR" -name '*.partial' -mmin +360 -exec rm -rf {} + 2>/dev/null || true

# --- offsite ----------------------------------------------------------------------------------------
if [ -n "${BACKUP_REMOTE:-}" ]; then
  log "offsite → $BACKUP_REMOTE"
  rsync -a --delete -H "$BACKUP_DIR/db" "$BACKUP_DIR/media" "$BACKUP_REMOTE/"
fi

date -u +%FT%TZ >"$BACKUP_DIR/last-success"
if [ -n "${BACKUP_STATUS_FILE:-}" ]; then
  (umask 022 && date -u +%FT%TZ >"$BACKUP_STATUS_FILE.tmp" && mv "$BACKUP_STATUS_FILE.tmp" "$BACKUP_STATUS_FILE")
fi
log "done"
