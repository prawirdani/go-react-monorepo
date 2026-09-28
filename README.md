# Golang REST API

A production-shaped REST API template in Go. It ships an opinionated clean/onion
architecture (Handler → Service → Repository), stateless JWT access tokens with
server-side sessions, a transactional outbox for asynchronous email delivery,
PostgreSQL via `pgx` with raw SQL, Cloudflare R2 object storage, and Prometheus
metrics.

The goal is a reference implementation you can rename and extend: strict layer
boundaries, interface-driven dependencies, manual dependency injection, and
tests that never touch a real database, Redis, or SMTP server.

- Module: `github.com/prawirdani/golang-restapi`
- Go: `1.26.5` (see `go.mod`)
- License: MIT (see `LICENSE`)

---

## Table of contents

- [Highlights](#highlights)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
  - [Layers and dependency direction](#layers-and-dependency-direction)
  - [Where interfaces live](#where-interfaces-live)
  - [Dependency injection](#dependency-injection)
  - [Request flow](#request-flow)
- [Project layout](#project-layout)
- [Getting started](#getting-started)
- [Deployment](#deployment)
- [Configuration](#configuration)
  - [Startup validation](#startup-validation)
- [Authentication and sessions](#authentication-and-sessions)
  - [Access token](#access-token)
  - [Refresh token and session](#refresh-token-and-session)
  - [Token delivery and cookies](#token-delivery-and-cookies)
  - [Access-token revocation](#access-token-revocation)
  - [Registration (invitation flow)](#registration-invitation-flow)
  - [Password recovery](#password-recovery)
  - [Password change](#password-change)
  - [Throttling](#throttling)
  - [Passwords and token entropy](#passwords-and-token-entropy)
- [Authorization (RBAC)](#authorization-rbac)
- [API documentation](#api-documentation)
- [Error handling](#error-handling)
- [Audit logging](#audit-logging)
- [Messaging and the worker](#messaging-and-the-worker)
- [Observability and health](#observability-and-health)
- [Database and migrations](#database-and-migrations)
- [Backups](#backups)
- [Testing](#testing)
- [Development tooling](#development-tooling)
- [Conventions](#conventions)
- [License](#license)

---

## Highlights

- **Clean/onion layering** with a one-way dependency graph: domain packages know
  nothing about PostgreSQL, Redis, R2, or Fiber; infrastructure implements the
  interfaces the domain declares.
- **Split-token auth**: HS256 JWT access tokens (short TTL) plus opaque,
  rotating refresh tokens persisted server-side as SHA-256 hashes.
- **Access-token revocation without stateful tokens**: a Redis marker store
  invalidates stateless JWTs for logout, single-session revoke, password
  change/reset, admin wipe, and user deletion.
- **Invitation-based registration**: no account row exists until the invitee
  consumes the emailed, single-use token and sets a password.
- **Async email delivery** via a transactional outbox polled by the worker:
  at-least-once delivery with bounded retries and a dead-letter row for the
  operator to inspect.
- **Audit trail** written inside the same transaction as the change it records.
- **Typed error kernel** (`apperr`) mapped to HTTP status codes in one place.
- **Generic list query DSL**: pagination, allow-listed sorting, enum-validated
  filters, and the applied query echoed back in the response `meta`.
- **Hermetic unit tests** using `testify` + `mockery`; no real infrastructure.

## Tech stack

| Concern | Choice |
| --- | --- |
| Language | Go 1.26.5 |
| HTTP | [Fiber v3](https://github.com/gofiber/fiber) (`github.com/gofiber/fiber/v3` v3.5.0) |
| Database | PostgreSQL via [pgx v5](https://github.com/jackc/pgx) (raw SQL, no ORM) + [scany/v2](https://github.com/georgysavva/scany) for struct scanning |
| Migrations | [goose](https://github.com/pressly/goose) (SQL files in `migrations/`) |
| Cache / throttle | Redis via [go-redis v9](https://github.com/redis/go-redis): `SET NX` throttle, revocation markers |
| Object storage | Cloudflare R2 through the AWS SDK v2 S3 client |
| Auth | [golang-jwt/jwt v5](https://github.com/golang-jwt/jwt), `golang.org/x/crypto/bcrypt` |
| Validation | [go-playground/validator v10](https://github.com/go-playground/validator) |
| Config | `.env` via [godotenv](https://github.com/joho/godotenv) |
| Logging | stdlib `log/slog` and [zerolog](https://github.com/rs/zerolog) behind a swappable `log.Logger` |
| Metrics | [Prometheus client_golang](https://github.com/prometheus/client_golang) |
| Mail | [gomail.v2](https://pkg.go.dev/gopkg.in/gomail.v2) |
| Testing | [testify](https://github.com/stretchr/testify) + [mockery](https://github.com/vektra/mockery) |
| Tooling | [Air](https://github.com/cosmtrek/air) hot reload, [golangci-lint v2](https://github.com/golangci/golangci-lint) |

Direct dependencies (from `go.mod`) include `github.com/aws/aws-sdk-go-v2`
(plus `config`, `credentials`, `service/s3`), `github.com/georgysavva/scany/v2`,
`github.com/go-playground/validator/v10`, `github.com/gofiber/fiber/v3`,
`github.com/golang-jwt/jwt/v5`, `github.com/google/uuid`, `github.com/jackc/pgx/v5`,
`github.com/joho/godotenv`, `github.com/prometheus/client_golang`,
`github.com/redis/go-redis/v9`, `github.com/stretchr/testify`, `golang.org/x/crypto`,
`golang.org/x/sync`, `golang.org/x/text`, `gopkg.in/gomail.v2`, and
`github.com/rs/zerolog`.

## Architecture

The codebase follows a clean/onion model. Each layer has a single
responsibility and may only depend on the layer beneath it.

> **Handler** (HTTP only) → **Service** (business logic) → **Repository** (data access)

### Layers and dependency direction

| Layer | Location | Responsibility | May import |
| --- | --- | --- | --- |
| Transport | `internal/transport/http` | Parse/validate requests, call services, serialize responses, cookies, middleware | Domain packages, `pkg/` |
| Domain (entities) | `internal/auth`, `internal/user`, `internal/audit`, `internal/rbac` | Models, business rules, service implementations, consumer-side interfaces, errors | Other domain packages and `internal/ports/*`; **never** `internal/infrastructure/*` or Fiber |
| Ports | `internal/ports/*` | Interfaces the domain and infrastructure agree on (transactor, storage, throttle, outbox, revocation) | Stdlib and small value types only |
| Infrastructure | `internal/infrastructure/*` | Concrete implementations: `postgres`, `redis`, `r2` | Domain/ports |
| Shared | `pkg/*` | Framework-agnostic helpers (`log`, `mailer`, `metrics`, `nullable`, `strings`, `validator`) | Stdlib and third-party libs |
| Composition roots | `cmd/api`, `cmd/worker`, `cmd/cli` | Wire everything, start processes, expose routes | Everything |

The rule that keeps this honest: **entity packages import no infrastructure.**
A service depends on the interface it needs, and the concrete implementation is
injected from the composition root.

### Where interfaces live

Interfaces are declared next to their consumers, split by use rather than one
wide interface:

- `internal/auth/interfaces.go` — `Repository` (composed from `SessionReader`,
  `SessionWriter`, `TokenReader`, `TokenWriter`), a narrow `UserRepository`, and
  `EventProducer`.
- `internal/user/repository.go` — `Repository` for user persistence. The service
  also declares a local `SessionRevoker` (implemented by the auth repository) so
  the user service can revoke sessions inside its own transaction without an
  import cycle into `internal/auth`.
- `internal/ports/repository` — `Transactor`, plus the `Query`/`Filterer`/
  `Sorter`/`Paginator` contracts used by the generic query builder.
- `internal/ports/storage` — `Storage`, `File` (implemented by R2 and by the
  multipart upload adapter).
- `internal/ports/throttle` — `Throttler`, `Result`.
- `internal/ports/outbox` — `Message`, `Writer`, `Store` (transactional outbox).
- `internal/ports/revocation` — `Checker`, `Revoker`, and their composition
  `Store`, implemented by the Redis revocation store.

### Dependency injection

`cmd/api/container.go` is the only place production dependencies are assembled.
`NewContainer(cfg, pg, rdb)` builds the R2 client, the Redis throttler and
revocation store, the PostgreSQL repositories, the in-memory authorizer, and
then the services (`user.Service`, `auth.Service`, `audit.Service`). The
resulting `*Container` exposes the services plus the revocation store that the
auth middleware needs. `cmd/api/server.go` then constructs handlers and the
authenticator middleware and mounts routes. There is no DI framework and no
service locator.

### Request flow

For an authenticated request such as `GET /api/auth/me`:

1. Global middleware runs, in order: production rate limit (production only),
   panic recoverer, request-metrics instrumentation, security headers, request
   logger, request-id, audit-context injection, compression, weak ETag, CORS.
2. chi-style routing resolves the route; the `authenticatorMiddleware` runs for
   protected routes. It reads the access token from the `access_token` cookie or
   `Authorization: Bearer`, verifies the JWT signature/`exp`/`iat`/`sid`, checks
   the Redis revocation markers, and injects the RBAC actor + session id and
   request-scoped log fields into the request context.
3. The handler (`AuthHandler.getCurrentUser`) pulls the actor from context,
   calls `user.Service.GetUserByID`, and the service enforces
   `RequireSelfOr(user.read)`.
4. The repository calls `db.GetConn(ctx)`, which returns the pool or, inside a
   transaction, the `pgx.Tx` stored in the context. Inside a transaction the
   repository adds `FOR UPDATE` to the read.
5. The handler returns `Body{Data: ...}`; Fiber serializes it. Any returned
   error goes through the `ErrorHandler` → `ParseError` → status mapping.

## Project layout

```text
cmd/
  api/                 HTTP server entrypoint (Fiber)
    main.go            config, postgres, redis, graceful shutdown
    container.go       manual DI wiring
    server.go          middleware chain, routes, health, metrics exporter
  worker/              background entrypoint (polls the outbox and delivers due messages)
  cli/                 developer CLI (`permissions` subcommand, extensible)

config/                env-based config structs, parsed and validated at startup
  config.go            LoadConfig + Validate
  app.go postgres.go redis.go cors.go auth.go smtp.go r2.go proxy.go

internal/
  apperr/              typed error kernel: Kind, Error, constructors
  audit/               audit Entry, request context, Recorder/Reader, service
  auth/                access tokens, sessions, crypto, models, service
    mocks/             entity-scoped auth mocks
  user/                user model, service, repository interface, search DSL
    mocks/             entity-scoped user mocks
  rbac/                roles, permissions, authorizer, actor context
  ports/               interfaces implemented by infrastructure
    outbox/            transactional outbox port (Message, Writer, Store)
    repository/        Transactor, Query, Sorting, Pagination
    revocation/        access-token revocation ports (Checker/Revoker/Store)
    storage/           object storage (Storage, File)
    throttle/          request throttling (Throttler, Result)
  infrastructure/
    postgres/          pgx pool, transaction wrapper, query builder, repositories (incl. outbox repo + auth event producer)
    redis/             throttle + revocation store
    r2/                Cloudflare R2 storage (S3 API)
  transport/
    http/              Fiber handlers, middleware, error normalization, router
  worker/              outbox poll worker + AuthWorker (renders and sends auth emails)
  testing/mocks/       shared infrastructure mocks (Transactor, Storage, ...)

pkg/                   framework-agnostic helpers
  log/                 swappable Logger (slog + zerolog adapters), context logging
  mailer/              gomail wrapper with a bounded send
  metrics/             Prometheus registry + Fiber instrumentation middleware
  nullable/            nullable column helper
  strings/             string helpers
  validator/           validation kernel over go-playground/validator

migrations/            goose SQL migrations (additive only)
deployment/
  caddy/               Caddy reverse-proxy config used by compose
  prometheus/          scrape config
  grafana/             datasource/dashboard provisioning + api-metrics.json

compose.yml            api + worker + migrate + postgres + redis + caddy + prometheus + grafana
Dockerfile             multi-stage build (distroless runtime)
Makefile               dev/build/test/lint/migration/cli targets
```

## Getting started

### Prerequisites

- Go `1.26.5` or newer (matching `go.mod`).
- PostgreSQL and Redis. `compose.yml` provides both (nothing on the host is
  required); for bare-metal `make dev` you run them yourself.
- The [goose](https://github.com/pressly/goose) CLI on your `PATH` for the
  `make migration:*` targets.
- Optional: [Air](https://github.com/cosmtrek/air) for `make dev` /
  `make dev:worker`, and `golangci-lint` v2 for `make lint`.

### 1. Start the stack

`compose.yml` is self-contained: Postgres, Redis, the API, the worker, Caddy,
Prometheus and Grafana all run in the project on one bridge network. There is no
`host.docker.internal` and no host service to start.

```bash
docker compose up -d
```

Every service loads `.env` via `env_file:`, so credentials are defined once. A
service's own `environment:` block still wins where a value must differ — `api`
and `worker` override `DB_HOST=postgres` and `REDIS_HOST=redis`, so the
`DB_HOST=localhost` values in `.env` keep working for bare-metal `make dev`.

Because `env_file:` injects the whole file, **every container — Caddy included —
receives all of it, secrets included**. That is the deliberate trade-off for a
single source of credentials. To narrow it, drop `env_file:` from a service and
list only what it needs under `environment:`; Caddy, for instance, needs just
`SITE_ADDRESS` and `APP_PORT`, and Prometheus needs nothing.
Caddy proxies `http://localhost:8080` to the API, Grafana is on
`http://localhost:3000` (`GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD`, both
`admin` by default), and
Prometheus and the datastores stay internal to the network.

Postgres and Redis data live in named volumes (`postgres-data`, `redis-data`);
`docker compose down -v` resets them.

### 2. Configure the environment

```bash
cp .env.example .env
# edit .env — at minimum set AUTH_JWT_SECRET (>= 32 chars) and DB_* values
```

`config.LoadConfig()` calls `godotenv.Load()`, so a local `.env` is read
automatically in development. `AUTH_JWT_SECRET` is required and must be at
least 32 characters; startup fails otherwise.

### 3. Apply migrations

With compose there is nothing to run by hand: the one-shot `migrate` service
applies goose migrations once Postgres is healthy, and both the API and the
worker wait for it to complete (`service_completed_successfully`). A failed
migration therefore blocks the app tier instead of letting it serve against a
half-built schema.

For bare-metal development, run goose directly:

```bash
make migration:up
```

Migrations are additive only; see [Database and migrations](#database-and-migrations).

### 4. Run the API and the worker

They are separate processes:

```bash
make dev          # API server with hot reload (Air)
make dev:worker   # outbox poll worker, hot reload (Air)
```

The worker opens its own PostgreSQL pool and does not block startup on Postgres:
the poll loop retries its reads until the database is reachable.

### 5. Build a binary

```bash
make build        # CGO_ENABLED=0 GOOS=linux -> ./bin/api and ./bin/worker
make run          # run ./bin/api
```

`make build` produces static Linux binaries at `./bin/api` and `./bin/worker`;
the `Dockerfile` copies both into a distroless runtime image. The API is the
default `CMD`; the `worker` compose service overrides it with `./worker`.

## Deployment

`deployment/DEPLOYMENT.md` is the step-by-step preparation checklist (prerequisites,
credentials, network prep, TLS, first boot, verification, backups, rollback, and the
known gaps to read before go-live). This section is the reference material it links to.

The compose stack is deployment-ready as-is. What changes in production is the
Caddy site address, the published ports, and `APP_ENV`.

### 1. Point Caddy at a domain

```bash
SITE_ADDRESS=api.example.com
CADDY_HTTP_PORT=80
CADDY_HTTPS_PORT=443
```

Caddy then obtains and renews a Let's Encrypt certificate itself, serves 80 and
443, and redirects HTTP to HTTPS. There is no certificate configuration to
write. Requirements:

- An `A`/`AAAA` record for the domain pointing at the host's public IP. Check it
  before deploying: `dig +short api.example.com @1.1.1.1` must return that IP.
- Host ports 80 and 443 reachable from the internet — `CADDY_HTTP_PORT` and
  `CADDY_HTTPS_PORT` must be exactly `80`/`443`, because the ACME challenge
  depends on them.
- Outbound access to `acme-v02.api.letsencrypt.org`; and nothing else already
  bound to 80/443 on the host.

If DNS is not ready yet, leave `SITE_ADDRESS=` empty: Caddy serves plain HTTP on
the mapped port and does not attempt issuance. Do not point it at a domain that
does not resolve — Let's Encrypt permits only 5 failed validations per hostname
per hour, so an early mistake can lock you out for an hour.

To add an ACME account email (certificate-expiry notices), uncomment the `email`
line in `deployment/caddy/Caddyfile`. It cannot come from an environment
variable: an unset substitution is a Caddyfile parse error.

### 2. Flip the app to production

```bash
APP_ENV=prod
```

`APP_ENV=prod` enables the app's production behaviour — `Secure` cookies and
HSTS — which is correct once TLS terminates at Caddy. Also repoint the settings
that still reference localhost:

- `CORS_ORIGINS` → your real web origin, e.g. `https://app.example.com`
- `AUTH_RESET_PASSWORD_FORM_ENDPOINT` /
  `AUTH_COMPLETE_REGISTRATION_FORM_ENDPOINT` → your real web UI URLs

The API sits behind Caddy, so it receives plain HTTP and trusts
`X-Forwarded-For` only from `TRUSTED_PROXIES`. Compose sets that to the project's
own pinned subnet (`APP_NET_SUBNET`, default `172.28.0.0/24`) — deliberately not
Docker's whole address pool, because Caddy is the only hop that should be
trusted — so the audit log still records the real client IP.

### 3. Public surface

| Service | Public | Notes |
| --- | --- | --- |
| `caddy` | 80, 443 | the only internet-facing entry point |
| `grafana` | no | bound to `127.0.0.1:${GRAFANA_PORT}`; reach it with `ssh -L 3000:127.0.0.1:3000 user@host` |
| `api`, `worker` | no | reached only by Caddy |
| `postgres`, `redis` | no | not published; see below to reach them for administration |
| `migrate` | no | one-shot goose job; exits before the app tier starts |
| `prometheus` | no | scrapes `api:9091` |

Every service shares the pinned `app-net` bridge (`APP_NET_SUBNET`). That also
means Caddy, Prometheus and Grafana can reach the datastores — a deliberate
simplification. To restore that segmentation, give Postgres and Redis their own
`internal: true` network; note Docker then suppresses any `ports:` mapping on
them, so you cannot publish them from there.

**Reaching the database for administration.** Postgres is not published. Either
run a client inside the network, or uncomment the loopback mapping in
`compose.yml` and tunnel it:

```bash
# no exposure at all
docker compose exec postgres psql -U postgres -d golang-restapi

# with the loopback mapping uncommented in compose.yml
ssh -L 5432:127.0.0.1:5432 user@host
```

Never publish it on `0.0.0.0` — Docker publishes bypass ufw, so that puts the
database directly on the internet, and the container runs without TLS.

Docker publishes ports by writing its own iptables rules, which are evaluated
before ufw's — **ufw does not filter published container ports**. Keep the
publish list minimal (as above) and use your provider's firewall for
network-level filtering (Hetzner Firewall, Security Group); reach for
`ufw-docker` only if you specifically need ufw to apply to containers. Set a
real `GRAFANA_ADMIN_USER` / `GRAFANA_ADMIN_PASSWORD` before exposing Grafana at
all.

### 4. Behind Cloudflare

When Cloudflare sits in front of Caddy, Caddy is no longer the first hop, so the
incoming `X-Forwarded-For` can be attacker-controlled. Use the Cloudflare
Caddyfile, which trusts only Cloudflare's published edge ranges and collapses the
chain into a single verified client IP:

```bash
# 1. Refresh the CF ranges: rewrites only the `trusted_proxies static` line.
./deployment/caddy/update-cloudflare-ips.sh

# 2. Mount it.
CADDYFILE=Caddyfile.cloudflare
```

- The script rewrites only the `trusted_proxies static ...` line in
  `deployment/caddy/Caddyfile.cloudflare`, refusing to write an empty or
  malformed list. Re-run it whenever Cloudflare announces new ranges.
- `trusted_proxies static <CF ranges>` + `client_ip_headers CF-Connecting-IP`
  make Caddy accept Cloudflare's forwarding headers **only** from CF peers. Both
  are server-level options and must sit inside the Caddyfile's `servers { }`
  block — Caddy rejects them at the top level.
- The `header_up X-Forwarded-For {client_ip}` on `reverse_proxy` is **required**:
  without it Caddy forwards the raw connection peer (the CF edge), so the audit
  log would record Cloudflare instead of the visitor. `{client_ip}` resolves to
  the verified client IP, so a spoofed `CF-Connecting-IP` from an untrusted peer
  is ignored.
- `TRUSTED_PROXIES` stays the project subnet (`APP_NET_SUBNET`): the API still
  trusts exactly one hop (Caddy), and Caddy has already done all the edge
  reasoning. Do not widen it to the Cloudflare ranges.
- Restrict the origin's 80/443 in your provider's firewall to Cloudflare's
  published IP ranges so the origin cannot be reached directly, bypassing CF.
- Terminate TLS with a **Cloudflare Origin Certificate** on Caddy and set the CF
  SSL/TLS mode to **Full (strict)**.

## Configuration

All configuration comes from environment variables, optionally loaded from
`.env`. Parsing happens in `config/*.go`; `config.LoadConfig()` parses every
section and then calls `Config.Validate()`.

### Environment variables

**Application**

| Variable | Purpose | Code default | Notes |
| --- | --- | --- | --- |
| `APP_NAME` | Service name | empty | Informational |
| `APP_VERSION` | Version string | empty | Label on `app_info` metric |
| `APP_PORT` | API listen port | empty (0) | Non-integer aborts startup |
| `APP_ENV` | Environment | empty | Must be `dev` or `prod`; anything else fails validation |
| `APP_INTERNAL_MODE` | Registration becomes admin-only | `false` | Parsed with `strconv.ParseBool` |
| `METRICS_ENABLED` | Serve the `/metrics` sidecar | `APP_ENV=prod` | Unset follows the environment; an explicit `true`/`false` wins. Compose sets it so the local stack is scrapable |

**PostgreSQL**

| Variable | Purpose | Code default | Notes |
| --- | --- | --- | --- |
| `DB_USER` | DB user | empty | |
| `DB_PASSWORD` | DB password | empty | |
| `DB_HOST` | DB host | empty | Compose overrides this to `postgres` |
| `DB_PORT` | DB port | empty (0) | |
| `DB_NAME` | DB name | empty | |
| `DB_MINCONNS` | Pool minimum connections | `0` | Must be `>= 0` and `<= DB_MAXCONNS` |
| `DB_MAXCONNS` | Pool maximum connections | **required** | Must be `> 0` and `<= 2147483647` |
| `DB_WORKER_MAXCONNS` | Worker pool maximum connections | empty (0) | `0` shares `DB_MAXCONNS`; must be `<= DB_MAXCONNS`. The worker pool is created without a startup ping |
| `DB_MAXCONN_LIFETIME` | Max connection lifetime | empty (0) | Go duration (e.g. `60m`); zero keeps the pgx default |

The pool also hardcodes `MaxConnIdleTime = 5m` and `HealthCheckPeriod = 1m`;
these are not configurable.

**Redis**

| Variable | Purpose | Code default | Notes |
| --- | --- | --- | --- |
| `REDIS_HOST` | Redis host | empty | Compose overrides this to `redis` |
| `REDIS_PORT` | Redis port | empty (0) | |
| `REDIS_PASSWORD` | Redis password | empty | |

The Redis client always uses DB index `0` and there is no connection-pool size
setting — neither is configurable through env.

**CORS and proxy**

| Variable | Purpose | Code default | Notes |
| --- | --- | --- | --- |
| `CORS_ORIGINS` | Comma-separated allowed origins | empty | With credentials enabled, `*` or an unparseable origin fails startup |
| `CORS_CREDENTIALS` | Send credentials | `false` | |
| `TRUSTED_PROXIES` | Comma-separated IPs/CIDRs of proxies whose `X-Forwarded-For`/`X-Real-IP` are trusted | empty | An invalid entry aborts startup; when empty, forwarded headers are ignored |

**Auth**

| Variable | Purpose | Code default | Notes |
| --- | --- | --- | --- |
| `AUTH_JWT_SECRET` | HS256 signing key | **required** | Must be at least 32 characters; rotating it invalidates all access tokens |
| `AUTH_JWT_TTL` | Access-token lifetime | `15m` | Short TTL bounds revocation exposure (revocation checks fail open) |
| `AUTH_REVOCATION_FAIL_CLOSED` | Deny access when the revocation store errors | `false` | When false the middleware fails open and logs a warning |
| `AUTH_SESSION_TTL` | Session / refresh-token lifetime | empty (0) | `.env.example` ships `168h` (7 days) |
| `AUTH_PASSWORD_RECOVERY_TOKEN_TTL` | Reset-token lifetime | `5m` | `.env.example` ships `15m`; the short code default limits `?token=` URL exposure |
| `AUTH_REGISTRATION_TOKEN_TTL` | Registration-token lifetime | `15m` | Same URL-exposure reasoning |
| `AUTH_RESET_PASSWORD_FORM_ENDPOINT` | Web UI URL for the reset form | empty | Used to build the reset link |
| `AUTH_COMPLETE_REGISTRATION_FORM_ENDPOINT` | Web UI URL for the password-creation form | empty | Used to build the invite link |

**SMTP**

| Variable | Purpose | Code default | Notes |
| --- | --- | --- | --- |
| `SMTP_HOST` | SMTP host | empty | |
| `SMTP_PORT` | SMTP port | empty (0) | |
| `SMTP_SENDER_NAME` | `From` header | empty | e.g. `Example <example@mail.com>` |
| `SMTP_AUTH_EMAIL` | SMTP username | empty | |
| `SMTP_AUTH_PASSWORD` | SMTP password | empty | |

**Cloudflare R2**

| Variable | Purpose | Code default | Notes |
| --- | --- | --- | --- |
| `R2_BUCKET_URL` | Public bucket base URL | empty | Leave empty for a private bucket |
| `R2_BUCKET` | Bucket name | empty | |
| `R2_ACCOUNT_ID` | Cloudflare account id | empty | Builds the R2 S3 endpoint |
| `R2_ACCESS_KEY_ID` | R2 access key | empty | |
| `R2_ACCESS_KEY_SECRET` | R2 secret | empty | |

### Startup validation

Validation is split across the section parsers and `Config.Validate()`:

| Check | Where | Failure |
| --- | --- | --- |
| `APP_ENV` is `dev` or `prod` | `Config.Validate()` | startup error |
| `AUTH_JWT_SECRET` length `>= 32` | `Config.Validate()` | startup error |
| `CORS_CREDENTIALS=true` with a `*` or invalid origin | `Config.Validate()` | startup error |
| `DB_MAXCONNS > 0` and `<= MaxInt32` | `Postgres.Parse()` | startup error |
| `DB_MINCONNS` within `[0, DB_MAXCONNS]` | `Postgres.Parse()` | startup error |
| `TRUSTED_PROXIES` entries parse as IP/CIDR | `Proxy.Parse()` | startup error |
| `APP_PORT` is an integer | `App.Parse()` | startup error |

Duration and integer env vars that fail to parse are silently ignored (the
field keeps its default) — except `APP_PORT`, which returns the parse error.

## Authentication and sessions

The auth design is a split-token scheme: short-lived stateless JWT access
tokens plus long-lived opaque refresh tokens backed by server-side session rows.

### Access token

- JWT signed with **HS256** using `AUTH_JWT_SECRET`.
- Claims: `sub` (user id, parsed into `UserID`), `sid` (session id), `role`, plus
  registered `iat` and `exp`.
- `exp` is required (`jwt.WithExpirationRequired()`) — a token without an
  expiry would make revocation TTLs meaningless.
- A token missing `iat` or `sid`, or with an unparseable/unknown signing method,
  is rejected as `AUTH_INVALID`. Expired tokens are rejected as `AUTH_EXPIRED`.
  Both map to **401**, never 500.
- Delivered in the `access_token` cookie or the `Authorization: Bearer` header.
  It is also echoed in the login/refresh response body.

### Refresh token and session

- 256-bit random opaque token, base64url-encoded with an `rt_` prefix.
- Only its SHA-256 hash is stored, in `sessions.refresh_token_hash` (unique).
- A session row holds `user_id`, `refresh_token_hash`, `user_agent`, `ip_addr`,
  `created_at`, `accessed_at`, `expires_at`, and `revoked_at`.
- **Rotation**: each refresh mints a new access token and a new refresh token,
  replaces the hash, and updates `accessed_at`/`ip_addr`/`user_agent` in one
  transaction. The old refresh token becomes unusable.
- **Reuse detection**: presenting a refresh token whose session is already
  revoked logs a WARN reuse signal (with user/session ids) and returns
  `AUTH_INVALID_SESSION` (401). There is no token-family history tracking.
- Expired sessions and revoked sessions are both rejected with the same 401.

### Token delivery and cookies

Login and refresh set both cookies via `setTokenCookies`:

| Attribute | Value |
| --- | --- |
| Names | `access_token`, `refresh_token` |
| `HttpOnly` | always on |
| `Secure` | production only |
| `SameSite` | `Lax` |
| `Path` | `/` |
| `Expires` | access = now + `AUTH_JWT_TTL`; refresh = now + `AUTH_SESSION_TTL` |

Logout clears both cookies.

### Access-token revocation

Access tokens are stateless, so a signature-valid token would otherwise stay
valid until it expires. To revoke before expiry, a Redis store holds two kinds
of **marker** (never a raw JWT or secret):

| Key | Value | Written by |
| --- | --- | --- |
| `revoked:user:<uid>` | `UnixNano` watermark of the revocation instant | user deletion, admin bulk wipe, password change/reset |
| `revoked:sess:<sid>` | `"1"` (presence) | logout, single-session revoke |

Both markers expire after `AUTH_JWT_TTL + 5s` (`revocationSkew`). If the
access-token TTL is non-positive the store treats tokens as already expired and
skips writes.

The auth middleware's check runs **after** `VerifyAccessToken` succeeds — never
before, since unverified claims are attacker-controlled — and performs a single
`MGET` of both keys, bounded by a **300 ms** timeout:

- Session marker present → revoked (session precedence).
- Otherwise the user watermark is parsed and compared: a token is revoked when
  `iat <= watermark + 5s`. Extending the revoked window past the watermark
  compensates for cross-instance clock skew and over-revokes, the safe
  direction. A brand-new login within 5 s of a revocation is briefly rejected
  too — deliberate.
- A corrupt or non-positive watermark returns an error rather than silently
  failing open.

Revoked tokens and fail-closed store errors both produce **401**
(`AUTH_INVALID_SESSION`). Expired and malformed tokens are also 401 but carry
their own codes (`AUTH_EXPIRED`, `AUTH_INVALID`), so the HTTP status never
reveals whether a token was revoked even though the `code` names the reason. On
a store error the middleware logs a WARN and **fails open by default**, because
the short access-token TTL bounds the exposure; set
`AUTH_REVOCATION_FAIL_CLOSED=true` to deny instead.

Where revocation is triggered:

| Action | Session rows | Access-token marker |
| --- | --- | --- |
| `DELETE /api/auth/logout` | revoke current session in tx | session marker after commit (best-effort; failure logged, still 200) |
| `DELETE /api/auth/sessions/:id` | revoke one session in tx | session marker after commit; failure is returned |
| `DELETE /api/auth/sessions/users/:userID` | revoke all user sessions in tx | user watermark after commit; failure is returned |
| `DELETE /api/users/:id` | revoke all user sessions in tx | user watermark after commit; failure is returned |
| `PUT /api/auth/password/change` | revoke all user sessions in tx | user watermark after commit (best-effort; still succeeds) |
| `PUT /api/auth/password/reset` | revoke all user sessions in tx | user watermark after commit (best-effort; still succeeds) |

### Registration (invitation flow)

Registration is invitation-based; no account exists until the invitee sets a
password.

1. `POST /api/auth/register` with `name` + `email`.
   - If the email already exists → `user.ErrEmailConflict` (409).
   - Any prior outstanding token for the email is revoked (latest invite wins;
     `revoked_at` is distinct from `used_at`).
   - A single-use token is created (256-bit, `regt_` prefix, SHA-256 stored,
     `AUTH_REGISTRATION_TOKEN_TTL`) and committed with an audit row.
2. The event is enqueued to the transactional outbox in the same transaction
   (it commits or rolls back with the token). The worker polls the outbox under
   the `email.user_registration` topic and renders and sends the completion link.
3. `GET /api/auth/register/:token` lets the completion form inspect expiry,
   `used_at`, and `revoked_at`.
4. `POST /api/auth/register/complete` with `token` + `password` validates the
   token (missing/expired/revoked/used all return **401**
   `AUTH_INVALID_REGISTRATION_TOKEN`), hashes the password, creates the user,
   and marks the token used — all in one transaction. The password is hashed
   only after the token validates, so a garbage token cannot force an expensive
   bcrypt on this unauthenticated route.

When `APP_INTERNAL_MODE=true`, `POST /api/auth/register` is mounted behind
authentication and `auth.Service.Register` additionally requires the
`auth.register-user` permission (admin/system). The created user gets the
default `user` role and `email_verified_at` set.

### Password recovery

1. `POST /api/auth/password/recover` with `email` → per-email Redis throttle
   (30 s) → looks up the user.
2. A 256-bit opaque token is generated, its SHA-256 hash stored in
   `password_recovery_tokens` with a TTL (`AUTH_PASSWORD_RECOVERY_TOKEN_TTL`),
   and an audit row is written in the same transaction.
3. An `email.password_recovery` event is enqueued to the outbox in the same
   transaction; the worker polls it and sends the reset email.
4. `GET /api/auth/password/recover/:token` exposes status.
5. `PUT /api/auth/password/reset` with `token` + `new_password` consumes the
   token, updates the password, revokes all sessions, writes an audit row, and
   (after commit) waters the user's access tokens. A used/expired/unknown token
   returns **401**.

An unknown email propagates `apperr.ErrNotFound` → **404** (enumeration-as-feature,
kept deliberately).

### Password change

`PUT /api/auth/password/change` (authenticated) verifies the current password,
updates the password, revokes **all** sessions for the user (including the
current one), and writes an audit row. The user watermark is written after
commit as best-effort, so a Redis failure does not turn a completed password
change into an error.

### Throttling

| Scope | Mechanism | Limit |
| --- | --- | --- |
| Global | Fiber in-process limiter, **production only** | 20 req/min per IP |
| `POST /api/auth/login` | Fiber in-process limiter | 5 req/min per IP |
| `POST /api/auth/register/complete` | Fiber in-process limiter | 5 req/min per IP |
| `POST /api/auth/password/recover` | Fiber in-process limiter + Redis per-email throttle | 5 req/min per IP + 30 s per email (shared across instances) |

Login runs a dummy bcrypt comparison on unknown emails so response time does not
reveal whether an account exists.

### Passwords and token entropy

- Passwords are hashed with **bcrypt cost 12**.
- Password inputs validate `min=8,max=72` bytes; bcrypt truncates beyond 72.
- Refresh tokens: 32 random bytes (`rt_` prefix).
- Registration tokens: 32 random bytes (`regt` prefix).
- Password-recovery tokens: 32 random bytes (no prefix).

## Authorization (RBAC)

Authorization is role-based, code-defined, and in-memory. There are no
permission tables to keep in sync; each entity declares its own role→permission
table and registers it at startup from its `NewService` constructor.

- Roles (`rbac.Role`): `admin`, `user`, `system` (background/worker actions).
  The `users.role` column has a SQL `CHECK` constraint as a backstop.
- Permissions use the `"<entity>.<verb>"` grammar, e.g. `user.update`.
- Services enforce with `Require(ctx, perms...)` (the role must hold **all**
  given permissions) or `RequireSelfOr(ctx, userID, perm)` (passes if the actor
  is the target user, otherwise falls back to the permission check). The actor
  (`UserID`, `Role`) and `SessionID` are injected into the request context by the
  authenticator middleware.
- `RoleUser` holds no permissions in any table; a plain user reaches their own
  record only through `RequireSelfOr`.

The complete permission set and its grants:

| Permission | RoleAdmin | RoleSystem | RoleUser | Enforced by |
| --- | :---: | :---: | :---: | --- |
| `user.read` | yes | yes | no | `ListUser` (list) and `GetUserByID`/`GetUserByEmail` (`RequireSelfOr`) |
| `user.update` | yes | yes | no | `UpdateUser`, profile-picture change/delete (`RequireSelfOr`) |
| `user.delete` | yes | yes | no | `DeleteUser` (`Require`) |
| `audit.read` | yes | yes | no | `audit.Service.List` |
| `auth.change-password` | yes | yes | no | `ChangePassword` (`RequireSelfOr`) |
| `auth.register-user` | yes | yes | no | `Register` when `APP_INTERNAL_MODE=true` |
| `auth.revoke-user-sessions` | yes | yes | no | bulk session revoke, and single-session revoke by a non-owner (`RequireSelfOr` against the session owner) |
| `auth.view-user-sessions` | yes | yes | no | list a user's active sessions (`RequireSelfOr` against the target user) |

Dump every registered permission code as a JavaScript array (replaying the real
service registrations, not grepping) with:

```bash
make permissions
# or: go run ./cmd/cli permissions
```

## API documentation

Route reference, request/response shapes and examples are not duplicated here:
an OpenAPI spec is planned. Until it lands, `cmd/api/server.go` is the source of
truth for the mounted routes and `internal/transport/http/` for the handler
contracts.

All application routes are mounted under the `/api` prefix. Authenticated
routes accept the access token from the `access_token` cookie or the
`Authorization: Bearer <token>` header. Request bodies are limited to 5 MB
globally (`MaxBodySize`).

## Error handling

Services return typed errors from the `apperr` kernel. Handlers return them
unchanged; Fiber's `ErrorHandler` (`internal/transport/http/router.go`) calls
`ParseError`, which normalizes everything into:

```json
{ "error": { "message": "...", "details": null, "code": "..." } }
```

Status mapping:

| Source | Kind / case | HTTP status |
| --- | --- | --- |
| `apperr.KindValidation` | validation | 422 |
| `apperr.KindNotFound` | not found | 404 |
| `apperr.KindConflict` | conflict | 409 |
| `apperr.KindUnauthorized` | authentication missing/invalid | 401 |
| `apperr.KindForbidden` | authenticated but not permitted | 403 |
| `apperr.KindThrottled` | rate limited | 429 |
| `*fiber.Error` with code 413 | body too large | 413 |
| `context.DeadlineExceeded` | timeout | 504 |
| `context.Canceled` | client closed request | 499 |
| malformed JSON body | bind error | 400 |
| everything else | unmapped | 500 |

`apperr.Error` is immutable-returning (`SetMessage`/`WithDetails` produce
copies) and comparable with `errors.Is` by `Kind` + `Code`. Handler-level
sentinels (invalid path param, multipart, upload errors, rate limit) live in
`internal/transport/http/error.go` and `uploader.go`.

## Audit logging

`audit_logs` records user-initiated state changes for compliance and forensics.

- **Columns**: `actor_id` (NULL for system actions), `action`, `entity`,
  `entity_id`, `prev`/`next` JSONB snapshots, `meta` JSONB, `created_at`.
- **Actor/meta enrichment** (`Entry.FillActorMeta`, called by the repository at
  insert time): fills `actor_id` from the RBAC context and adds
  `request_id`, `ip_addr`, `user_agent`, `session_id`, and `actor_role` to
  `meta`. `ip_addr` comes from `AuditContext` middleware, which only honors
  forwarded headers from `TRUSTED_PROXIES`.
- **Atomicity**: audit rows are written inside the same transaction as the
  change they record, so a committed action is never silently unaudited.
- **Coverage** — actions declared beside their domain permissions:
  - auth: `auth.register`, `auth.complete-registration`, `auth.login`,
    `auth.logout`, `auth.change-password`, `auth.reset-password`,
    `auth.password-recovery-request`, `auth.revoke-user-sessions`,
    `auth.revoke-session`.
  - user: `user.update`, `user.delete`, `user.change-profile-picture`,
    `user.delete-profile-picture`.
- **Not audited**: refused attempts (failed login) and refresh-token reuse are
  security *events*, not state changes. They are emitted as structured WARN logs
  so the table stays clean and the unauthenticated login path takes no write.
- `GET /api/audit/` lists entries (requires `audit.read`). It accepts
  `entity`, `actor`, `date`/`from`/`to`, `tz`, `sort`/`order` and `page`/`limit`,
  and reports the applied query in `meta`. `actor` matches `actor_id` exactly when
  it is a full UUID and otherwise matches the actor's name with `ILIKE`. The date
  bounds are bare calendar dates (`2006-01-02`) read in `tz`; `from` is inclusive
  and `to` covers its whole day, so
  `from=2026-09-01&to=2026-09-28&tz=Asia/Jakarta` selects through the end of the
  28th in Jakarta. An absent or unknown zone falls back to UTC, and `meta` reports
  the zone actually used. `date` is the single-day shortcut and wins over
  `from`/`to`.

## Messaging and the worker

Email delivery is decoupled from HTTP response time with a **transactional
outbox**. The service writes the event row inside the same transaction as the
business state; the worker polls the table and delivers it later, so a crash
between commit and delivery cannot lose the email.

```text
HTTP request
  └─ service Transact { business state + audit + INSERT outbox_messages }   (one commit)
                          │
                          ▼
     worker (~1s): FetchBatch (attempts < 5, ORDER BY seq) ─▶ handler ─▶ SMTP
                          │                                      └─ MarkDone (DELETE)
                          └─ failure ─▶ MarkFailed (attempts + 1, last_error)
```

Topics and payloads:

| Topic | Payload | Enqueued by |
| --- | --- | --- |
| `email.password_recovery` | `auth.PasswordRecoveryMessage` | `RecoverPassword` |
| `email.user_registration` | `auth.CompleteRegistrationMessage` | `Register` |

The producer marshals the domain message as JSON into `outbox_messages.payload`
(`internal/infrastructure/postgres/outbox_repository.go`); the worker unmarshals
it per topic in `cmd/worker` and hands it to `worker.AuthWorker`. Delivery is
**at-least-once**: a crash after the SMTP send and before `MarkDone` resends that
one message, so handlers must be idempotent (a duplicate email is acceptable,
losing one is not).

Reliability features (`internal/worker/outbox_worker.go`):

- **Retries**: a handler error increments `attempts` and writes `last_error`; the
  row is retried on later ticks until `outbox.MaxAttempts` (5), after which it is
  skipped but left in the table as a dead-letter record to inspect with SQL.
- **Ordering**: batches are read oldest-first by the identity `seq`.
- **Bounded operations**: the SMTP send is capped at 10 s (`pkg/mailer`);
  `MarkDone`/`MarkFailed` run on `context.WithoutCancel` so bookkeeping survives
  graceful shutdown.
- **Crash isolation**: `cmd/worker` runs the poll loop under the process signal
  context; stopping the process simply pauses delivery until it restarts.

Run the worker separately from the API: `make dev:worker`.

## Observability and health

- **Metrics** (`pkg/metrics`), all under the `app_` namespace:
  - `app_info{version,environment}` — build identity.
  - `app_request_total{path,method,status_code}` and
    `app_request_duration{path,method,status_code}` (HTTP-tuned buckets) — the
    RED pair.
  - `app_requests_in_flight{method}` — concurrency.
  - `app_request_size_bytes{route,method}` / `app_response_size_bytes{route,method}`
    — payload shape.
  - `app_errors_total{code}` — error responses by **stable application error
    code** (`AUTH_CREDENTIALS`, `RBAC_UNAUTHORIZED_PERM`, `VALIDATION`, ...),
    which is far more actionable than a flat 4xx/5xx rate.
  - `app_panics_total` — recovered panics.
  - `app_db_pool_{acquired,idle,total,max}_conns`, plus
    `app_db_pool_new_conns_total` and `app_db_pool_canceled_acquire_total` for
    churn, emitted by a `pgxpool.Stat` collector.

  `path`/`route` use the matched route template, never the raw path, so label
  cardinality stays bounded; the Go runtime and process collectors come from
  `promhttp`. The instrumentation middleware resolves status **and** error code
  from a returned error (Fiber assigns the final status only after the chain
  unwinds), and recovers panics to count them, record the implied 500, and then
  re-panic to the outer recoverer.
- **Exporter**: gated by `METRICS_ENABLED` (default: production), a separate
  Fiber app serves `/metrics` on `METRICS_PORT` (default `APP_PORT + 1`; compose
  pins `9091` so the scrape target is stable and never tracks `APP_PORT`). The
  API binds every interface on `APP_PORT`; what is reachable from outside is
  decided solely by the compose `ports:` mapping — only Caddy publishes. The
  metrics sidecar is intentionally excluded from graceful shutdown.
- **Health**: `GET /api/healthz` pings Postgres and Redis with a 2 s timeout.
  Any failure returns **503** with a `dependencies` map of the failing services;
  success returns `{"status":"ok","internal_mode":<bool>}`. Because it doubles
  as a probe, a sustained dependency outage also fails liveness — split the
  endpoints if your platform restarts unhealthy instances.
- **Security headers**: Fiber `helmet` with a deny-by-default CSP, `X-Frame-Options: DENY`,
  a strict-origin-when-cross-origin referrer policy, and a restrictive
  permissions policy. HSTS is configured in production and emitted only on
  secure requests.
- **Graceful shutdown** (API): after `SIGINT`/`SIGTERM` the process waits 5 s to
  let load balancers drain, then shuts the server down with a 25 s deadline.
- **Dashboards**: Prometheus scrape config and Grafana provisioning/dashboards
  (`deployment/grafana/dashboards/api-metrics.json`) are checked into
  `deployment/` and wired by `compose.yml`.

## Database and migrations

- PostgreSQL, accessed through `pgx` (`pgxpool` for the pool) with **raw SQL**.
- `goose` migrations live in `migrations/` and are **additive only**:

  | Migration | Table |
  | --- | --- |
  | `00001_create_registration_tokens_table.sql` | `registration_tokens` |
  | `00002_create_users_table.sql` | `users` |
  | `00003_create_sessions_table.sql` | `sessions` |
  | `00004_create_password_recovery_tokens_table.sql` | `password_recovery_tokens` |
  | `00005_create_audit_logs_table.sql` | `audit_logs` |
  | `00006_create_outbox_messages_table.sql` | `outbox_messages` |

- **Rollout order**: the outbox `INSERT` is on the auth critical path, so apply
  `00006` → deploy the worker → deploy the API. `00006` is additive, so the old
  binary is unaffected. The worker polls any rows already in the table on its
  first tick, so no reconciliation step is needed.
- `users` has a partial unique index on `email` (`WHERE deleted_at IS NULL`) so a
  soft-deleted email can be reused; `role` and `gender` are `CHECK`-constrained.
- `sessions.user_id` and `audit_logs.actor_id` reference `users(id)` with
  `ON DELETE CASCADE` / `ON DELETE SET NULL` respectively.
- Transactions are implemented by `postgres.DB.Transact`: the `pgx.Tx` is stored
  in the context, and repositories fetch it with `db.GetConn(ctx)` (adding
  `FOR UPDATE` on transactional reads). Rollback/commit run on a
  `context.WithoutCancel` + 5 s timeout so a cancelled request context cannot
  leave a transaction (and its locks) hanging or churn the pool.

Create and apply migrations:

```bash
make migration:create   # prompts for a name, writes a goose SQL file
make migration:up       # apply all pending
make migration:status   # show current version
make migration:down     # roll back one
make migration:clear    # roll back all (down-to 0)
```

The `make migration:*` targets require the `goose` CLI and read `DB_*` from
`.env`.

## Backups

Postgres is backed up by the `backup` sidecar (`deployment/backup/`): a nightly
`pg_dump -Fc` logical dump with local GFS retention and an optional offsite copy
to a **private** R2 bucket. Busybox `crond` runs
`deployment/backup/backup-postgres.sh` at 03:15 wall-clock (container UTC), and
its output is redirected to PID 1 so it appears in `docker logs backup`.

| Stage | What | Cadence | Retention | Where |
| --- | --- | --- | --- | --- |
| 1. Dump | `pg_dump -Fc` (custom format), written `.partial` then renamed | Nightly 03:15 UTC | — | `backups/daily/<UTC-stamp>.dump` |
| 2. Verify | `pg_restore --list` must succeed or the file is deleted and the run fails | Every run | — | in place |
| 3. Local GFS | Copies promoted by date | Sunday → `weekly`, day 01 → `monthly` | `BACKUP_RETENTION_DAILY` (7) / `_WEEKLY` (4) / `_MONTHLY` (6), newest N kept | `backups/{daily,weekly,monthly}/` |
| 4. Offsite | `rclone copy` to private R2, then age prune (`rclone delete --min-age`) | Every run, when `BACKUP_R2_BUCKET` is set | `BACKUP_R2_RETAIN_DAYS` (30) | `BACKUP_R2_BUCKET`/`BACKUP_PREFIX`/`<tier>/` |
| 5. Guard | Refuses to run if `BACKUP_R2_BUCKET` equals the public `R2_BUCKET` | Every run with offsite enabled | — | — |

- **RPO up to 24 h.** Dumps run nightly, so a host loss can drop everything
  written since the last 03:15 run. With offsite enabled, the newest dump is
  copied to a separate private bucket, so a total host loss still recovers.
- **RTO in minutes.** A recovery is "restore one custom-format dump into a
  fresh database" — minutes for this dataset size, plus the time to point the
  API at it.
- **Same-host dumps are not offsite.** `backups/` lives on the same host (and
  volume) as Postgres, so it survives a bad migration but not a lost host. The
  R2 copy is what makes it a real backup; leave `BACKUP_R2_BUCKET` empty only if
  you accept local-only.
- **Offsite must be a separate, private bucket.** The app's `R2_BUCKET` is
  served from a public `pub-*.r2.dev`-style URL, so uploading dumps there would
  publish the whole database. The script hard-refuses (non-zero exit) when
  `BACKUP_R2_BUCKET` equals `R2_BUCKET`, before any upload. Use `rclone copy`,
  never `sync`: mirroring would delete every remote copy if the local
  `backups/` dir is ever lost.
- **Deliberately not backed up:**
  - **Redis** — covered by AOF persistence on the `redis-data` volume. It holds
    throttle counters and access-token revocation markers; if the volume is
    lost, the worst case is up to `AUTH_JWT_TTL` (15 min) of revoked-but-still
    valid access tokens, then normal operation resumes.
  - **Grafana** — provisioning and dashboards are checked into
    `deployment/grafana/`, so datasources and dashboards are rebuilt from git on
    boot; only ad-hoc local edits are lost.
  - **Prometheus** — the TSDB is operational metrics, not business data, and is
    itself capped by `--storage.tsdb.retention.time=15d`.

**Known limits of this approach:**

- **Scope: one database, no globals.** `pg_dump` covers `$DB_NAME` only. A second
  database in the same cluster would be silently missed — move to `pg_dumpall`
  if that ever happens. Roles/globals are not included either, so a restore into
  a *fresh* cluster needs `pg_dumpall --globals-only` first; restoring into this
  cluster is unaffected.
- **Logical, not point-in-time.** You can roll back to last night, not to one
  minute before a bad deploy: a corrupting migration or query costs everything
  written since the last dump. Minutes-level RPO needs WAL archiving
  (`pg_basebackup` plus pgBackRest/Barman) and is deliberately out of scope for
  now. Revisit when RPO must be under a few hours, when a full restore starts
  approaching your RTO budget, or when there is a staging box to rehearse PITR
  restores on.
- **No physical/whole-cluster copy.** This protects against corruption and a bad
  migration, and (with offsite enabled) a lost host. It does not give you
  byte-identical cluster restore or provider-level snapshots; add volume
  snapshots at the provider if you want that coarse second layer.

### Manual one-off backup

```bash
docker compose run --rm --entrypoint sh backup /backup-postgres.sh
```

### Restore runbook

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

### Restore drill (prove a dump is restorable, without touching the live DB)

```bash
# Restore into a scratch database, list tables, check a row count, drop it.
docker compose exec -T postgres createdb -U "$DB_USER" restoretest
docker compose exec -T postgres pg_restore --no-owner -U "$DB_USER" -d restoretest < "$DUMP"
docker compose exec -T postgres psql -U "$DB_USER" -d restoretest -c '\dt'
docker compose exec -T postgres psql -U "$DB_USER" -d restoretest -c 'select count(*) from users'
docker compose exec -T postgres dropdb -U "$DB_USER" restoretest
```

Run this after any schema change or before you rely on a dump. A backup that has
never been restored is a hope, not a backup.

## Testing

Unit tests only; they never touch a real database, Redis, or SMTP server.

- **Framework**: `testify` (`assert` for continuing checks, `require` for setup
  that must not continue) with table-driven `TestService_<Method>` +
  `t.Run("case", ...)` subtests.
- **Mocks**: generated by `mockery` from `.mockery.yml`.
  - Entity-scoped: `internal/auth/mocks/`, `internal/user/mocks/`.
  - Shared infrastructure: `internal/testing/mocks/` (`Transactor`, `Storage`,
    `File`, `Throttler`, `Recorder`, revocation `Checker`/`Revoker`/`Store`).
  - Regenerate after any interface change:

    ```bash
    mockery
    ```

- **Fixture pattern**: `setupTestFixture(t)` builds every mock with `t` (so an
  unexpected call fails the test), constructs the service under test, and
  registers `t.Cleanup` to run `AssertExpectations` on every mock. Transactor
  expectations are registered inside `RunAndReturn` because the inner
  expectations must exist before the closure runs.
- **Hermetic**: tests set what they need with `t.Setenv` (see
  `config/config_test.go`) and pass without a local `.env`.
- Run the suite:

  ```bash
  make test   # go test -race -v -count=1 ./... -cover
  ```

## Development tooling

| Target | Command | Purpose |
| --- | --- | --- |
| `make dev` | `air -c .air.toml` | API server with hot reload |
| `make dev:worker` | `air -c .air.worker.toml` | worker with hot reload |
| `make tidy` | `go mod tidy` | Tidy modules |
| `make lint` | `golangci-lint run` | Lint (v2 config in `.golangci.yml`) |
| `make test` | `go test -race -v -count=1 ./... -cover` | Full test suite |
| `make build` | `CGO_ENABLED=0 GOOS=linux go build …` | Static Linux binaries at `./bin/api` and `./bin/worker` |
| `make run` | `./bin/api` | Run the built binary |
| `make cli` | `go run ./cmd/cli $(ARGS)` | Developer CLI (currently `permissions`) |
| `make permissions` | `go run ./cmd/cli permissions` | Dump all permission codes as a JS array |
| `make migration:status` | `goose … status` | Migration status |
| `make migration:up` | `goose … up` | Apply migrations |
| `make migration:down` | `goose … down` | Roll back one migration |
| `make migration:clear` | `goose … down-to 0` | Roll back everything |
| `make migration:create` | `goose … create <name> sql` | Scaffold a migration |

`golangci-lint` must be **v2.x**; the config header recommends:

```bash
go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.12.2
```

## Conventions

- **Import aliases are fixed**: `redisInfra` for
  `internal/infrastructure/redis`, `strs` for `pkg/strings`, and `sharedMocks`
  for `internal/testing/mocks`. `internal/transport/http` is `package http` and
  is imported unaliased.
- **Naming**: packages are short, lowercase, single-word; files are
  `snake_case`; constructors are `New<Name>()`; sentinel errors use an `Err`
  prefix; constants are PascalCase.
- **Documentation**: every package has a package-level godoc comment and every
  exported symbol has a doc comment.
- **Interfaces are consumer-side and narrow**; implementations live in
  `internal/infrastructure/`.
- **Adding a feature** follows a fixed order: model + interface in
  `internal/<entity>/` → repository in `internal/infrastructure/postgres/` →
  service → handler → wire in `cmd/api/container.go` and routes in
  `cmd/api/server.go` → migration → update `.mockery.yml` + run `mockery` →
  tests.
- **Errors bubble up unchanged**; only add logging where it adds context, and
  avoid log-and-return pairs.
- **Multi-step writes** use `Transactor.Transact`. Events are written to the
  transactional outbox **inside** the closure (so they commit with the state);
  post-commit side effects such as storage cleanup and access-token revocation
  run outside the closure.

Project-specific skills under `.agents/skills/` (architecture, errors, handlers,
repositories, services, testing) encode these rules in more detail.

## License

MIT — see [`LICENSE`](LICENSE). Copyright (c) 2024 Adil Prawirdani.
