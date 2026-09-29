# PostgreSQL backups

Nightly logical dumps with local GFS retention, plus an optional offsite copy to a
**private** R2 bucket. This is the reference material for `DEPLOYMENT.md` §7.

The `backup` sidecar (`deployment/backup/`) runs
`deployment/backup/backup-postgres.sh` under busybox `crond` at **03:15
container-local** (containers run UTC). Cron output is redirected to PID 1, so it
shows up in `docker logs backup`.

---

## Pipeline

| Stage | What | Cadence | Retention | Where |
| --- | --- | --- | --- | --- |
| 1. Dump | `pg_dump -Fc` (custom format), written `.partial` then renamed | Nightly 03:15 UTC | — | `backups/daily/<UTC-stamp>.dump` |
| 2. Verify | `pg_restore --list` must succeed or the file is deleted and the run fails | Every run | — | in place |
| 3. Local GFS | Copies promoted by date | Sunday → `weekly`, day 01 → `monthly` | `BACKUP_RETENTION_DAILY` (7) / `_WEEKLY` (4) / `_MONTHLY` (6), newest N kept | `backups/{daily,weekly,monthly}/` |
| 4. Offsite | `rclone copy` to private R2, then age prune (`rclone delete --min-age`) | Every run, when `BACKUP_R2_BUCKET` is set | `BACKUP_R2_RETAIN_DAYS` (30) | `BACKUP_R2_BUCKET`/`BACKUP_PREFIX`/`<tier>/` |
| 5. Guard | Refuses to run if `BACKUP_R2_BUCKET` equals the public `R2_BUCKET` | Every run with offsite enabled | — | — |

---

## Recovery targets

- **RPO up to 24 h.** Dumps run nightly, so a host loss can drop everything written
  since the last 03:15 run. With offsite enabled the newest dump is copied to a
  separate private bucket, so a total host loss still recovers.
- **RTO in minutes.** A recovery is "restore one custom-format dump into a fresh
  database" — minutes at this dataset size, plus pointing the API at it.

---

## Offsite copy

`backups/` lives on the same host and volume as Postgres. That survives a bad
migration, not a lost host — the R2 copy is what makes it a real backup. Leave
`BACKUP_R2_BUCKET` empty only if you accept local-only.

The offsite bucket must be **separate and private**. The app's `R2_BUCKET` is
served from a public `pub-*.r2.dev`-style URL, so uploading dumps there would
publish the whole database. The script hard-refuses (non-zero exit) before any
upload when `BACKUP_R2_BUCKET == R2_BUCKET`.

Use `rclone copy`, never `sync`: mirroring would delete every remote copy if the
local `backups/` directory is ever lost.

---

## Not backed up

- **Redis** — covered by AOF persistence on the `redis-data` volume. It holds
  throttle counters and access-token revocation markers; if the volume is lost,
  the worst case is up to `AUTH_JWT_TTL` (15 min) of revoked-but-still-valid access
  tokens, then normal operation resumes.
- **Grafana** — provisioning and dashboards are checked into `deployment/grafana/`,
  so datasources and dashboards rebuild from git on boot; only ad-hoc local edits
  are lost.
- **Prometheus** — the TSDB is operational metrics, not business data, and is
  capped by `--storage.tsdb.retention.time=15d`.

---

## Known limits

**One database, no globals.** `pg_dump` covers `$DB_NAME` only. A second database
in the same cluster would be silently missed — move to `pg_dumpall` if that ever
happens. Roles/globals are not included either, so restoring into a *fresh*
cluster needs `pg_dumpall --globals-only` first; restoring into this cluster is
unaffected.

**Logical, not point-in-time.** You can roll back to last night, not to one minute
before a bad deploy: a corrupting migration or query costs everything written since
the last dump. Minutes-level RPO needs WAL archiving (`pg_basebackup` plus
pgBackRest/Barman) and is deliberately out of scope for now. Revisit when RPO must
be under a few hours, when a full restore starts approaching your RTO budget, or
when there is a staging box to rehearse PITR on.

**No physical/whole-cluster copy.** This protects against corruption and a bad
migration, and (with offsite enabled) a lost host. It does not give byte-identical
cluster restore or provider-level snapshots; add volume snapshots at the provider
for that coarse second layer.

---

## Manual one-off backup

```bash
docker compose run --rm --entrypoint sh backup /backup-postgres.sh
```

---

## Restore runbook

```bash
# 0. Write the chosen dump somewhere you can keep (never overwrite the only copy).
ls -1t backups/daily/          # newest first; pick a file
DUMP=backups/daily/<stamp>.dump

# 1. Stop writers so nothing mutates the DB mid-restore.
docker compose stop api worker

# 2. Restore over the existing database (drops objects that are in the dump).
docker compose exec -T postgres \
  pg_restore --clean --if-exists --no-owner -U "$DB_USER" -d "$DB_NAME" < "$DUMP"

# 3. Verify, then bring the app back.
docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c '\dt'
docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c 'select count(*) from users'
docker compose start api worker
```

---

## Restore drill

Proves a dump is restorable without touching the live database.

```bash
# Restore into a scratch database, list tables, check a row count, drop it.
docker compose exec -T postgres createdb -U "$DB_USER" restoretest
docker compose exec -T postgres pg_restore --no-owner -U "$DB_USER" -d restoretest < "$DUMP"
docker compose exec -T postgres psql -U "$DB_USER" -d restoretest -c '\dt'
docker compose exec -T postgres psql -U "$DB_USER" -d restoretest -c 'select count(*) from users'
docker compose exec -T postgres dropdb -U "$DB_USER" restoretest
```

Run this after any schema change, or before you rely on a dump. A backup that has
never been restored is a hope, not a backup.
