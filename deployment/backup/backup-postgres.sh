#!/bin/sh
# One backup run: pg_dump -Fc (custom, already compressed) -> temp file ->
# rclone copyto -> R2. Invoked by cron (see crontab); env sourced from
# /etc/backup.env.
#
#   pg_dump -Fc > $TMP && rclone copyto $TMP r2:<bucket>/<prefix>/<db>-<ts>.dump
#
# Custom format (-Fc) so the dump restores with pg_restore: selective/parallel
# restore, inspectable TOC, and click-restore in pgAdmin. It is compressed
# internally, so no separate gzip. Trade-off: pg_restore must be >= the dumping
# server's version.
#
# Ownership is RECORDED (no --no-owner here): a custom archive keeps owner as
# metadata, so the restore side chooses - `pg_restore --no-owner` to drop it on
# a scratch/pgAdmin target, or omit it on the real server (where the role
# exists) to preserve it.
#
# The temp file is required, not a style choice: `rclone rcat` streams with
# chunked transfer-encoding, which R2 rejects (501 NotImplemented), and rcat
# cannot retry because stdin is not seekable -> every run would fail. A file
# gives rclone a known length and a rewindable source so its retries work.
#
# Backups use their OWN private R2 bucket + credentials (BACKUP_R2_*), separate
# from the public images bucket (R2_BUCKET) - a leaked images key can never read
# DB dumps, and vice versa. Retention is an R2 lifecycle rule on BACKUP_PREFIX -
# no pruning here (that would need bucket-API scope we don't grant).
#
# rclone remote config comes entirely from RCLONE_CONFIG_R2_* env, so no
# rclone.conf and no secret on a command line. pg_dump reads PG* env for the
# same reason. Single-stream whole-DB dump; switch to WAL archiving only if a
# dump ever gets too slow.
set -eu

: "${DB_HOST:?DB_HOST not set}"
: "${DB_PORT:?DB_PORT not set}"
: "${DB_USER:?DB_USER not set}"
: "${DB_PASSWORD:?DB_PASSWORD not set}"
: "${DB_NAME:?DB_NAME not set}"
: "${BACKUP_R2_ACCOUNT_ID:?BACKUP_R2_ACCOUNT_ID not set}"
: "${BACKUP_R2_ACCESS_KEY_ID:?BACKUP_R2_ACCESS_KEY_ID not set}"
: "${BACKUP_R2_SECRET_ACCESS_KEY:?BACKUP_R2_SECRET_ACCESS_KEY not set}"
: "${BACKUP_R2_BUCKET:?BACKUP_R2_BUCKET not set}"

BUCKET="$BACKUP_R2_BUCKET"
PREFIX="${BACKUP_PREFIX:-postgres}"

# HARD GUARD: R2_BUCKET is served from a public URL, so a dump there is a data
# leak, not a backup. Refuse before configuring or uploading anything.
if [ -n "${R2_BUCKET:-}" ] && [ "$BUCKET" = "$R2_BUCKET" ]; then
    echo "backup: BACKUP_R2_BUCKET is set to R2_BUCKET, which is PUBLIC. Refusing to upload backups to a public bucket. Use a separate PRIVATE bucket." >&2
    exit 1
fi

export PGHOST="$DB_HOST"
export PGPORT="$DB_PORT"
export PGUSER="$DB_USER"
export PGPASSWORD="$DB_PASSWORD"
export PGDATABASE="$DB_NAME"

export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="https://${BACKUP_R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

TS=$(date -u +%Y%m%d-%H%M%S)
KEY="${PREFIX}/${DB_NAME}-${TS}.dump"
TMP="/tmp/${DB_NAME}-${TS}.dump"
trap 'rm -f "$TMP"' EXIT

echo "backup: dumping ${DB_NAME} -> r2:${BUCKET}/${KEY}"
# -Fc writes a self-compressed custom archive; no gzip in the pipeline.
# Ownership kept in the archive; the restore side decides (pg_restore --no-owner).
pg_dump -Fc > "$TMP"
rclone copyto "$TMP" "r2:${BUCKET}/${KEY}"
echo "backup: done"
