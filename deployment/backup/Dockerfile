# syntax=docker/dockerfile:1

# Self-contained backup runner, independent of the app/migrate images.
# Built on the official rclone image (Alpine) - Alpine ships postgresql18-client
# via apk, so no PGDG/glibc dance, and rclone comes preinstalled and current.
# ~100MB vs ~300MB for the postgres image + apt rclone. Runs busybox crond in
# the foreground; one daily job streams `pg_dump -Fc | rclone copyto` to R2
# (see backup-postgres.sh).
FROM rclone/rclone:latest

# pg_dump must be >= its server (Postgres 18); Alpine's apk has the matching 18
# client natively. busybox already provides crond.
RUN apk add --no-cache postgresql18-client

COPY backup-postgres.sh /usr/local/bin/backup-postgres.sh
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
COPY crontab /etc/crontabs/root
RUN chmod +x /usr/local/bin/backup-postgres.sh /usr/local/bin/entrypoint.sh

# The rclone base sets ENTRYPOINT ["rclone"]; override it.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
