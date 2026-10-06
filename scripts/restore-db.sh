#!/bin/sh
# Restores a backup made by backup-db.sh (Phase 42).
#   RESTORE_CONFIRM=yes DATABASE_URL=postgresql://target sh scripts/restore-db.sh backups/tuklas-....dump
# It restores into the database named by DATABASE_URL, REPLACING what is in it. Without RESTORE_CONFIRM=yes it only checks the file and says
# what it would do. Restore into an EMPTY database when you can (create it first), then point the app at it.
set -eu
FILE="${1:?usage: restore-db.sh <backup file>}"
: "${DATABASE_URL:?set DATABASE_URL to the database to restore INTO}"
[ -r "$FILE" ] || { echo "cannot read $FILE" >&2; exit 1; }
pg_restore --list "$FILE" > /dev/null || { echo "$FILE is not a valid backup" >&2; exit 1; }
if [ "${RESTORE_CONFIRM:-}" != "yes" ]; then
  echo "The backup file is valid. It would replace everything in the target database."
  echo "To go ahead: RESTORE_CONFIRM=yes sh scripts/restore-db.sh $FILE"
  exit 2
fi
pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error --dbname "$DATABASE_URL" "$FILE"
echo "restored $FILE"
