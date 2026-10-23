# Deployment checklist

Single-host deployment with Docker Compose and Caddy. This file is both the
step-by-step preparation gate and the deployment reference material. Backups have
their own reference: [`BACKUP.md`](./BACKUP.md).

- Architecture: `compose.caddy.yml` runs Postgres, Redis, API, worker, the
  one-shot migrate job, Caddy, Prometheus and Grafana on one pinned network.
- **Only Caddy publishes ports** (plus Grafana, bound to loopback). Everything
  else is internal-only.
- Target shape: a VPS with a public IP, a domain, and TLS terminated by Caddy —
  optionally behind Cloudflare.

> **Which compose file.** This guide assumes the self-contained Caddy stack, so
> every `docker compose` command below takes `-f compose.caddy.yml`. The default
> `compose.yml` is the bare API (Postgres, Redis, API, worker, migrate, backup)
> with **no** bundled proxy, TLS, or dashboards — front it with your own proxy
> (e.g. a host nginx) pointed at `127.0.0.1:${APP_PORT}`, and set
> `TRUST_PROXY=true` so audit IPs come from `X-Forwarded-For`. The proxy-trust
> and firewall notes below apply to both; the TLS, Cloudflare and Grafana
> sections are Caddy-only.

---

## 0. Prerequisites

- [ ] Host with **Docker Engine** and **Compose v2**. v2 is required — the stack
      uses `depends_on: condition: service_healthy` and
      `service_completed_successfully`.
- [ ] A domain you control (for automatic HTTPS). Not required for a plain-HTTP
      trial run.
- [ ] Host ports `80` and `443` free. A non-TLS trial can use `8080`/`8443`.
- [ ] Outbound internet from the host: image pulls, ACME validation, SMTP, R2.
- [ ] Enough disk for `postgres-data`, `prometheus-data` and `backups/`.
- [ ] **Correct build architecture.** `make build` sets `GOOS=linux` but not
      `GOARCH`, so the binary matches the builder image. Building on Apple
      Silicon for an amd64 VPS needs `--platform linux/amd64` (or a `GOARCH`
      addition); otherwise you ship an arm64 image that will not run there.

---

## 1. Get the code you intend to deploy

- [ ] Clone and check out the ref you are deploying (tag or commit).
- [ ] `git status` — the working tree must be clean, or you are deploying
      something that exists only on your laptop. *(This repo currently has
      uncommitted work; see §11.)*
- [ ] `docker compose config --quiet` → exit 0.

---

## 2. Credentials and `.env`

- [ ] `cp .env.example .env`
- [ ] `.env` is gitignored. Never commit it, never paste it into a chat or
      ticket, never leave it in shell history.

| Variable | Production value |
|---|---|
| `AUTH_JWT_SECRET` | `openssl rand -base64 48`. Must be ≥ 32 chars; the `.env.example` placeholder is public and therefore forgeable |
| `DB_PASSWORD` | strong, unique |
| `APP_ENV` | `prod` — enables `Secure` cookies and HSTS |
| `APP_INTERNAL_MODE` | `false` for public self-service registration; `true` makes registration admin-only |
| `CORS_ORIGINS` | your real web origin(s), comma-separated |
| `AUTH_RESET_PASSWORD_FORM_ENDPOINT` | real web UI URL for the reset form |
| `AUTH_COMPLETE_REGISTRATION_FORM_ENDPOINT` | real web UI URL for the invite form |
| `SMTP_*` | real mail credentials |
| `R2_*` | app uploads bucket (may be public — it is for served assets) |
| `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` | change from `admin`/`admin` |

- [ ] **Rotate anything that has ever left this machine.** Assume any credential
      pasted into logs, tickets or chat is compromised. Generate fresh values
      rather than reusing.
- [ ] `DB_PASSWORD` caveat: `POSTGRES_PASSWORD` is applied **only when the
      volume is first initialised**. Changing it later does not change the
      database — do it before the first `up`, or plan
      `docker compose down -v` (destroys data) or `ALTER USER postgres
      WITH PASSWORD '…'`.

---

## 3. Host and network preparation

- [ ] **Firewall.** Only `80`, `443` and SSH inbound. Note that **ufw does not
      filter Docker-published ports** — Docker writes its own iptables rules
      that are evaluated first. Use your provider's firewall (Hetzner Firewall,
      AWS Security Group) for network-level filtering.
- [ ] Confirm the public surface after config renders:

      ```bash
      docker compose config | grep -A3 'ports:'
      ```

      Expected: `caddy` on `80`/`443`, `grafana` on `127.0.0.1:3000`. Nothing else.
- [ ] Do **not** publish Postgres. If you need pgAdmin/psql from outside,
      uncomment the loopback mapping in `compose.yml` and tunnel it — never
      `0.0.0.0`, and never against the public app bucket's credentials.

---

## 4. TLS and the domain

- [ ] Create the DNS `A`/`AAAA` record pointing at the host.
- [ ] Verify propagation **before** configuring Caddy:

      ```bash
      dig +short api.example.com @1.1.1.1
      ```

- [ ] Set in `.env`: `SITE_ADDRESS=api.example.com`,
      `CADDY_HTTP_PORT=80`, `CADDY_HTTPS_PORT=443`.
- [ ] If DNS is **not** ready, leave `SITE_ADDRESS=` empty. Caddy then serves
      plain HTTP and does not attempt issuance. Do not point it at a domain that
      does not resolve: Let's Encrypt allows only 5 failed validations per
      hostname per hour.
- [ ] Optional: uncomment the `email` line in `deployment/caddy/Caddyfile` for
      certificate-expiry notices. It cannot be driven by an env var — an unset
      substitution is a Caddyfile parse error.
- [ ] Watch issuance on first boot: `docker compose logs -f caddy`.

### Behind Cloudflare (optional)

- [ ] `CADDYFILE=Caddyfile.cloudflare` in `.env`.
- [ ] `./deployment/caddy/update-cloudflare-ips.sh` — refreshes the
      `trusted_proxies` list from Cloudflare's published ranges. Re-run whenever
      they rotate; stale ranges silently stop trusting CF traffic.
- [ ] At the provider firewall, restrict origin `80`/`443` to Cloudflare's ranges.
- [ ] Install a **Cloudflare Origin Certificate** and set SSL mode **Full
      (strict)**. Never `Flexible`.
- [ ] Only works because of `header_up X-Forwarded-For {client_ip}` — without
      it Caddy appends the CF edge address and the audit log records that
      instead of the client. See [Behind Cloudflare](#behind-cloudflare-how-it-works).

---

## 5. First boot

- [ ] `docker compose up -d --build`
- [ ] Startup order is `postgres (healthy)` → `migrate (completed)` → `api` +
      `worker`. A failed migration blocks the app tier by design.
- [ ] `docker compose ps` — every service `running`, `postgres`/`redis` healthy.
- [ ] `docker compose logs migrate` — goose reports the migrations it applied
      (or none, if already current).

---

## 6. Post-boot verification

- [ ] Health through the proxy: `curl -fsS https://api.example.com/api/healthz`
      → `{"status":"ok","internal_mode":false}`. A `503` names the failing
      dependency in its body.
- [ ] **End-to-end auth:** register a user, complete registration from the
      emailed link, log in. That exercises API → outbox → worker → SMTP, which
      no unit test covers.
- [ ] **Audit IP is real.** Log in from another machine and check
      `audit_logs.ip_addr` / the session row. Requests from the host itself via
      `localhost` legitimately record the Docker gateway (`172.x.0.1`) — that is
      loopback behaviour, not a bug. Use another device or the public address.
- [ ] Metrics: the exporter is gated by `METRICS_ENABLED` and served on
      `METRICS_PORT` (compose pins `9091`), inside the network only. Check
      Prometheus → Status → Targets shows `app` **UP**.
- [ ] Grafana via tunnel: `ssh -L 3000:127.0.0.1:3000 user@host`, then
      `http://localhost:3000`, with the credentials from §2.

---

## 7. Backups

Reference: [`BACKUP.md`](./BACKUP.md).

- [ ] Create a **separate, private** R2 bucket for dumps. The app's `R2_BUCKET`
      is served from a public URL — dumping there would publish the whole
      database. The script hard-refuses if `BACKUP_R2_BUCKET == R2_BUCKET`.
- [ ] Issue **credentials scoped to that bucket** and set
      `BACKUP_R2_BUCKET`, `BACKUP_R2_ACCESS_KEY_ID`,
      `BACKUP_R2_SECRET_ACCESS_KEY` (and `BACKUP_R2_ACCOUNT_ID` if it differs
      from `R2_ACCOUNT_ID`).
- [ ] Run one manual backup and confirm the dump lands:

      ```bash
      docker compose run --rm --entrypoint sh backup /backup-postgres.sh
      ls -lh backups/daily/
      ```
- [ ] **Run the restore drill** ([`BACKUP.md` → Restore drill](./BACKUP.md#restore-drill)). An
      untested backup is a hope, not a backup.
- [ ] Confirm the schedule fires: check `docker logs backup` the day after
      deployment (03:15 container-local; containers run UTC).
- [ ] Enable **provider volume snapshots** as the coarse second layer: atomic,
      crash-consistent, no downtime, and it covers what a logical dump cannot
      (whole cluster, roles/globals).
- [ ] Watch disk: `pg_wal`, `backups/` and Prometheus TSDB all grow.

---

## 8. Upgrading PostgreSQL across a major version (17 -> 18)

Compose pins `postgres:18.1`. Applying the 18 image to an existing 17 data volume
does **not** upgrade it: the 18 image looks for the cluster at
`/var/lib/postgresql/18/docker` (the declared volume is now `/var/lib/postgresql`),
finds nothing, and runs `initdb` — producing a **silently empty database**. The old
files are orphaned, not deleted. Read this before the first `up` after the bump.

The database name is unchanged (`DB_NAME=golang-restapi`), so nothing was renamed;
the only risk is the major version. PostgreSQL cannot start 18 on a 17 data
directory without `pg_upgrade`.

**Preferred path — dump and restore.** Before switching the image, take a dump with
`pg_dump` from a 17 container (or use the newest existing dump in `backups/`):

```bash
docker compose run --rm --entrypoint sh backup -c 'pg_dump -Fc -h $DB_HOST -U $DB_USER -d $DB_NAME -f /backups/pre18.dump'
```

This must run **before** the postgres image is switched, so the backup image can
still reach the old server. Then start 18 so it initialises a fresh cluster, and
restore into it using the runbook in
[`BACKUP.md` → Restore runbook](./BACKUP.md#restore-runbook).

**Alternative — `pg_upgrade --link`.** The 18 image moved the volume to
`/var/lib/postgresql` so the old and new data directories can be mounted side by
side, which is what `pg_upgrade` needs. It is the option for a database large enough
that a dump/restore window is unacceptable; it needs a maintenance window and should
be rehearsed on a copy first.

Either way the old cluster's files are left in place and remain recoverable until
that volume is removed. A fresh install has none of this problem — the caveat only
applies to a host with an existing `postgres-data` volume.

---

## 9. Ongoing operations

- [ ] Rotate secrets on a schedule, and immediately if anyone leaves.
- [ ] `docker compose down -v` **destroys** `postgres-data` and `redis-data`.
      Know that before running it; it is not a restart.
- [ ] Re-run `update-cloudflare-ips.sh` periodically if CF is in front.
- [ ] Keep the host patched; `docker compose pull` for base-image updates, then
      `up -d`. `pull` does **not** update caddy — it is a locally built image, so
      rebuild it with `up -d --build` after a client change.
- [ ] Migrations are additive; deploy order is `migrate` → `api`/`worker`, which
      the compose dependency graph already enforces.

---

## 10. Rollback

- [ ] Previous app image: rebuild from the prior commit and `docker compose up -d`.
- [ ] Schema: migrations are additive, so an older binary usually runs against a
      newer schema — but verify per release rather than assuming.
- [ ] Data damage: restore a dump ([`BACKUP.md` → Restore runbook](./BACKUP.md#restore-runbook)).
      Note the RPO: you can roll back to the last nightly dump, not to
      "one minute before the bad deploy".

---

## 11. Known gaps — read before go-live

- [ ] **A real offsite upload has never run** — no private backup bucket or
      scoped credentials exist yet, so only local dumps are proven.
- [ ] **No CI.** There is no `.github/`; nothing builds, tests or lints on push.
- [ ] **No alerting.** A failed backup logs and exits non-zero, but nothing
      notifies you. Check `docker logs backup` or the `backups/` directory age.
- [ ] **No container healthcheck for `api`/`worker`.** The runtime image is
      distroless (no shell, no HTTP client), so a healthcheck cannot be
      expressed. Caddy performs an active health check on `/api/healthz`.
- [ ] Application images are built locally — `go-react-monorepo:local` (api/worker)
      and the caddy image — with no registry, so every host builds its own. The
      dashboard's bun toolchain is pulled inside the Docker build, so the host
      only needs Docker.

---

## Reference

Explanatory material behind the steps above.

### Caddy and the domain

Caddy obtains and renews the Let's Encrypt certificate itself, serves 80 and 443, and
redirects HTTP to HTTPS. There is no certificate configuration to write.

Requirements:

- An `A`/`AAAA` record for the domain pointing at the host's public IP.
- Host ports 80 and 443 reachable from the internet — `CADDY_HTTP_PORT` and
  `CADDY_HTTPS_PORT` must be exactly `80`/`443`, because the ACME challenge depends
  on them.
- Outbound access to `acme-v02.api.letsencrypt.org`, and nothing else already bound
  to 80/443 on the host.

Let's Encrypt permits only 5 failed validations per hostname per hour, so pointing
Caddy at a domain that does not resolve can lock you out for an hour.

### Going to production

`APP_ENV=prod` enables `Secure` cookies and HSTS, which is correct once TLS
terminates at Caddy.

The API sits behind Caddy, so it receives plain HTTP and resolves the client IP
from `X-Forwarded-For` whenever `TRUST_PROXY=true` (`compose.caddy.yml` sets it;
for the bare `compose.yml` set it once a proxy fronts the API). Fiber walks the
header right-to-left past trusted peers (loopback / private / unix socket) and
returns the rightmost non-trusted IP, so a client-appended entry cannot spoof the
audit log. The trust boundary is the private socket — the API is never published,
so only the proxy can reach it — not an address allowlist, which is why no CIDR
needs maintaining and the same build works behind Caddy or a host nginx. With
`TRUST_PROXY` unset or false the socket peer is used instead, which is correct
for a directly-reachable API.

### Public surface

| Service | Public | Notes |
| --- | --- | --- |
| `caddy` | 80, 443 | the only internet-facing entry point |
| `grafana` | no | bound to `127.0.0.1:${GRAFANA_PORT}`; reach it with `ssh -L 3000:127.0.0.1:3000 user@host` |
| `api`, `worker` | no | reached only by Caddy |
| `postgres`, `redis` | no | not published |
| `migrate` | no | one-shot goose job; exits before the app tier starts |
| `prometheus` | no | scrapes `api:9091` |

Every service shares the pinned `app-net` bridge. That also means Caddy, Prometheus
and Grafana can reach the datastores — a deliberate simplification. To restore that
segmentation, give Postgres and Redis their own `internal: true` network; Docker then
suppresses any `ports:` mapping on them, so you cannot publish them from there.

**Reaching the database for administration.** Either run a client inside the network,
or uncomment the loopback mapping in `compose.yml` and tunnel it:

```bash
# no exposure at all
docker compose exec postgres psql -U postgres -d go-react-monorepo

# with the loopback mapping uncommented in compose.yml
ssh -L 5432:127.0.0.1:5432 user@host
```

Never publish it on `0.0.0.0` — Docker publishes bypass ufw, so that puts the database
directly on the internet, and the container runs without TLS.

### Behind Cloudflare (how it works)

Use the Cloudflare Caddyfile, which trusts only Cloudflare's published edge ranges and
collapses the chain into a single verified client IP.

- The script rewrites only the `trusted_proxies static ...` line in
  `deployment/caddy/Caddyfile.cloudflare`, refusing to write an empty or malformed
  list. Re-run it whenever Cloudflare announces new ranges.
- `trusted_proxies static <CF ranges>` + `client_ip_headers CF-Connecting-IP` make
  Caddy accept Cloudflare's forwarding headers **only** from CF peers. Both are
  server-level options and must sit inside the Caddyfile's `servers { }` block —
  Caddy rejects them at the top level.
- The `header_up X-Forwarded-For {client_ip}` on `reverse_proxy` is **required**:
  without it Caddy forwards the raw connection peer (the CF edge), so the audit log
  would record Cloudflare instead of the visitor. `{client_ip}` resolves to the
  verified client IP, so a spoofed `CF-Connecting-IP` from an untrusted peer is
  ignored.
- `TRUST_PROXY` stays `true` and the API trusts the Caddy peer by class, not an
  address list: Caddy has already done the edge reasoning and collapsed the chain
  to the verified client. There is no CIDR to widen to the Cloudflare ranges —
  that reasoning lives in Caddy's `trusted_proxies`, not the API.
- Restrict the origin's 80/443 to Cloudflare's published ranges so the origin cannot
  be reached directly, bypassing CF.
- Terminate TLS with a **Cloudflare Origin Certificate** on Caddy and set the CF
  SSL/TLS mode to **Full (strict)**.

### Dashboard

Caddy builds the dashboard from `client/` at image build time and serves the static
bundle from `/srv`. `handle /api/*` goes to the API; everything else serves the SPA
with a fallback to `index.html`. Hashed `/assets/*` are cached immutably for a year;
every other response is `no-cache`.

It shares the API's origin, so the same TLS and Cloudflare behaviour applies to the
dashboard. The client is built at image build time and is not hot-reloaded — a
frontend change needs a rebuild of the caddy image.

Because Vite inlines `import.meta.env.VITE_*` into the bundle, two client settings
must be supplied **at build time**, and changing either needs
`docker compose up -d --build` rather than a restart:

| Build arg | Value |
| --- | --- |
| `VITE_API_URL` | empty — same origin, so the client calls `/api` relative to the page |
| `VITE_IMAGE_URL` | the public asset base for uploaded files; compose defaults it to `R2_BUCKET_URL` |

The image has no `.env` (it is dockerignored), so an unset variable reaches the
bundle as `undefined`. The client tolerates that, but the resulting asset URLs
would resolve against the dashboard origin instead of the bucket.

---

## Quick reference

```bash
docker compose config --quiet          # validate the rendered config
docker compose up -d --build           # deploy
docker compose ps                      # service state
docker compose logs -f caddy           # TLS issuance, access log
docker compose logs migrate            # migration result
docker compose run --rm --entrypoint sh backup /backup-postgres.sh   # manual backup
./deployment/caddy/update-cloudflare-ips.sh                          # refresh CF ranges
ssh -L 3000:127.0.0.1:3000 user@host   # reach Grafana
```
