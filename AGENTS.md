# AGENTS.md

Full-stack template: a Go REST API (`backend/`) and the bun + Turborepo dashboard
it serves (`client/`), deployed together with Docker Compose.

Two halves, each with its own guide. Read the one you are working in:

- **`backend/AGENTS.md`** - Go module: clean architecture, conventions, auth
  invariants, outbox/worker, testing, logging, config.
- **`client/AGENTS.md`** - dashboard: API layer, schemas, data access, forms,
  backend-contract rules, gotchas.

## Repository layout

```
backend/                 # Go module: cmd/, internal/, pkg/, config/, migrations/
client/                  # JS monorepo: apps/dashboard + packages/{api,schemas,queries,ui,utils,i18n,config}
deployment/              # caddy/, prometheus/, grafana/ + runbooks (DEPLOYMENT.md, BACKUP.md)
compose.yml              # full stack: the API tier + cli + caddy, prometheus, grafana
compose.minimal.yml      # bare API: api, worker, cli, postgres, redis
```

The Go module is `github.com/prawirdani/go-react-monorepo`; its source lives in
`backend/`, so `go` and `goose` paths in the Makefile carry `-C backend` /
`-d backend/migrations`. The compose build context for `api`/`worker` is
`./backend`.

A root `go.work` points at `backend/`, so `go` commands and gopls resolve the
module when the editor is opened at the repo root. Docker builds are unaffected:
the file sits outside `./backend`, the build context.

## Two toolchains

Turborepo only orchestrates packages that have a `package.json`, so the API is
*not* a turbo package and Go is *not* a turbo task. The `make` targets are the
bridge:

```bash
make dev / dev:worker   # Go server + worker, hot-reload (Air)
make test / lint        # Go tests, golangci-lint
make client:install     # bun install
make client:dev         # dashboard dev server (proxies /api)
make client:lint / client:build / client:test
make migration:create NAME=add_widget   # scaffold, then migration:up / :status / :down
make backup:run         # one off-schedule backup through the cli image
make cli / permissions  # developer CLI (interactive when run on a terminal)
```

Run the API and the dashboard in **separate terminals** (`make dev`,
`make client:dev`) - a combined recipe survives neither Ctrl-C nor a rebuild
loop cleanly, and each tool already watches its own tree.

## The contract rule

The client consumes this API's contract. When a request/response shape, a JSON
field name, or an error code changes, update `client/packages/schemas` and
`client/packages/api` **in the same commit**. That atomicity is the point of the
merged repo.

## Skills

All skills live in the root `.agents/skills/`: 6 hand-authored `backend-*`, 2
vendored `golang-*` (testing, stretchr-testify), and 4 client skills (shadcn,
tanstack-query, tanstack-router, webapp-testing). Opencode discovers a project's
skills by walking from the session directory **up** to the repo root, so root is
the only place that reaches every session - a nested `client/.agents/skills/`
would be invisible from the root. Do not re-add one.
