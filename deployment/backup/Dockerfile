# Backup sidecar: pg client tools come from the postgres image; rclone adds
# S3/R2 upload. The backup script itself is bind-mounted, so changing it does
# not require an image rebuild.
FROM postgres:18.1
RUN apt-get update \
	&& apt-get install -y --no-install-recommends cron rclone \
	&& rm -rf /var/lib/apt/lists/*

# The crontab is baked to a NON-cron path on purpose. Debian cron refuses any
# /etc/cron.d file that is not root-owned or that is group/other-writable, and a
# bind mount inherits the host uid/mode, so mounting it into /etc/cron.d is
# silently ignored. It also cannot be installed at build time: the container
# environment only exists at runtime and must be materialised first.
# entrypoint.sh copies it into place as root:root 0644 at container start.
COPY crontab /etc/backup-crontab
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
