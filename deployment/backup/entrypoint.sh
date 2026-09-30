#!/bin/sh
# Backup sidecar entrypoint.
#
# Debian's Vixie cron differs from the busybox `crond` this sidecar used to run:
#   - it does NOT inherit the container environment, and
#   - it refuses any /etc/cron.d file that is not root-owned or that is
#     group/other-writable.
# A bind-mounted crontab arrives with the host uid and mode 0664, so cron
# silently ignores it — and because syslog does not exist in the container,
# there is no refusal line either. Baking the crontab to a non-cron path and
# installing it here as root:root 0644 fixes the ownership, and this script
# snapshots the environment the job needs into a root-only file so the job can
# source it back.
set -eu

CRON_FILE=/etc/cron.d/backup
BAKED_CRONTAB=/etc/backup-crontab
ENV_FILE=/run/backup.env

# POSIX single-quote a value: wrap in '...', and replace each embedded ' with
# '\''. The result survives `. /run/backup.env` byte-for-byte for any value
# (quotes, $, backslashes, spaces, ...).
quote() {
    printf "'%s'" "$(printf '%s' "$1" | sed "s/'/'\\\\''/g")"
}

# Materialise the environment cron will not inherit. Written root-only and
# before cron starts; never baked into the image, so no secret is committed.
umask 077
: > "$ENV_FILE"
for name in \
    DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME \
    BACKUP_DIR BACKUP_RETENTION_DAILY BACKUP_RETENTION_WEEKLY \
    BACKUP_RETENTION_MONTHLY BACKUP_PREFIX \
    BACKUP_R2_BUCKET BACKUP_R2_ACCESS_KEY_ID BACKUP_R2_SECRET_ACCESS_KEY \
    BACKUP_R2_ACCOUNT_ID BACKUP_R2_RETAIN_DAYS R2_BUCKET R2_ACCOUNT_ID
do
    eval "value=\${$name:-}"
    printf 'export %s=%s\n' "$name" "$(quote "$value")" >> "$ENV_FILE"
done
chmod 0600 "$ENV_FILE"

# Install the baked crontab with the ownership/mode Debian cron demands.
install -m 0644 -o root -g root "$BAKED_CRONTAB" "$CRON_FILE"

# PID 1 stays cron in the foreground.
exec /usr/sbin/cron -f
