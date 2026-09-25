# Backup sidecar: pg client tools come from the postgres image; rclone adds
# S3/R2 upload. The backup script itself is bind-mounted, so changing it does
# not require an image rebuild.
FROM postgres:17-alpine
RUN apk add --no-cache rclone
