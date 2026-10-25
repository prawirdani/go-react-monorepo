# Load .env variables
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

# The Go module lives in ./backend; the root holds the client, the compose files
# and this Makefile (which bridges both toolchains). Go commands carry -C so
# targets stay runnable from the root.
GO_DIR = backend

# Go source roots, relative to $(GO_DIR). Listed explicitly rather than `./...`
# because the module sits beside `client/`: golangci-lint v2 has no skip-dirs
# knob, so the scope belongs on the command line. Add a new top-level Go dir here.
GO_PACKAGES = ./cmd/... ./internal/... ./pkg/... ./config/...


# Run the api server
dev:
	@cd $(GO_DIR) && air

# Run the message consumers
dev\:worker:
	@cd $(GO_DIR) && air -c .air.worker.toml

tidy:
	@go -C $(GO_DIR) mod tidy

lint:
	@cd $(GO_DIR) && golangci-lint run $(GO_PACKAGES)

test:
	@go -C $(GO_DIR) test -race -v -count=1 $(GO_PACKAGES) -cover

build:
	@echo "Building binaries..."
	CGO_ENABLED=0 GOOS=linux go -C $(GO_DIR) build -ldflags="-s -w" -a -installsuffix cgo -o ./bin/api ./cmd/api/
	CGO_ENABLED=0 GOOS=linux go -C $(GO_DIR) build -ldflags="-s -w" -a -installsuffix cgo -o ./bin/worker ./cmd/worker/
	@echo "Build completed successfully..."

run:
	./$(GO_DIR)/bin/api

# ---------------------------------------------------------------------------
# Client (the JS monorepo in ./client)
#
# Turborepo only orchestrates packages that have a package.json, so the API is
# not a turbo package and Go is not a turbo task: these targets are the bridge.
# ---------------------------------------------------------------------------

# Install client dependencies (bun).
client\:install:
	@cd client && bun install

client\:dev:
	@cd client && bun run dev

client\:lint:
	@cd client && bun run lint

client\:build:
	@cd client && bun run build

client\:test:
	@cd client && bun run test

# Developer CLI. Run `make cli` (or `go run ./cmd/cli help`) for subcommands.
cli:
	@go -C $(GO_DIR) run ./cmd/cli $(ARGS)

# Regenerate the client permission catalog from the backend's registrars.
permissions:
	@go -C $(GO_DIR) run ./cmd/cli permissions

# Migrations run through the project CLI (go -C backend), so no host goose
# binary is needed. The database verbs read the SQL embedded in the binary;
# create writes to the OS filesystem, and `go -C backend` runs it from backend/.
migration\:status:
	@go -C $(GO_DIR) run ./cmd/cli --migrate status

migration\:up:
	@go -C $(GO_DIR) run ./cmd/cli --migrate up

# One step back. The CLI refuses to roll back without --yes.
migration\:down:
	@go -C $(GO_DIR) run ./cmd/cli --migrate down --yes

# NAME=<name> is required, e.g. `make migration:create NAME=add_widget`.
migration\:create:
	@go -C $(GO_DIR) run ./cmd/cli --migrate create $(NAME) --dir migrations

# Run one backup now, off-schedule, in the already-running cli service.
backup\:run:
	@docker compose exec -T cli ./cli --backup

# Interactive TUI in the cli image. Needs a terminal: no -T, and --rm so the
# container goes away when you quit.
cli\:tui:
	@docker compose run --rm cli ./cli
