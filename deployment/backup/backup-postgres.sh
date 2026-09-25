#!/bin/sh
# Nightly PostgreSQL logical backup with local GFS retention and an optional
# private-R2 offsite copy. Runs inside the `backup` sidecar under busybox
# crond, so this is POSIX `ash`: no bashisms, no arrays, no `pipefail`.
#
# Design rules:
#   - A dump is only "done" after it is renamed off its `.partial` suffix, and
#     only a valid archive after `pg_restore --list` succeeds.
#   - Local dumps are NOT offsite. Same-host copies die with the host.
#   - Offsite must be a SEPARATE, PRIVATE bucket. `R2_BUCKET` is public; the
#     script refuses to upload there (see the guard below).
#   - `rclone copy`, never `rclone sync`: mirroring would propagate an empty or
#     lost local `backups/` dir by deleting every remote copy.
set -eu

log() {
    printf '%s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

die() {
    log "ERROR: $*"
    exit 1
}

# --- Required configuration ------------------------------------------------
for v in DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME; do
    eval "value=\${$v:-}"
    [ -n "$value" ] || die "required environment variable $v is not set"
done

# --- Optional configuration (defaults) -------------------------------------
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION_DAILY="${BACKUP_RETENTION_DAILY:-7}"
BACKUP_RETENTION_WEEKLY="${BACKUP_RETENTION_WEEKLY:-4}"
BACKUP_RETENTION_MONTHLY="${BACKUP_RETENTION_MONTHLY:-6}"
BACKUP_PREFIX="${BACKUP_PREFIX:-postgres}"
BACKUP_R2_BUCKET="${BACKUP_R2_BUCKET:-}"
BACKUP_R2_ACCESS_KEY_ID="${BACKUP_R2_ACCESS_KEY_ID:-}"
BACKUP_R2_SECRET_ACCESS_KEY="${BACKUP_R2_SECRET_ACCESS_KEY:-}"
BACKUP_R2_ACCOUNT_ID="${BACKUP_R2_ACCOUNT_ID:-${R2_ACCOUNT_ID:-}}"
BACKUP_R2_RETAIN_DAYS="${BACKUP_R2_RETAIN_DAYS:-30}"

DAILY_DIR="$BACKUP_DIR/daily"
WEEKLY_DIR="$BACKUP_DIR/weekly"
MONTHLY_DIR="$BACKUP_DIR/monthly"
mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" "$MONTHLY_DIR"

STAMP="$(date -u '+%Y-%m-%dT%H%M%SZ')"
PARTIAL="$DAILY_DIR/$STAMP.dump.partial"
FINAL="$DAILY_DIR/$STAMP.dump"
CREATED_FILES=""
UPLOAD_RAN="no"

log "starting backup db=$DB_NAME host=$DB_HOST:$DB_PORT prefix=$BACKUP_PREFIX"

# --- 1. Dump ---------------------------------------------------------------
# PGPASSWORD is scoped to the command only; it is never exported or logged.
if ! PGPASSWORD="$DB_PASSWORD" pg_dump -Fc \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f "$PARTIAL"; then
    rm -f "$PARTIAL"
    die "pg_dump failed"
fi
# Only now is an interrupted dump impossible: the rename drops `.partial`, so
# a killed pg_dump can never be mistaken for a good backup.
mv "$PARTIAL" "$FINAL"
CREATED_FILES="$FINAL"
log "dump written: $FINAL"

# --- 2. Verify the archive -------------------------------------------------
if ! pg_restore --list "$FINAL" >/dev/null 2>&1; then
    rm -f "$FINAL"
    die "pg_restore --list failed; $FINAL is not a valid archive and was deleted"
fi
log "archive verified: $FINAL"

# --- 3. Tier promotion (GFS) ----------------------------------------------
if [ "$(date -u '+%w')" = "0" ]; then
    cp "$FINAL" "$WEEKLY_DIR/$STAMP.dump"
    CREATED_FILES="$CREATED_FILES $WEEKLY_DIR/$STAMP.dump"
    log "promoted to weekly: $WEEKLY_DIR/$STAMP.dump"
fi
if [ "$(date -u '+%d')" = "01" ]; then
    cp "$FINAL" "$MONTHLY_DIR/$STAMP.dump"
    CREATED_FILES="$CREATED_FILES $MONTHLY_DIR/$STAMP.dump"
    log "promoted to monthly: $MONTHLY_DIR/$STAMP.dump"
fi

# --- 4. Local rotation -----------------------------------------------------
# Keep the newest N per tier; `tail -n +N` yields nothing once <= N exist, so
# deleting nothing is a no-op rather than an error.
rotate() {
    dir="$1"
    keep="$2"
    ls -1t "$dir" | tail -n +"$((keep + 1))" | while read -r old; do
        log "rotate: removing $dir/$old"
        rm -f "$dir/$old"
    done
}
rotate "$DAILY_DIR" "$BACKUP_RETENTION_DAILY"
rotate "$WEEKLY_DIR" "$BACKUP_RETENTION_WEEKLY"
rotate "$MONTHLY_DIR" "$BACKUP_RETENTION_MONTHLY"

# --- 5. Offsite (private R2) ----------------------------------------------
if [ -n "$BACKUP_R2_BUCKET" ]; then
    # HARD GUARD: R2_BUCKET is served from a public URL, so a dump there is a
    # data leak, not a backup. Refuse before configuring or uploading anything.
    if [ "$BACKUP_R2_BUCKET" = "${R2_BUCKET:-}" ]; then
        die "BACKUP_R2_BUCKET is set to R2_BUCKET, which is PUBLIC. Refusing to upload backups to a public bucket. Create a separate PRIVATE R2 bucket and point BACKUP_R2_BUCKET at it."
    fi
    [ -n "$BACKUP_R2_ACCESS_KEY_ID" ] || die "BACKUP_R2_ACCESS_KEY_ID is required when BACKUP_R2_BUCKET is set"
    [ -n "$BACKUP_R2_SECRET_ACCESS_KEY" ] || die "BACKUP_R2_SECRET_ACCESS_KEY is required when BACKUP_R2_BUCKET is set"
    [ -n "$BACKUP_R2_ACCOUNT_ID" ] || die "BACKUP_R2_ACCOUNT_ID (or R2_ACCOUNT_ID) is required when BACKUP_R2_BUCKET is set"

    # rclone is configured entirely from the environment: no config file.
    export RCLONE_CONFIG_BACKUP_TYPE=s3
    export RCLONE_CONFIG_BACKUP_PROVIDER=Cloudflare
    export RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID="$BACKUP_R2_ACCESS_KEY_ID"
    export RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY="$BACKUP_R2_SECRET_ACCESS_KEY"
    export RCLONE_CONFIG_BACKUP_ENDPOINT="https://$BACKUP_R2_ACCOUNT_ID.r2.cloudflarestorage.com"
    export RCLONE_CONFIG_BACKUP_ACL=private

    for f in $CREATED_FILES; do
        tier="$(basename "$(dirname "$f")")"
        dest="backup:$BACKUP_R2_BUCKET/$BACKUP_PREFIX/$tier/"
        # copy, NOT sync: sync would mirror local deletions and wipe the remote.
        if ! rclone copy "$f" "$dest"; then
            die "rclone copy failed for $f -> $dest (offsite copy is not complete)"
        fi
        log "uploaded: $f -> $dest"
    done
    # Age-based prune only. Never mirror-delete the remote.
    if ! rclone delete --min-age "${BACKUP_R2_RETAIN_DAYS}d" "backup:$BACKUP_R2_BUCKET/$BACKUP_PREFIX/"; then
        die "rclone delete --min-age failed (remote prune)"
    fi
    UPLOAD_RAN="yes (bucket=$BACKUP_R2_BUCKET, min-age=${BACKUP_R2_RETAIN_DAYS}d)"
else
    log "BACKUP_R2_BUCKET is empty; keeping backups local-only (NOT offsite)"
fi

# --- 6. Summary ------------------------------------------------------------
TOTAL_SIZE="$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"
log "summary: wrote ${CREATED_FILES# } (total $TOTAL_SIZE in $BACKUP_DIR); offsite=$UPLOAD_RAN"
log "done"
