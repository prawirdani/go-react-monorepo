# Load .env variables
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

# Go source roots. Listed explicitly rather than `./...` because the module root
# also holds `client/`, the JS monorepo: `./...` walks it, and bun's symlinked
# node_modules would be walked too. golangci-lint v2 has no skip-dirs knob, so
# the scope belongs on the command line. Add a new top-level Go dir here.
GO_PACKAGES = ./cmd/... ./internal/... ./pkg/... ./config/...


# Run the api server
dev:
	@air -c .air.toml

# Run the message consumers
dev\:worker:
	@air -c .air.worker.toml

tidy:
	@go mod tidy

lint:	
	@golangci-lint run $(GO_PACKAGES)

test:
	@go test -race -v -count=1 $(GO_PACKAGES) -cover

build:
	@echo "Building binaries..."
	CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -a -installsuffix cgo -o ./bin/api ./cmd/api/
	CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -a -installsuffix cgo -o ./bin/worker ./cmd/worker/
	@echo "Build completed successfully..."

run:
	./bin/api

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
	@go run ./cmd/cli $(ARGS)

# Regenerate the client permission catalog from the backend's registrars.
permissions:
	@go run ./cmd/cli permissions

# Makesure you have goose binary installed
migration\:status:
	@goose -dir migrations postgres "host=$(DB_HOST) port=$(DB_PORT) user=$(DB_USER) password=$(DB_PASSWORD) dbname=$(DB_NAME) sslmode=disable" status

migration\:up:
	@goose -dir migrations postgres "host=$(DB_HOST) port=$(DB_PORT) user=$(DB_USER) password=$(DB_PASSWORD) dbname=$(DB_NAME) sslmode=disable" up

migration\:down:
	@goose -dir migrations postgres "host=$(DB_HOST) port=$(DB_PORT) user=$(DB_USER) password=$(DB_PASSWORD) dbname=$(DB_NAME) sslmode=disable" down

migration\:clear:
	@goose -dir migrations postgres "host=$(DB_HOST) port=$(DB_PORT) user=$(DB_USER) password=$(DB_PASSWORD) dbname=$(DB_NAME) sslmode=disable" down-to 0

migration\:create:
	@echo "Create Migration"
	@read -p "Enter migration name: " migration_name; \
	goose -s -dir migrations create $$migration_name sql
	@echo "Migration created successfully, fill in the schema in the generated file."
