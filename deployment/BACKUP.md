# PostgreSQL backups

Twice-daily logical dumps streamed straight to a **private** R2 bucket, with
retention enforced by an R2 lifecycle rule. This is the reference material for
`DEPLOYMENT.md` §7.

The `backup` sidecar (`deployment/backup/`) runs
`deployment/backup/backup-postgres.sh` under busybox `crond` at **03:15 and 15:15
container-local** (`TZ`, default `Asia/Jakarta`). The crontab is baked into the
image; the entrypoint snapshots the DB/R2 environment into `/etc/backup.env`,
because cron does not inherit the container environment. Cron output is
redirected to PID 1, so it shows up in `docker logs backup`.

There is **no local copy**: the dump is written to `/tmp`, uploaded with
`rclone copyto`, and the temp file is removed on exit. R2 holds the only
backups, which is why the lifecycle rule and a freshness check matter.

---

## Pipeline

The backup image is `FROM rclone/rclone` (Alpine) with `postgresql18-client` from
apk, matching the server's major version - `pg_dump` must be at least the
server's major version. The rclone base already ships rclone, so one small image
does both the dump and the upload.

| Stage | What | Cadence | Retention | Where |
| --- | --- | --- | --- | --- |
| 1. Dump | `pg_dump -Fc` (custom format) to `/tmp` | 03:15 and 15:15 container-local | - | temp file, removed on exit |
| 2. Upload | `rclone copyto` to the private backup bucket | Every run | **R2 lifecycle rule on `BACKUP_PREFIX` (default `postgres/`) - 30 days** | `BACKUP_R2_BUCKET`/`BACKUP_PREFIX`/`<db>-<UTC-stamp>.dump` |
| 3. Guard | Refuses to run if `BACKUP_R2_BUCKET` equals the public `R2_BUCKET` | Every run | - | - |

The script never deletes anything: it only uploads. Expiry is an R2 object
lifecycle rule on the `postgres/` prefix, set in the Cloudflare dashboard
(R2 → bucket → Settings → Object lifecycle rules). Without it dumps accumulate
forever. There is no `rclone delete`/`--min-age` step, and no
`BACKUP_R2_RETAIN_DAYS` setting - the window lives in the bucket rule.

---

## Recovery targets

- **RPO up to 12 h.** Dumps run twice daily, so a host loss can drop everything
  written since the last 03:15/15:15 run. Each run uploads to a separate private
  bucket, so a total host loss still recovers.
- **RTO in minutes.** A recovery is "restore one custom-format dump into a fresh
  database" - minutes at this dataset size, plus pointing the API at it.

---

## Offsite copy

Every run uploads, so there is nothing to keep in sync and no second copy to
maintain. `BACKUP_R2_BUCKET` is required: the script aborts at startup if it is
unset, because the dump would otherwise have nowhere to go.

The bucket must be **separate and private**. The app's `R2_BUCKET` is served from
a public `pub-*.r2.dev`-style URL, so uploading dumps there would publish the
whole database. The script hard-refuses (non-zero exit) before any upload when
`BACKUP_R2_BUCKET == R2_BUCKET`.

Because R2 is the only copy, two operational rules follow:

- **Set the lifecycle rule.** No rule means unbounded storage; the rule is what
  enforces the 30-day window.
- **Alert on staleness.** If the cron stops (bad creds, host down, sidecar
  crash), the lifecycle rule will expire the last dumps too and leave you with
  nothing. Alert when the newest object under `postgres/` is more than ~48 h old.

---

## Not backed up

- **Redis** - covered by AOF persistence on the `redis-data` volume. It holds
  throttle counters and access-token revocation markers; if the volume is lost,
  the worst case is up to `AUTH_JWT_TTL` (15 min) of revoked-but-still-valid access
  tokens, then normal operation resumes.
- **Grafana** - provisioning and dashboards are checked into `deployment/grafana/`,
  so datasources and dashboards rebuild from git on boot; only ad-hoc local edits
  are lost.
- **Prometheus** - the TSDB is operational metrics, not business data, and is
  capped by `--storage.tsdb.retention.time=15d`.

---

## Known limits

**One database, no globals.** `pg_dump` covers `$DB_NAME` only. A second database
in the same cluster would be silently missed - move to `pg_dumpall` if that ever
happens. Roles/globals are not included either, so restoring into a *fresh*
cluster needs `pg_dumpall --globals-only` first; restoring into this cluster is
unaffected.

**Logical, not point-in-time.** You can roll back to the last dump (up to 12 h
ago), not to one minute before a bad deploy: a corrupting migration or query costs
everything written since then. Minutes-level RPO needs WAL archiving
(`pg_basebackup` plus pgBackRest/Barman) and is deliberately out of scope for now.
Revisit when RPO must be under a few hours, when a full restore starts approaching
your RTO budget, or when there is a staging box to rehearse PITR on.

**No physical/whole-cluster copy.** This protects against corruption and a bad
migration, and (with offsite enabled) a lost host. It does not give byte-identical
cluster restore or provider-level snapshots; add volume snapshots at the provider
for that coarse second layer.

---

## Manual one-off backup

```bash
docker compose run --rm --entrypoint sh backup -c backup-postgres.sh
```

---

## Restore runbook

There is no local dump to pick from - list the bucket first, then stream the
chosen object straight into `pg_restore`. `PREFIX` and `KEY` are the file you
picked (`<db>-<UTC-stamp>.dump`).

```bash
# 0. List what is available.
docker compose run --rm --entrypoint sh backup -c \
  'set -a; . /etc/backup.env; set +a; rclone ls "r2:$BACKUP_R2_BUCKET/${BACKUP_PREFIX:-postgres}"'

# 1. Stop writers so nothing mutates the DB mid-restore.
docker compose stop api worker

# 2. Restore over the existing database (drops objects that are in the dump).
#    rclone runs in the backup sidecar and streams to pg_restore, so the dump
#    never has to land on the host. $KEY is expanded by your host shell; the
#    bucket vars are expanded inside the container from /etc/backup.env.
KEY=<db>-<UTC-stamp>.dump
docker compose run --rm --entrypoint sh backup -c \
  "set -a; . /etc/backup.env; set +a; rclone cat \"r2:\$BACKUP_R2_BUCKET/\${BACKUP_PREFIX:-postgres}/$KEY\"" \
  | docker compose exec -T postgres \
      pg_restore --clean --if-exists --no-owner -U "$DB_USER" -d "$DB_NAME"

# 3. Verify, then bring the app back.
docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c '\dt'
docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c 'select count(*) from users'
docker compose start api worker
```

---

## Restore drill

Proves a dump is restorable without touching the live database.

```bash
# Pick an object to prove (see the runbook for listing the bucket).
KEY=<db>-<UTC-stamp>.dump

# Restore into a scratch database, list tables, check a row count, drop it.
docker compose exec -T postgres createdb -U "$DB_USER" restoretest
docker compose run --rm --entrypoint sh backup -c \
  "set -a; . /etc/backup.env; set +a; rclone cat \"r2:\$BACKUP_R2_BUCKET/\${BACKUP_PREFIX:-postgres}/$KEY\"" \
  | docker compose exec -T postgres pg_restore --no-owner -U "$DB_USER" -d restoretest
docker compose exec -T postgres psql -U "$DB_USER" -d restoretest -c '\dt'
docker compose exec -T postgres psql -U "$DB_USER" -d restoretest -c 'select count(*) from users'
docker compose exec -T postgres dropdb -U "$DB_USER" restoretest
```

Run this after any schema change, or before you rely on a dump. A backup that has
never been restored is a hope, not a backup.
