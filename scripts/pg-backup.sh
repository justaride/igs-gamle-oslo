#!/usr/bin/env bash
# Daily Postgres backup for the IGS database with 30-day rotation.
#
# Usage (manual):
#   DATABASE_URL=postgresql://USER:PASS@HOST/db \
#     BACKUP_DIR=/var/backups/igs \
#     ./scripts/pg-backup.sh
#
# Usage (cron — daily at 03:15 local time):
#   15 3 * * * DATABASE_URL=postgresql://... BACKUP_DIR=/var/backups/igs /path/to/repo/scripts/pg-backup.sh >> /var/log/igs-backup.log 2>&1
#
# Restore:
#   gunzip -c /var/backups/igs/igs-2026-05-13T03-15-00Z.sql.gz | psql "$DATABASE_URL"
#
# Notes:
#   - Requires pg_dump in PATH (Postgres client tools).
#   - Output is a gzipped plain-text dump (custom-format is also fine; plain is human-inspectable).
#   - Retention deletes anything older than ${RETENTION_DAYS} days. Set to 0 to disable rotation.
#   - The script is idempotent and safe to re-run; it never overwrites an existing dump.

set -euo pipefail

DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/igs}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

if [ ! -w "$BACKUP_DIR" ]; then
  echo "Backup dir not writable: $BACKUP_DIR" >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
DUMP_FILE="$BACKUP_DIR/igs-$TIMESTAMP.sql.gz"
TMP_FILE="$DUMP_FILE.tmp"

echo "[$(date -u +%FT%TZ)] Dumping to $DUMP_FILE"

# --no-owner / --no-privileges keeps the dump portable across environments.
# --clean adds DROP statements so a restore replaces an existing schema cleanly.
pg_dump \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  "$DATABASE_URL" \
  | gzip -9 > "$TMP_FILE"

# Sanity check: dump should be at least 1KB. PostGIS dumps are normally MBs.
SIZE=$(wc -c < "$TMP_FILE")
if [ "$SIZE" -lt 1024 ]; then
  echo "Refusing to keep suspiciously small dump ($SIZE bytes): $TMP_FILE" >&2
  rm -f "$TMP_FILE"
  exit 1
fi

mv "$TMP_FILE" "$DUMP_FILE"
echo "[$(date -u +%FT%TZ)] Wrote $DUMP_FILE ($SIZE bytes)"

if [ "$RETENTION_DAYS" -gt 0 ]; then
  echo "[$(date -u +%FT%TZ)] Pruning dumps older than $RETENTION_DAYS days"
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'igs-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
fi

echo "[$(date -u +%FT%TZ)] Done"
