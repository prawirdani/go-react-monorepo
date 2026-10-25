# AGENTS.md

> The **Go half** of a merged repo. The dashboard it serves is the bun + Turborepo
> monorepo in `client/` - see the root `AGENTS.md` for the repo layout, the
> `make client:*` bridge and the contract rule (shape or error-code changes ship
> both halves in one commit).

Go RESTful API. Clean architecture (Handler -> Service -> Repository) with JWT
auth, PostgreSQL, a transactional outbox, Cloudflare R2, and Prometheus.

Paths below are relative to `backend/`. `make` targets run from the repo root.

## Stack

- **Module**: `github.com/prawirdani/go-react-monorepo` (Go 1.26.5)
- **Router**: gofiber/fiber/v3 (v3.5.0)
- **DB**: PostgreSQL via pgx v5 - raw SQL, no ORM (goose migrations)
- **MQ/Cache**: PostgreSQL transactional outbox (async email) + Redis (throttle/revocation)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Testing**: testify + mockery (unit tests only)

## Commands

```bash
make dev            # API server, hot-reload (Air, run from backend/)
make dev:worker     # Worker, hot-reload
make build          # Build binaries (api + worker, CGO_ENABLED=0, linux)
make test           # go test -race -count=1 on GO_PACKAGES -cover
make lint           # golangci-lint run
make migration:create  # Scaffold a goose migration
make migration:up      # Apply migrations
make cli               # Developer CLI (`permissions`, `create-admin`), e.g. `make cli ARGS="create-admin"`
make permissions       # Regenerate the client's permission catalog
mockery             # Regenerate mocks (reads .mockery.yml)
```

Go commands in the Makefile carry `-C backend`, so run them from the repo root.

## Layout

```
cmd/api/                 # API entrypoint: main.go, server.go (routes), container.go (DI)
cmd/worker/              # Background entrypoint: outbox poll worker
cmd/cli/                 # Developer CLI (subcommands: permissions, ...)
config/                  # Env-based config (App, Postgres, Redis, Auth, CORS, SMTP, R2)
internal/
  auth/                  # Auth business logic - JWT, sessions, password recovery, crypto
  user/                  # User business logic - CRUD, profile picture
  apperr/                # Application error kernel: Error, Kind, constructors, translation helpers
  rbac/                  # Role/permission authorization (code-defined, in-memory)
  audit/                 # Audit recording (prev/next JSONB + request metadata)
  ports/                 # Interfaces (ports) that infrastructure implements
    outbox/              #   transactional outbox (Message, Writer, Store)
    repository/          #   Transactor (atomic multi-repository writes)
    storage/             #   object storage (file, storage)
    throttle/            #   request throttling (Throttler, Result)
  infrastructure/
    postgres/            # pgx repository implementations (incl. outbox repo + auth event producer)
    r2/                  # R2 storage
    redis/               # throttle + revocation store
  transport/http/        # Fiber handlers, middleware, error normalization, router
  worker/                # outbox poll worker + auth email rendering/sending
pkg/                     # log, mailer, metrics, nullable, strings, validator
migrations/              # Goose SQL migrations
```

## Architecture

- **Onion/Clean**: interfaces live in `auth/`/`user/`, implementations in `infrastructure/`. Entity packages import no infrastructure.
- **Dependency inversion**: services depend on interfaces (`user.Repository`, `auth.Repository`, `storage.Storage`, `repository.Transactor`).
- **DI**: `cmd/api/container.go` wires everything manually - no framework.
- Handler (HTTP only) -> Service (business logic) -> Repository (data access).

## Conventions

**Naming** - Packages short/lowercase/single-word (`auth`, `postgres`); files snake_case; constructors `New<Name>()`; errors `Err`-prefixed; constants PascalCase. Import aliases `redisInfra` (infrastructure/redis), `strs` (pkg/strings), `sharedMocks` (internal/testing/mocks); `internal/transport/http` is `package http` and is imported unaliased. Add package-level godoc to every new package/entity. Detail: `backend-architecture`.

**Handlers** - signature `func(c fiber.Ctx) error`, mounted through a `Routes` method called from `setupHandlers`. Return errors; never write error responses manually. Respond with the `Body` envelope **by value** - it is sparse (`data`/`message` use `omitempty`, `meta` uses `omitzero`) and has no custom `MarshalJSON`. Detail: `backend-handlers`.

**Errors** - `apperr.Error` with `Kind` (`KindValidation`, `KindNotFound`, `KindConflict`, `KindUnauthorized`, `KindForbidden`, `KindThrottled`). Immutable (`WithDetails`/`SetMessage` return copies), supports `errors.Is`. `http.ParseError`, run by the Fiber `ErrorHandler`, maps kinds to HTTP status - and wraps the result in an `{"error": {...}}` envelope. Detail: `backend-errors`.

**Transactions** - wrap multi-step writes in `s.transactor.Transact`. Repositories detect the tx via `db.GetConn(ctx)` and reuse the connection (adding `FOR UPDATE`). Rollback/commit run on `context.WithoutCancel(ctx)` with a 5s timeout so a cancelled request ctx doesn't destroy the pooled connection. Detail: `backend-services`.

**Auth invariants**
- Registration is invitation-based: `Register` stores a single-use hashed token (no user row) and revokes any prior tokens for that email; `CompleteRegistration` consumes the token and creates the user atomically. A used, expired, or revoked token → `ErrInvalidRegistrationToken` (401). Hash the password only after the token validates. Under `APP_INTERNAL_MODE`, `Register` requires `PermRegisterUser`.
- Password reset/change revokes **all** sessions for the user (inside the tx).
- Unknown-email login path runs a dummy bcrypt compare (`DummyVerify`) - never branch on user existence via timing.
- Login lockout (`ErrAccountLocked`, `AUTH_ACCOUNT_LOCKED`) counts failures per email in Redis and blocks login only - it deliberately does **not** revoke active sessions, or an attacker could force-logout a victim by guessing wrong passwords.
- Refresh attempts against a revoked session → `log.WarnCtx` reuse signal, then `ErrSessionInvalid`.
- One-time tokens (registration, password recovery) are read from a request **body** (`POST /api/auth/register/token`, `POST /api/auth/password/recover/token`), never from the path: the access log records the path, so a token in a URL is a credential in the logs.
- Passwords: bcrypt cost 12, `min=8,max=72` validation (bcrypt truncates >72 bytes). User agent is cut to `sessions.user_agent`'s 255 bytes; email/name lengths are validated to the column widths (`email max=254`, `name max=100`).
- Cookies: `HttpOnly` always on; `Secure` production-only.

**Worker/outbox** - events go through the transactional outbox: `Produce*` writes `outbox_messages` on the caller's connection (called inside `Transact`, so it commits with the business state). `cmd/worker` polls the table (`outbox.Store.FetchBatch`, oldest first, up to `outbox.MaxAttempts` = 5), dispatches by topic to a `worker.Handler`, and deletes the row with `MarkDone` after a successful send; a handler error records `attempts + 1` and `last_error` via `MarkFailed` and retries on a later tick. Delivery is at-least-once, so handlers must be idempotent (a duplicate email is fine, a lost one is not). `MarkDone`/`MarkFailed` use `context.WithoutCancel`. SMTP send bounded at 10s; keep any new blocking op bounded too. The worker must stay at one replica - `FetchBatch` has no `FOR UPDATE SKIP LOCKED`.

**Housekeeping** - the same process runs `worker.Janitor` hourly (detached goroutine, `defer log.Recover`), calling `postgres.Maintenance.Cleanup`, which deletes expired sessions and one-time tokens older than 7 days and dead-lettered outbox rows older than 30 days, bounded by `cleanupTimeout`. Add new table retention there, not as an ad-hoc job; `audit_logs` is deliberately exempt until it gets its own retention decision.

**Async goroutines** - a detached goroutine (one that outlives the request ctx) has no recover middleware above it, so a panic there kills the process. Start it with `defer log.Recover(logger)` as the first line.

**Testing** - table-driven with `t.Run` subtests. `setupTestFixture(t)` wires mocks + service and registers `t.Cleanup()`. Mocks: entity-scoped in `internal/<entity>/mocks/`, reusable in `internal/testing/mocks/`. Detail: `backend-testing`.

**Logging** - structured/context-aware via `pkg/log`. Set at startup: `log.SetLogger(log.NewZerologAdapter(cfg.IsProduction()))`. Request-scoped fields (request_id, uid/sid) flow through context. Debug in dev, Info in prod.

**Config** - `.env` at the repo root (see `.env.example`), loaded once via `config.LoadConfig()`; it falls back to `../.env` so a run from `backend/` still finds it. `Validate()` fails startup on: `AUTH_JWT_SECRET` < 32 chars, `DB_MAXCONNS` ≤ 0, CORS credentials with `*`/invalid origins. Add new required settings to validation.

## Custom Skills

Project-specific skills live in the **repo root** `.agents/skills/` (they auto-trigger; a nested `backend/.agents/skills/` would not be discovered from a root session):

- **backend-architecture** - layering, dependency direction, interfaces, DI wiring, aliases, naming
- **backend-errors** - apperr error constructors/kinds, immutable copies, repo error translation
- **backend-handlers** - fiber.Ctx handler signature, BindValidateJSON, sparse `Body` envelope, cookies, multipart
- **backend-repositories** - pgx + `Select` builders, pgxscan, tx-aware GetConn/FOR UPDATE, error mapping
- **backend-services** - Transact, audit-in-tx, post-commit side effects, per-domain permissions, nullable+Validate, async cleanup
- **backend-testing** - mockery placement, setupTestFixture, transactor expectations, subtests, config independence

These supersede generic samber guidance where they overlap.

Two installed `golang-*` skills still disagree with this repo. The repo wins:

- Migrations are **goose** (`make migration:create` / `make migration:up`), not golang-migrate, Flyway, or Atlas.
- Logging is **zerolog** behind `pkg/log`. Do not migrate to `log/slog`.

Most of the upstream `golang-*` library was pruned: it restated what the code and `backend/AGENTS.md` already say, or disagreed with this repo. Only `golang-testing` and `golang-stretchr-testify` remain, both tracked by `skills-lock.json`; the `backend-*` ones are hand-authored here and have no lock entry. Re-adding a pruned skill is one command, since the lock keeps source and hash.

## Adding a Feature

1. Define model + service interface in `internal/<entity>/` (with godoc).
2. Implement repository in `internal/infrastructure/postgres/`.
3. Add service implementation in `internal/<entity>/`.
4. Add handler in `internal/transport/http/` (with a `Routes` method).
5. Wire in `cmd/api/container.go`; register routes in `cmd/api/server.go` (`setupHandlers`).
6. Add migration via `make migration:create`.
7. Update `.mockery.yml` for new interfaces, run `mockery`.
8. Write unit tests alongside source; verify with `make lint && make test`.
9. If a request/response shape or error code changed, update `client/packages/schemas` and `client/packages/api` in the same commit.
