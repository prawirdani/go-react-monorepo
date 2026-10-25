#!/bin/sh
# CLI image entrypoint (busybox crond, Alpine).
#
# Snapshot the container env where the cron job can source it: cron does not
# inherit the parent environment. Keep only the DB/BACKUP_R2/TZ vars the
# `cli --backup` job needs. Values must be shell-safe (no spaces) - R2 secrets
# and DB creds are.
set -eu
printenv | grep -E '^(DB_|BACKUP_R2_|BACKUP_PREFIX=|R2_BUCKET=|TZ=)' > /etc/backup.env || true

# With no args this container is the migration gate: apply migrations, write the
# /app/.migrated readiness marker that the compose healthcheck waits for, then
# start crond. Migrations run here rather than in a one-shot job because crond
# must keep running for backups and the app tier must only start once the schema
# is current. A failed migrate exits non-zero (set -e), so the container stops
# and the API never boots against a stale schema.
#
# With args, exec them immediately and skip migrations: one-off `./cli --backup`,
# the TUI, or `./cli --migrate status`.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

# The marker survives a container restart, so clear it first: otherwise the
# healthcheck stays green while a newly added migration is still applying.
rm -f /app/.migrated
/app/cli --migrate up
: > /app/.migrated

exec crond -f -l 8
