#!/bin/sh
# Backs up the PostgreSQL database to a verified file (Phase 42).
#   DATABASE_URL=postgresql://... sh scripts/backup-db.sh
# Env: BACKUP_DIR (default ./backups), BACKUP_KEEP (how many to keep, default 14).
# The file holds students' names, emails and learning data: keep the folder private (this script makes it 700 and the file 600) and copy
# it somewhere else (another machine or storage); a backup on the same disk does not survive that disk.
# Needs pg_dump / pg_restore of the SAME major version as the server (or newer).
set -eu
: "${DATABASE_URL:?set DATABASE_URL}"
DIR="${BACKUP_DIR:-./backups}"
KEEP="${BACKUP_KEEP:-14}"
mkdir -p "$DIR"
chmod 700 "$DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="$DIR/tuklas-$STAMP.dump"
umask 077
# whatever happens, never leave a half-written file behind
trap 'rm -f "$FILE.partial"' EXIT
pg_dump --format=custom --no-owner --no-privileges --file "$FILE.partial" "$DATABASE_URL"
# a backup that cannot be read back is worse than none: check it before keeping it
if ! pg_restore --list "$FILE.partial" > /dev/null; then rm -f "$FILE.partial"; echo "backup FAILED: the dump could not be read back" >&2; exit 1; fi
mv "$FILE.partial" "$FILE"
echo "backup written: $FILE ($(wc -c < "$FILE") bytes)"
# keep the newest $KEEP
ls -1t "$DIR"/tuklas-*.dump 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do rm -f "$old"; echo "removed old backup: $old"; done
