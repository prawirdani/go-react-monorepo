# Golang REST API

A production-shaped REST API template in Go: clean/onion layering
(Handler → Service → Repository), stateless JWT access tokens with server-side
sessions, a transactional outbox for asynchronous email, PostgreSQL via `pgx`
with raw SQL, Cloudflare R2 object storage, and Prometheus metrics.

The point is a reference you can rename and extend: strict layer boundaries,
interface-driven dependencies, manual dependency injection, and tests that never
touch a real database, Redis, or SMTP server.

The dashboard this API serves lives in the same repository under
[`client/`](./client/README.md) — a bun + Turborepo monorepo — so one commit
changes both halves. A request/response shape, JSON field name, or error code is
not finished until the client's zod schemas agree; see [Client](#client).

- Module: `github.com/prawirdani/go-react-monorepo`
- Go: `1.26.5` (see `go.mod`)
- License: MIT (see `LICENSE`)

---

## Table of contents

- [Highlights](#highlights)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Client](#client)
- [Getting started](#getting-started)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Authentication and sessions](#authentication-and-sessions)
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
  nothing about PostgreSQL, Redis, R2, or Fiber.
- **Split-token auth**: short-lived HS256 JWT access tokens plus opaque, rotating
  refresh tokens stored server-side as SHA-256 hashes.
- **Revocation without stateful tokens**: a Redis marker store invalidates
  stateless JWTs on logout, session revoke, password change/reset, admin wipe,
  and user deletion.
- **Invitation-based registration**: no account row exists until the invitee
  consumes the emailed single-use token and sets a password.
- **Async email** via a transactional outbox polled by the worker: at-least-once
  delivery, bounded retries, and a dead-letter row for the operator.
- **Audit trail** written inside the same transaction as the change it records.
- **Typed error kernel** (`apperr`) mapped to HTTP status codes in one place.
- **Generic list query DSL**: pagination, allow-listed sorting, enum-validated
  filters, and the applied query echoed back in `meta`.
- **Hermetic unit tests** with `testify` + `mockery`.

## Tech stack

| Concern | Choice |
| --- | --- |
| Language | Go 1.26.5 |
| HTTP | [Fiber v3](https://github.com/gofiber/fiber) (`github.com/gofiber/fiber/v3` v3.5.0) |
| Database | PostgreSQL via [pgx v5](https://github.com/jackc/pgx) (raw SQL, no ORM) + [scany/v2](https://github.com/georgysavva/scany) for struct scanning |
| Migrations | [goose](https://github.com/pressly/goose) (SQL files in `migrations/`) |
| Cache / throttle | Redis via [go-redis v9](https://github.com/redis/go-redis): counters, revocation markers |
| Object storage | Cloudflare R2 through the AWS SDK v2 S3 client |
| Auth | [golang-jwt/jwt v5](https://github.com/golang-jwt/jwt), `golang.org/x/crypto/bcrypt` |
| Validation | [go-playground/validator v10](https://github.com/go-playground/validator) |
| Config | `.env` via [godotenv](https://github.com/joho/godotenv) |
| Logging | [zerolog](https://github.com/rs/zerolog) behind a swappable `log.Logger` |
| Metrics | [Prometheus client_golang](https://github.com/prometheus/client_golang) |
| Mail | [gomail.v2](https://pkg.go.dev/gopkg.in/gomail.v2) |
| Testing | [testify](https://github.com/stretchr/testify) + [mockery](https://github.com/vektra/mockery) |
| Tooling | [Air](https://github.com/cosmtrek/air) hot reload, [golangci-lint v2](https://github.com/golangci/golangci-lint) |

The dashboard under `client/` carries its own stack (React 19, Vite, TanStack
Router/Query/Form, Tailwind, Biome) — see [`client/README.md`](./client/README.md).
Nothing in the API's tooling depends on it.

## Architecture

Each layer has a single responsibility and may only depend on the layer beneath
it:

> **Handler** (HTTP only) → **Service** (business logic) → **Repository** (data access)

| Layer | Location | May import |
| --- | --- | --- |
| Transport | `internal/transport/http` | Domain packages, `pkg/` |
| Domain | `internal/auth`, `internal/user`, `internal/audit`, `internal/rbac` | Other domain packages and `internal/ports/*`; **never** `internal/infrastructure/*` or Fiber |
| Ports | `internal/ports/*` | Stdlib and small value types only |
| Infrastructure | `internal/infrastructure/*` (`postgres`, `redis`, `r2`) | Domain/ports |
| Shared | `pkg/*` (`log`, `mailer`, `metrics`, `nullable`, `strings`, `validator`) | Stdlib and third-party libs |
| Composition roots | `cmd/api`, `cmd/worker`, `cmd/cli` | Everything |

The rule that keeps this honest: **entity packages import no infrastructure.** A
service depends on the interface it needs, injected from the composition root.

**Where interfaces live** — next to their consumers, split by use:

- `internal/auth/interfaces.go` — `Repository` (composed from `SessionReader`,
  `SessionWriter`, `TokenReader`, `TokenWriter`), a narrow `UserRepository`, and
  `EventProducer`.
- `internal/user/repository.go` — `Repository`, plus a local `SessionRevoker`
  implemented by the auth repository (no import cycle).
- `internal/ports/*` — `Transactor` and the `Query`/`Filterer`/`Sorter`/`Paginator`
  contracts, `Storage`/`File`, `Throttler`/`Result`/`Counter`, the outbox
  `Message`/`Writer`/`Store`, and revocation `Checker`/`Revoker`/`Store`.

**Dependency injection** — `cmd/api/container.go` is the only place production
dependencies are assembled: R2 client, Redis throttler and revocation store,
PostgreSQL repositories, in-memory authorizer, then the services. `server.go`
builds handlers and middleware and mounts routes. No framework, no service
locator.

**Request flow** for `GET /api/auth/me`:

1. Global middleware: rate limit (production only), panic recoverer, metrics,
   security headers, request logger, request-id, audit context, compression,
   ETag, CORS.
2. The authenticator verifies the JWT signature/`exp`/`iat`/`sid`, checks Redis
   revocation markers, and injects the RBAC actor, session id, and request-scoped
   log fields into the context.
3. The handler calls `user.Service.GetUserByID`, which enforces
   `RequireSelfOr(user.read)`.
4. The repository calls `db.GetConn(ctx)` — the pool, or the `pgx.Tx` stored in
   the context (adding `FOR UPDATE` on transactional reads).
5. The handler returns `Body{Data: ...}`; errors go through `ParseError`.

## Project layout

```text
cmd/
  api/                 HTTP server entrypoint (Fiber)
    main.go            config, postgres, redis, graceful shutdown
    container.go       manual DI wiring
    server.go          middleware chain, routes, health, metrics exporter
  worker/              background entrypoint (polls the outbox)
  cli/                 developer CLI (`permissions`, `create-admin`)

config/                env-based config structs, parsed and validated at startup

internal/
  apperr/              typed error kernel: Kind, Error, constructors
  audit/               audit Entry, request context, Recorder/Reader, service
  auth/                access tokens, sessions, crypto, models, service
  user/                user model, service, repository interface, search DSL
  rbac/                roles, permissions, authorizer, actor context
  ports/               interfaces implemented by infrastructure
    outbox/ repository/ revocation/ storage/ throttle/
  infrastructure/
    postgres/          pgx pool, transaction wrapper, query builder, repositories
    redis/             throttle + revocation store
    r2/                Cloudflare R2 storage (S3 API)
  transport/http/      Fiber handlers, middleware, error normalization, router
  worker/              outbox poll worker + AuthWorker (renders and sends email)
  testing/mocks/       shared infrastructure mocks

pkg/                   framework-agnostic helpers (log, mailer, metrics,
                       nullable, strings, validator)

migrations/            goose SQL migrations (additive only)
deployment/            caddy/ prometheus/ grafana/ backup/ + runbooks
compose.yml            bare API: api, worker, migrate, postgres, redis, backup
compose.caddy.yml      the above + caddy, prometheus, grafana
Dockerfile             multi-stage build (distroless runtime)
Makefile               dev/build/test/lint/migration/cli/client targets
.air.toml .air.worker.toml   Air configs (both exclude client/)

client/                the dashboard: bun + Turborepo monorepo
  apps/dashboard/      Vite + React 19 app
  packages/            api, schemas (zod), queries, ui, utils, i18n, config
  AGENTS.md            conventions for working in the client half
```

## Client

`client/` is independent of the Go module: its own `package.json` and lockfile,
so the API is not a Turbo task and Go is not a Turbo package. The `make client:*`
targets are the bridge. Start with [`client/README.md`](./client/README.md) and
[`client/AGENTS.md`](./client/AGENTS.md).

## Getting started

**Prerequisites:** Go `1.26.5`+, PostgreSQL and Redis (`compose.yml` provides
both), the [goose](https://github.com/pressly/goose) CLI for `make migration:*`,
optional Air and `golangci-lint` v2, and bun 1.4 for the dashboard.

**1. Start the stack.** `compose.caddy.yml` is self-contained (Postgres, Redis,
API, worker, Caddy, Prometheus, Grafana on one bridge network). The default
`compose.yml` is the bare API for fronting with your own proxy.

```bash
docker compose up -d          # add -f compose.caddy.yml for the full stack
```

Every service loads `.env` via `env_file:`, so credentials live in one place;
`api` and `worker` override `DB_HOST`/`REDIS_HOST` so `DB_HOST=localhost` keeps
working for bare-metal `make dev`. That also means **every container, Caddy
included, receives the whole file, secrets and all** — the deliberate trade-off
for a single source of credentials. Narrow it by dropping `env_file:` from a
service and listing only what it needs under `environment:`. Caddy serves the API
on `:8080`, Grafana on `:3000` (`GRAFANA_ADMIN_USER`/`_PASSWORD`, default
`admin`); Prometheus and the datastores stay internal. Postgres and Redis data
live in named volumes — `docker compose down -v` resets them.

**2. Configure the environment.**

```bash
cp .env.example .env
# at minimum: AUTH_JWT_SECRET (>= 32 chars) and DB_*
```

`config.LoadConfig()` calls `godotenv.Load()`, so a local `.env` is read
automatically in development.

**3. Apply migrations.** With compose there is nothing to run by hand: the
one-shot `migrate` service applies goose migrations once Postgres is healthy, and
both API and worker wait on `service_completed_successfully`, so a failed
migration blocks the app tier instead of serving a half-built schema. For
bare-metal, run `make migration:up`.

**4. Run the API and the worker** — separate processes:

```bash
make dev          # API with hot reload (Air)
make dev:worker   # outbox poll worker, hot reload (Air)
```

The worker opens its own pool and does not block startup on Postgres; the poll
loop retries until the database is reachable.

**5. Build a binary.**

```bash
make build        # CGO_ENABLED=0 GOOS=linux -> ./bin/api and ./bin/worker
make run          # run ./bin/api
```

The `Dockerfile` copies both into a distroless runtime image; the API is the
default `CMD`, the `worker` service overrides it.

**6. Run the dashboard (optional).**

```bash
make client:install                                      # bun install, once
cp client/apps/dashboard/example.env client/apps/dashboard/.env
make client:dev                                          # Vite on :$VITE_PORT
```

It talks to a relative `/api`; in development Vite proxies that to
`VITE_PROXY_TARGET` (default `http://localhost:8080`), which is why `VITE_API_URL`
stays empty locally — same origin, no CORS. In production Caddy builds and serves
the dashboard at `/srv`, so a frontend change needs a rebuild of the caddy image.

## Deployment

Single-host Docker Compose + Caddy. The step-by-step checklist and reference
material (TLS/domain, production flip, public surface, Cloudflare) live in
[`deployment/DEPLOYMENT.md`](./deployment/DEPLOYMENT.md).

The stack is deployment-ready as-is; production changes only the Caddy site
address, the published ports, and `APP_ENV`.

## Configuration

All configuration comes from environment variables, optionally loaded from
`.env`. Parsing happens in `config/*.go`; `LoadConfig()` parses every section then
calls `Validate()`.

### Environment variables

[`.env.example`](./.env.example) is the canonical, commented list — copy it to
`.env` and edit. The settings whose meaning is not obvious from the name:

| Variable | Default | Notes |
| --- | --- | --- |
| `APP_ENV` | empty | `dev` or `prod`; anything else fails validation |
| `APP_INTERNAL_MODE` | `false` | Registration becomes admin-only (`auth.register-user`) |
| `METRICS_ENABLED` / `METRICS_PORT` | `APP_ENV=prod` / `APP_PORT + 1` | Unset follows the environment; compose pins `9091` |
| `TRUST_PROXY` | `false` | Read the client IP from `X-Forwarded-For`. Trusts the proxy by peer class (private/loopback/unix socket), not an address list. Leave false for a directly-reachable API: there the socket peer is used, so a header cannot be forged |
| `RATE_LIMIT_GLOBAL_MAX` / `_USER_MAX` / `_AUTH_MAX` / `_WINDOW` | `300` / `120` / `20` / `1m` | See [Throttling](#throttling) |
| `CORS_ORIGINS` / `CORS_CREDENTIALS` | empty / `false` | With credentials, `*` or an unparseable origin fails startup |
| `AUTH_JWT_SECRET` | **required** | `>= 32` chars; rotating it invalidates all access tokens |
| `AUTH_JWT_TTL` / `AUTH_SESSION_TTL` | `15m` / empty | Short access TTL bounds revocation exposure |
| `AUTH_REVOCATION_FAIL_CLOSED` | `false` | When false a store error fails open and logs a warning |
| `AUTH_LOGIN_MAX_ATTEMPTS` / `AUTH_LOGIN_LOCKOUT_TTL` | `5` / `15m` | Per-account lockout, counted by hashed email |
| `DB_MINCONNS` / `DB_MAXCONNS` / `DB_WORKER_MAXCONNS` | `0` / **required** / `0` | `DB_WORKER_MAXCONNS=0` shares `DB_MAXCONNS`; the worker pool is created without a startup ping |

### Startup validation

| Check | Where |
| --- | --- |
| `APP_ENV` is `dev` or `prod` | `Config.Validate()` |
| `AUTH_JWT_SECRET` length `>= 32` | `Config.Validate()` |
| `CORS_CREDENTIALS=true` with `*` or an invalid origin | `Config.Validate()` |
| `DB_MAXCONNS > 0` and `<= MaxInt32` | `Postgres.Parse()` |
| `DB_MINCONNS` within `[0, DB_MAXCONNS]` | `Postgres.Parse()` |
| `APP_PORT` is an integer | `App.Parse()` |

All of these abort startup. Duration and integer env vars that fail to parse are
silently ignored (the field keeps its default) — except `APP_PORT`.

## Authentication and sessions

Split-token scheme: short-lived stateless JWT access tokens plus long-lived
opaque refresh tokens backed by server-side session rows.

**Access token** — HS256 with `AUTH_JWT_SECRET`; claims `sub`, `sid`, `role`,
`iat`, `exp`. `exp` is required, since a token without one makes revocation TTLs
meaningless. A missing `iat`/`sid`, an unknown signing method, or a bad signature
is `AUTH_INVALID`; expired is `AUTH_EXPIRED`. Both map to **401**, never 500.
Delivered in the `access_token` cookie or `Authorization: Bearer`, and echoed in
the login/refresh body.

**Refresh token and session** — 256-bit opaque, `rt_` prefixed; only its SHA-256
hash is stored (`sessions.refresh_token_hash`, unique). A session row holds
`user_id`, `refresh_token_hash`, `user_agent`, `ip_addr`, timestamps, and
`revoked_at`. Each refresh mints a new access **and** refresh token, replaces the
hash, and updates `accessed_at`/`ip_addr`/`user_agent` in one transaction; the old
token dies. Presenting a refresh token whose session is already revoked logs a WARN
reuse signal and returns `AUTH_INVALID_SESSION` (401). Expired and revoked sessions
are indistinguishable.

**Cookies** — login and refresh set `access_token` and `refresh_token` with
`HttpOnly` always, `Secure` in production, `SameSite=Lax`, `Path=/`, and an
`Expires` matching the token TTL. Logout clears both.

**Revocation.** Access tokens are stateless, so a Redis store holds two kinds of
marker (never a raw JWT or secret):

| Key | Value | Written by |
| --- | --- | --- |
| `revoked:user:<uid>` | `UnixNano` watermark of the revocation instant | user deletion, admin bulk wipe, password change/reset |
| `revoked:sess:<sid>` | `"1"` (presence) | logout, single-session revoke |

Both expire after `AUTH_JWT_TTL + 5s`. The check runs **after**
`VerifyAccessToken` succeeds — never before, since unverified claims are
attacker-controlled — as a single `MGET` bounded by 300 ms. A session marker wins;
otherwise a token is revoked when `iat <= watermark + 5s`, which over-revokes
across clock skew (the safe direction) and briefly rejects a login within 5 s of a
revocation. A corrupt watermark errors rather than failing open.

Session rows are revoked inside the transaction and the marker written after
commit: best-effort (logged, request still succeeds) for logout and password
change/reset, a returned error for explicit session/user revokes.

**Registration (invitation).** `POST /api/auth/register` with `name` + `email`
rejects an existing email (409), revokes any prior outstanding token (latest
invite wins), and stores a single-use token (256-bit, `regt_`, SHA-256,
`AUTH_REGISTRATION_TOKEN_TTL`) with an audit row and the outbox event in one
transaction. `GET /api/auth/register/:token` exposes expiry/`used_at`/`revoked_at`.
`POST /api/auth/register/complete` validates the token (any bad state → 401
`AUTH_INVALID_REGISTRATION_TOKEN`), then hashes the password, creates the user,
and marks the token used — one transaction. The password is hashed only after the
token validates, so garbage cannot force a bcrypt on an unauthenticated route.
With `APP_INTERNAL_MODE=true` the route is authenticated and additionally requires
`auth.register-user`.

**Password recovery.** `POST /api/auth/password/recover` runs a 30 s per-email
Redis throttle, stores a hashed 256-bit token with a TTL plus an audit row, and
enqueues the outbox event — one transaction. `PUT /api/auth/password/reset`
consumes the token, updates the password, revokes all sessions, audits, and waters
the user's access tokens after commit. Unknown email → 404, kept deliberately.

**Password change.** `PUT /api/auth/password/change` verifies the current
password, revokes **all** sessions (including the current one), and audits. The
watermark is written after commit as best-effort, so a Redis failure does not turn
a completed change into an error.

### Throttling

| Scope | Mechanism | Limit (default) |
| --- | --- | --- |
| Global (all routes) | Redis counter, **production only** | 300 req/min per IP (`RATE_LIMIT_GLOBAL_MAX`) |
| Authenticated routes | Redis counter, keyed by verified `uid` | 120 req/min per user (`RATE_LIMIT_USER_MAX`) |
| `POST /api/auth/login` | Redis counter (IP) + per-account failure counter | 20 req/min per IP (`RATE_LIMIT_AUTH_MAX`); after `AUTH_LOGIN_MAX_ATTEMPTS` failures the account locks for `AUTH_LOGIN_LOCKOUT_TTL` → `AUTH_ACCOUNT_LOCKED` (429) |
| `POST /api/auth/register/complete` | Redis counter (IP) | 20 req/min per IP |
| `POST /api/auth/password/recover` | Redis counter (IP) + per-email throttle | 20 req/min per IP + 30 s per email |

All budgets reset on `RATE_LIMIT_WINDOW` (default `1m`) and count in Redis, so
they hold across replicas. IP-keyed limits guard request *volume*, not one
account: on a shared CGNAT address one IP can front many users, so they stay loose
and the per-email login lockout and recovery throttle carry the targeted
enforcement. Authenticated traffic is keyed by the verified uid, so users sharing
an address do not spend each other's budget. A limiter error fails open and is
logged — rate limiting is volume protection, not authorization.

Login runs a dummy bcrypt compare on unknown emails so timing does not reveal
whether an account exists, and counts failures by hashed email so unknown
addresses are counted the same way. A locked account is rejected before any bcrypt
work.

**Passwords and entropy** — bcrypt cost 12; inputs validate `min=8,max=72` bytes
(bcrypt truncates beyond 72); refresh, registration, and recovery tokens are 32
random bytes.

## Authorization (RBAC)

Role-based, code-defined, and in-memory — no permission tables to keep in sync.
Each entity declares its own role→permission table and registers it from its
`NewService` constructor.

- Roles: `admin`, `user`, `system` (background/worker actions). `users.role` has a
  SQL `CHECK` constraint as a backstop.
- Permissions use the `"<entity>.<verb>"` grammar (`user.update`,
  `auth.revoke-user-sessions`, …). The authoritative list is the registered tables
  in `internal/*/service.go`.
- Services enforce with `Require(ctx, perms...)` (must hold **all**) or
  `RequireSelfOr(ctx, userID, perm)` (self, else the permission check). The
  authenticator injects the actor (`UserID`, `Role`) and `SessionID`.
- `RoleUser` holds no permissions anywhere; a plain user reaches their own record
  only through `RequireSelfOr`.

`make permissions` regenerates `client/packages/schemas/src/permission.ts` by
replaying the real service registrations (not grepping). Without a `client/` tree
it prints the catalog to stdout; `-out <file>` writes elsewhere.

## API documentation

An OpenAPI spec is planned. Until then `cmd/api/server.go` is the source of truth
for mounted routes and `internal/transport/http/` for handler contracts. The
dashboard mirrors those contracts by hand, which is why both halves live in one
repository; nothing checks the two sides against each other yet — a generated
contract test is the intended next step.

All application routes are under `/api`. Authenticated routes accept the
`access_token` cookie or `Authorization: Bearer`. Request bodies are capped at
5 MB.

## Error handling

Services return typed `apperr` errors; handlers return them unchanged; the Fiber
`ErrorHandler` calls `ParseError`, which normalizes everything to:

```json
{ "error": { "message": "...", "details": null, "code": "..." } }
```

| Source | HTTP status |
| --- | --- |
| `KindValidation` | 422 |
| `KindNotFound` | 404 |
| `KindConflict` | 409 |
| `KindUnauthorized` | 401 |
| `KindForbidden` | 403 |
| `KindThrottled` | 429 |
| `*fiber.Error` 413 | 413 |
| `context.DeadlineExceeded` | 504 |
| `context.Canceled` | 499 |
| malformed JSON body | 400 |
| everything else | 500 |

`apperr.Error` is immutable-returning (`SetMessage`/`WithDetails` copy) and
comparable with `errors.Is` by `Kind` + `Code`. Handler-level sentinels (bad path
param, multipart, upload, rate limit) live in
`internal/transport/http/error.go` and `uploader.go`.

## Audit logging

`audit_logs` records user-initiated state changes for compliance and forensics.

- **Columns**: `actor_id` (NULL for system), `action`, `entity`, `entity_id`,
  `prev`/`next` JSONB, `meta` JSONB, `created_at`.
- **Enrichment**: `Entry.FillActorMeta` fills `actor_id` from the RBAC context and
  adds `request_id`, `ip_addr`, `user_agent`, `session_id`, `actor_role`. `ip_addr`
  honors `X-Forwarded-For` only when `TRUST_PROXY=true`.
- **Atomicity**: the row is written inside the same transaction as the change, so
  a committed action is never silently unaudited.
- **Coverage**: auth (`register`, `complete-registration`, `login`, `logout`,
  `change-password`, `reset-password`, `password-recovery-request`,
  `revoke-user-sessions`, `revoke-session`) and user (`update`, `delete`,
  `change-profile-picture`, `delete-profile-picture`).
- **Not audited**: refused attempts and refresh-token reuse — security *events*,
  not state changes; they are WARN logs so the unauthenticated login path takes no
  write.
- `GET /api/audit/` (requires `audit.read`) accepts `entity`, `actor`,
  `date`/`from`/`to`, `tz`, `sort`/`order`, `page`/`limit`, and echoes the applied
  query in `meta`. `actor` matches `actor_id` for a full UUID, otherwise the name
  with `ILIKE`. Dates are calendar dates read in `tz` (`from` inclusive, `to`
  covers its whole day); an unknown zone falls back to UTC and `meta` reports the
  zone used. `date` wins over `from`/`to`.

## Messaging and the worker

Email delivery is decoupled from HTTP response time with a **transactional
outbox**: the service writes the event inside the same transaction as the business
state, so a crash between commit and delivery cannot lose it.

```text
HTTP request
  └─ service Transact { business state + audit + INSERT outbox_messages }   (one commit)
                          │
                          ▼
     worker (~1s): FetchBatch (attempts < 5, ORDER BY seq) ─▶ handler ─▶ SMTP
                          │                                      └─ MarkDone (DELETE)
                          └─ failure ─▶ MarkFailed (attempts + 1, last_error)
```

Topics: `email.password_recovery` and `email.user_registration`, both produced by
`auth` and rendered by `worker.AuthWorker`. Delivery is **at-least-once**: a crash
after the SMTP send and before `MarkDone` resends one message, so handlers must be
idempotent (a duplicate email is fine, a lost one is not).

- **Retries**: a handler error increments `attempts` and writes `last_error`; the
  row is retried until `outbox.MaxAttempts` (5), then left in the table as a
  dead-letter record to inspect with SQL.
- **Ordering**: batches are read oldest-first by identity `seq`.
- **Bounded**: the SMTP send is capped at 10 s; `MarkDone`/`MarkFailed` run on
  `context.WithoutCancel` so bookkeeping survives shutdown.
- **Crash isolation**: the poll loop runs under the process signal context, so
  stopping the worker pauses delivery until restart.

Run it separately: `make dev:worker`.

## Observability and health

- **Metrics** (`pkg/metrics`, `app_` namespace): `app_info`, the RED pair
  (`app_request_total`, `app_request_duration`), `app_requests_in_flight`,
  request/response sizes, `app_errors_total{code}` (keyed by stable application
  error code, far more actionable than a flat 4xx/5xx rate), `app_panics_total`,
  and `app_db_pool_*` from a `pgxpool.Stat` collector. Labels use the matched route
  template, never the raw path, so cardinality stays bounded. The middleware
  resolves status **and** error code from a returned error (Fiber assigns the
  final status only after the chain unwinds) and re-panics after counting a
  recovered panic.
- **Exporter**: gated by `METRICS_ENABLED`, a separate Fiber app serves `/metrics`
  on `METRICS_PORT` (default `APP_PORT + 1`; compose pins `9091`). The API binds
  every interface on `APP_PORT`; what is reachable is decided solely by the compose
  `ports:` mapping — only Caddy publishes. The sidecar is excluded from graceful
  shutdown.
- **Health**: `GET /api/healthz` pings Postgres and Redis with a 2 s timeout;
  any failure returns 503 with a `dependencies` map. Because it doubles as a probe,
  a sustained dependency outage also fails liveness — split the endpoints if your
  platform restarts unhealthy instances.
- **Security headers**: `helmet` with deny-by-default CSP, `X-Frame-Options: DENY`,
  strict-origin-when-cross-origin referrer policy, restrictive permissions policy;
  HSTS in production, on secure requests only.
- **Graceful shutdown** (API): 5 s drain, then a 25 s server shutdown deadline.
- **Dashboards**: Prometheus scrape config and Grafana provisioning/dashboards in
  `deployment/`, wired by `compose.caddy.yml`.

## Database and migrations

PostgreSQL through `pgx` (`pgxpool`) with **raw SQL**. Goose migrations in
`migrations/` are **additive only**, one table per file (`registration_tokens`,
`users`, `sessions`, `password_recovery_tokens`, `audit_logs`,
`outbox_messages`).

- **Rollout order**: the outbox `INSERT` is on the auth critical path, so apply the
  outbox migration → deploy the worker → deploy the API. It is additive, so the old
  binary is unaffected, and the worker picks up pre-existing rows on its first tick.
- `users` has a partial unique index on `email` (`WHERE deleted_at IS NULL`) so a
  soft-deleted email can be reused; `role` and `gender` are `CHECK`-constrained.
- `sessions.user_id` cascades on user delete; `audit_logs.actor_id` is set NULL.
- Transactions run through `postgres.DB.Transact`: the `pgx.Tx` lives in the
  context and repositories fetch it with `db.GetConn(ctx)`, adding `FOR UPDATE` on
  transactional reads. Rollback/commit use `context.WithoutCancel` + a 5 s timeout,
  so a cancelled request cannot leave locks hanging or churn the pool.

```bash
make migration:create   # scaffold a goose SQL file
make migration:up       # apply pending
make migration:status   # current version
make migration:down     # roll back one
make migration:clear    # roll back all
```

These targets need the `goose` CLI and read `DB_*` from `.env`.

## Backups

Twice-daily `pg_dump -Fc` streamed by the `backup` sidecar to a private R2 bucket
(no local copy), with a 30-day retention window enforced by an R2 lifecycle rule.

Pipeline, retention, restore runbook and restore drill:
[`deployment/BACKUP.md`](./deployment/BACKUP.md).

## Testing

Unit tests only; they never touch a real database, Redis, or SMTP server.

- **Framework**: `testify` (`assert` for continuing checks, `require` for setup)
  with table-driven `TestService_<Method>` + `t.Run` subtests.
- **Mocks**: generated by `mockery` from `.mockery.yml` — entity-scoped in
  `internal/<entity>/mocks/`, shared infrastructure in `internal/testing/mocks/`.
  Run `mockery` after any interface change.
- **Fixture pattern**: `setupTestFixture(t)` builds every mock with `t` (an
  unexpected call fails the test), constructs the service, and registers
  `t.Cleanup` to assert expectations. Transactor expectations are registered
  inside `RunAndReturn`, before the closure runs.
- **Hermetic**: tests set what they need with `t.Setenv` and pass without a local
  `.env`.

```bash
make test          # go test -race -count=1 <Go source roots> -cover
make client:test   # vitest, dashboard only
```

## Development tooling

The `Makefile` is the entry point — read it for the exact commands. Targets group
into `dev` / `dev:worker`, `build` / `run`, `test`, `lint`, `tidy`, `cli` +
`permissions`, `migration:*`, and `client:*` (install, dev, lint, build, test).

Tools: **Air** for hot reload, **golangci-lint v2** for lint, **goose** for
migrations, **mockery** for mocks, **bun + Turborepo** for the client, Docker
Compose for the stack.

`make lint` and `make test` take their package paths from `GO_PACKAGES`
(`./cmd/... ./internal/... ./pkg/... ./config/...`) rather than `./...`, because
the module root also holds `client/` and `./...` would walk bun's symlinked
`node_modules`. Add a new top-level Go directory to that variable.

## Conventions

- **Contract changes ship with the client.** A shape, field name, or error code is
  half a change until `client/packages/schemas` and `client/packages/api` match it.
- **Import aliases are fixed**: `redisInfra`, `strs`, `sharedMocks`.
  `internal/transport/http` is `package http` and imported unaliased.
- **Naming**: short lowercase single-word packages, `snake_case` files,
  `New<Name>()` constructors, `Err`-prefixed sentinels, PascalCase constants.
- **Documentation**: every package has a package-level godoc comment and every
  exported symbol a doc comment.
- **Interfaces are consumer-side and narrow**; implementations live in
  `internal/infrastructure/`.
- **Adding a feature**: model + interface → repository → service → handler → wire
  in `container.go` and routes in `server.go` → migration → `.mockery.yml` +
  `mockery` → tests.
- **Errors bubble up unchanged**; log only where it adds context.
- **Multi-step writes** use `Transactor.Transact`; outbox events go inside the
  closure (they commit with the state), while post-commit side effects such as
  storage cleanup and token revocation run outside it.

Project-specific skills under `.agents/skills/` (architecture, errors, handlers,
repositories, services, testing) encode these rules in more detail.

## License

MIT — see [`LICENSE`](LICENSE). Copyright (c) 2024 Adil Prawirdani.
