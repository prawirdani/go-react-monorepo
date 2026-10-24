#!/bin/sh
# Backup sidecar entrypoint (busybox crond, Alpine).
#
# Snapshot the container env where the cron job (via its wrapper) can source it:
# cron does not inherit the parent environment. Keep only the DB/BACKUP_R2/TZ
# vars the job needs. Values must be shell-safe (no spaces) - R2 secrets and DB
# creds are.
set -eu
printenv | grep -E '^(DB_|BACKUP_R2_|BACKUP_PREFIX=|R2_BUCKET=|TZ=)' > /etc/backup.env || true

# A one-shot command (e.g. `compose run … /usr/local/bin/backup-postgres.sh`)
# runs directly; otherwise start busybox crond in the foreground. The crontab is
# baked at /etc/crontabs/root (busybox's default dir), so no install step.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
exec crond -f -l 8
