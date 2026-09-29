# Deployment checklist

Single-host deployment with Docker Compose and Caddy. This file is both the
step-by-step preparation gate and the deployment reference material. Backups have
their own reference: [`BACKUP.md`](./BACKUP.md).

- Architecture: `compose.yml` runs Postgres, Redis, API, worker, the one-shot
  migrate job, Caddy, Prometheus and Grafana on one pinned network.
- **Only Caddy publishes ports** (plus Grafana, bound to loopback). Everything
  else is internal-only.
- Target shape: a VPS with a public IP, a domain, and TLS terminated by Caddy —
  optionally behind Cloudflare.

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
      uncommitted work; see §10.)*
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

- [ ] **Subnet collision check.** The stack pins `APP_NET_SUBNET`
      (default `172.28.0.0/24`). Docker allocates its own pools from
      `172.17.0.0/16` upward, so on a busy host this can already be taken:

      ```bash
      docker network ls --format '{{.Name}}' | while read n; do
        docker network inspect "$n" --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}'
      done | grep 172.28
      ```

      If it prints anything, set `APP_NET_SUBNET` to a free range in `.env`.
      The symptom otherwise is a hard failure:
      `invalid pool request: Pool overlaps with other one on this address space`.
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

## 8. Ongoing operations

- [ ] Rotate secrets on a schedule, and immediately if anyone leaves.
- [ ] `docker compose down -v` **destroys** `postgres-data` and `redis-data`.
      Know that before running it; it is not a restart.
- [ ] Re-run `update-cloudflare-ips.sh` periodically if CF is in front.
- [ ] Keep the host patched; `docker compose pull` for base-image updates, then
      `up -d`.
- [ ] Migrations are additive; deploy order is `migrate` → `api`/`worker`, which
      the compose dependency graph already enforces.

---

## 9. Rollback

- [ ] Previous app image: rebuild from the prior commit and `docker compose up -d`.
- [ ] Schema: migrations are additive, so an older binary usually runs against a
      newer schema — but verify per release rather than assuming.
- [ ] Data damage: restore a dump ([`BACKUP.md` → Restore runbook](./BACKUP.md#restore-runbook)).
      Note the RPO: you can roll back to the last nightly dump, not to
      "one minute before the bad deploy".

---

## 10. Known gaps — read before go-live

- [ ] **A real offsite upload has never run** — no private backup bucket or
      scoped credentials exist yet, so only local dumps are proven.
- [ ] **No CI.** There is no `.github/`; nothing builds, tests or lints on push.
- [ ] **No alerting.** A failed backup logs and exits non-zero, but nothing
      notifies you. Check `docker logs backup` or the `backups/` directory age.
- [ ] **No container healthcheck for `api`/`worker`.** The runtime image is
      distroless (no shell, no HTTP client), so a healthcheck cannot be
      expressed. Caddy performs an active health check on `/api/healthz`.
- [ ] Application image is built locally as `go-react-monorepo:local`; there is no
      registry, so every host builds its own.

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

The API sits behind Caddy, so it receives plain HTTP and trusts `X-Forwarded-For`
only from `TRUSTED_PROXIES`. Compose sets that to the project's own pinned subnet
(`APP_NET_SUBNET`, default `172.28.0.0/24`) — deliberately not Docker's whole address
pool, because Caddy is the only hop that should be trusted — so the audit log still
records the real client IP.

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
- `TRUSTED_PROXIES` stays the project subnet: the API still trusts exactly one hop
  (Caddy), and Caddy has already done the edge reasoning. Do not widen it to the
  Cloudflare ranges.
- Restrict the origin's 80/443 to Cloudflare's published ranges so the origin cannot
  be reached directly, bypassing CF.
- Terminate TLS with a **Cloudflare Origin Certificate** on Caddy and set the CF
  SSL/TLS mode to **Full (strict)**.

### Dashboard

This stack deploys the API only. Nothing serves the built dashboard —
`deployment/caddy/Caddyfile` only reverse-proxies to the API — so shipping
`client/apps/dashboard/dist` (a static host, or embedding it in the Go binary) is a
separate decision that has not been made yet.

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
