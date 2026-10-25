# Golang + React Monorepo Template

One repo, two toolchains, one deployment: a Go REST API and the bun +
Turborepo dashboard it serves, deployed together with Docker Compose.

| Half | Stack |
| --- | --- |
| Backend | Go 1.26, Fiber v3, pgx/PostgreSQL, Redis, transactional outbox, Cloudflare R2 |
| Client | React 19, Vite, TanStack Router/Query, Tailwind, bun + Turborepo |
| Deploy | Compose, Caddy, Prometheus + Grafana, R2 backups |

## Documentation

| Doc | What it covers |
| --- | --- |
| [`backend/README.md`](./backend/README.md) | API reference: architecture, auth and sessions, RBAC, errors, audit, outbox worker, observability, migrations, testing |
| [`client/README.md`](./client/README.md) | Dashboard: stack, structure, session model, design system, i18n, backend compatibility |
| [`deployment/DEPLOYMENT.md`](./deployment/DEPLOYMENT.md) | Step-by-step single-host deploy: TLS, production flip, public surface, Cloudflare |
| [`deployment/BACKUP.md`](./deployment/BACKUP.md) | Postgres-to-R2 backup pipeline and restore runbook |
| [`AGENTS.md`](./AGENTS.md) | Repo map for AI agents, plus [`backend/`](./backend/AGENTS.md) and [`client/`](./client/AGENTS.md) guides |

## Project layout

```text
backend/               the Go module (clean architecture API + worker + CLI)
  cmd/
    api/               HTTP server entrypoint (Fiber)
      main.go          config, postgres, redis, graceful shutdown
      container.go     manual DI wiring
      server.go        middleware chain, routes, health, metrics exporter
    worker/            background entrypoint (polls the outbox)
    cli/               developer CLI (`permissions`, `create-admin`)

  config/              env-based config structs, parsed and validated at startup

  internal/
    apperr/            typed error kernel: Kind, Error, constructors
    audit/             audit Entry, request context, Recorder/Reader, service
    auth/              access tokens, sessions, crypto, models, service
    user/              user model, service, repository interface, search DSL
    rbac/              roles, permissions, authorizer, actor context
    ports/             interfaces implemented by infrastructure
      outbox/ repository/ revocation/ storage/ throttle/
    infrastructure/
      postgres/        pgx pool, transaction wrapper, query builder, repositories
      redis/           throttle + revocation store
      r2/              Cloudflare R2 storage (S3 API)
    transport/http/    Fiber handlers, middleware, error normalization, router
    worker/            outbox poll worker + AuthWorker (renders and sends email)
    testing/mocks/     shared infrastructure mocks

  pkg/                 framework-agnostic helpers (log, mailer, metrics,
                       nullable, strings, validator)

  migrations/          goose SQL migrations (additive only)
  Dockerfile           multi-stage build (distroless runtime)
  .air.toml .air.worker.toml   Air configs (run from backend/)
  AGENTS.md            conventions for the Go half

deployment/            caddy/ prometheus/ grafana/ backup/ + runbooks
go.work                workspace pointing at backend/, so gopls works at the root
compose.yml            full stack: the API tier + caddy, prometheus, grafana
compose.minimal.yml    bare API: api, worker, migrate, postgres, redis, backup
Makefile               dev/build/test/lint/migration/cli/client targets
                       (runs Go with -C backend)

client/                the dashboard: bun + Turborepo monorepo
  apps/dashboard/      Vite + React 19 app
  packages/            api, schemas (zod), queries, ui, utils, i18n, config
  AGENTS.md            conventions for working in the client half
```

## Getting started

**Prerequisites:** Go `1.26.5`+, PostgreSQL and Redis (`compose.yml` provides
both), the [goose](https://github.com/pressly/goose) CLI for `make migration:*`,
optional Air and `golangci-lint` v2, and bun 1.4 for the dashboard.

**1. Start the stack.** `compose.yml` is self-contained (Postgres, Redis, API,
worker, Caddy, Prometheus, Grafana on one bridge network). `compose.minimal.yml`
is the bare API for fronting with your own proxy.

```bash
docker compose up -d                          # full stack
docker compose -f compose.minimal.yml up -d   # bare API
```

Every service loads `.env` via `env_file:`, so credentials live in one place;
`api` and `worker` override `DB_HOST`/`REDIS_HOST` so `DB_HOST=localhost` keeps
working for bare-metal `make dev`. That also means **every container, Caddy
included, receives the whole file, secrets and all** - the deliberate trade-off
for a single source of credentials. Narrow it by dropping `env_file:` from a
service and listing only what it needs under `environment:`. Caddy serves the API
on `:8080`, Grafana on `:3000` (`GRAFANA_ADMIN_USER`/`_PASSWORD`, default
`admin`); Prometheus and the datastores stay internal. Postgres and Redis data
live in named volumes - `docker compose down -v` resets them.

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

**4. Run the API and the worker** - separate processes:

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
stays empty locally - same origin, no CORS. In production Caddy builds and serves
the dashboard at `/srv`, so a frontend change needs a rebuild of the caddy image.

## License

MIT - see [`LICENSE`](LICENSE). Copyright (c) 2024 Adil Prawirdani.
