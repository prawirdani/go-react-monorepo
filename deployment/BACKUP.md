# PostgreSQL backups

Twice-daily logical dumps streamed straight to a **private** R2 bucket, with
retention enforced by an R2 lifecycle rule. This is the reference material for
`DEPLOYMENT.md` §7.

The `cli` service runs the CLI (`./cli --backup`) under busybox `crond` at
**03:15 and 15:15 container-local** (`TZ`, default `Asia/Jakarta`). It is the
same long-running container that applied the migrations at startup, so cron and
migrations share one image and one env. The crontab is baked into the image; the
entrypoint snapshots the DB/R2 environment into `/etc/backup.env`, because cron
does not inherit the container environment. Cron output is redirected to PID 1,
so it shows up in `docker logs cli`.

There is **no local copy**: `pg_dump -Fc` streams straight into the R2 upload
through the S3 SDK. No temp file, no rclone. R2 holds the only backups, which is
why the lifecycle rule and a freshness check matter.

---

## Pipeline

The backup image is the CLI target of `backend/Dockerfile`: `alpine:3.23` with
`postgresql18-client` from apk, matching the server's major version - `pg_dump`
must be at least the server's major version. The Go binary streams the archive
into R2 through the S3 SDK; there is no separate uploader.

| Stage | What | Cadence | Retention | Where |
| --- | --- | --- | --- | --- |
| 1. Dump + upload | `pg_dump -Fc` streamed to the private backup bucket | 03:15 and 15:15 container-local | **R2 lifecycle rule on `BACKUP_PREFIX` (default `postgres/`) - 30 days** | `BACKUP_R2_BUCKET`/`BACKUP_PREFIX`/`<db>-<UTC-stamp>.dump` |
| 2. Guard | Refuses to run if `BACKUP_R2_BUCKET` equals the public `R2_BUCKET` | Every run | - | - |

The CLI never deletes anything: it only uploads. Expiry is an R2 object
lifecycle rule on the `postgres/` prefix, set in the Cloudflare dashboard
(R2 → bucket → Settings → Object lifecycle rules). Without it dumps accumulate
forever. There is no prune step, and no `BACKUP_R2_RETAIN_DAYS` setting - the
window lives in the bucket rule.

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
maintain. `BACKUP_R2_BUCKET` is required: a backup run aborts before any upload
if it is unset, because the dump would otherwise have nowhere to go.

The bucket must be **separate and private**. The app's `R2_BUCKET` is served from
a public `pub-*.r2.dev`-style URL, so uploading dumps there would publish the
whole database. The CLI hard-refuses (non-zero exit) before any upload when
`BACKUP_R2_BUCKET == R2_BUCKET`.

Because R2 is the only copy, two operational rules follow:

- **Set the lifecycle rule.** No rule means unbounded storage; the rule is what
  enforces the 30-day window.
- **Alert on staleness.** If the cron stops (bad creds, host down, cli
  container crash), the lifecycle rule will expire the last dumps too and leave
  you with nothing. Alert when the newest object under `postgres/` is more than
  ~48 h old.

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
make backup:run
```

That is `docker compose exec -T cli ./cli --backup`: the service is already
running, so `exec` runs the CLI inside it instead of starting a second container.

---

## Restore runbook

There is no local dump to pick from - list the bucket first, then stream the
chosen object straight into `pg_restore`. `PREFIX` and `KEY` are the file you
picked (`<db>-<UTC-stamp>.dump`).

```bash
# 0. List what is available (the newest 10 objects).
docker compose exec -T cli ./cli --backup list
```

The CLI image deliberately ships no rclone. Use an S3-compatible client on the
host for the download; with rclone, export the backup bucket's settings. Read the
four variables directly instead of sourcing `.env`: sourcing runs the whole file
as shell, so one unquoted value anywhere in it aborts the export.

```bash
A=$(grep -E '^BACKUP_R2_ACCOUNT_ID=' .env | cut -d= -f2-)
K=$(grep -E '^BACKUP_R2_ACCESS_KEY_ID=' .env | cut -d= -f2-)
S=$(grep -E '^BACKUP_R2_SECRET_ACCESS_KEY=' .env | cut -d= -f2-)
B=$(grep -E '^BACKUP_R2_BUCKET=' .env | cut -d= -f2-)
P=$(grep -E '^BACKUP_PREFIX=' .env | cut -d= -f2-)
DB_USER=$(grep -E '^DB_USER=' .env | cut -d= -f2-)
DB_NAME=$(grep -E '^DB_NAME=' .env | cut -d= -f2-)
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  RCLONE_CONFIG_R2_ACCESS_KEY_ID="$K" \
  RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$S" \
  RCLONE_CONFIG_R2_ENDPOINT="https://${A}.r2.cloudflarestorage.com" \
  RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
```

```bash
# 1. Stop writers so nothing mutates the DB mid-restore.
docker compose stop api worker

# 2. Restore over the existing database (drops objects that are in the dump).
#    rclone runs on the host and streams to pg_restore, so the dump never lands
#    on disk. $KEY comes from the listing above. Run this in the same shell
#    as the export block.
KEY=<db>-<UTC-stamp>.dump
rclone cat "r2:$B/${P:-postgres}/$KEY" \
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
# (Export the host rclone settings from .env as in the runbook first.)
docker compose exec -T postgres createdb -U "$DB_USER" restoretest
rclone cat "r2:$B/${P:-postgres}/$KEY" \
  | docker compose exec -T postgres pg_restore --no-owner -U "$DB_USER" -d restoretest
docker compose exec -T postgres psql -U "$DB_USER" -d restoretest -c '\dt'
docker compose exec -T postgres psql -U "$DB_USER" -d restoretest -c 'select count(*) from users'
docker compose exec -T postgres dropdb -U "$DB_USER" restoretest
```

Run this after any schema change, or before you rely on a dump. A backup that has
never been restored is a hope, not a backup.
