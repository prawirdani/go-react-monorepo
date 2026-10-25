# =========================
# Stage 1: Build
# =========================
FROM golang:1.26.5 AS builder

WORKDIR /app

# Copy go.mod and go.sum first (for caching dependencies)
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the binaries directly: the Makefile lives at the repo root and would not
# be in this build context, and it carries client targets this image never runs.
# CGO is off so every binary runs on the distroless runtime and on Alpine.
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -a -installsuffix cgo -o ./bin/api ./cmd/api/ \
 && CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -a -installsuffix cgo -o ./bin/worker ./cmd/worker/ \
 && CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -a -installsuffix cgo -o ./bin/cli ./cmd/cli/

# =========================
# Stage 2: CLI (migrations at start, then crond for backups)
# =========================
# Alpine, because the container shells out to pg_dump and runs busybox crond;
# busybox already provides crond, so only the client and CA roots are installed.
FROM alpine:3.23 AS cli

WORKDIR /app

# pg_dump must match the server's major (postgres:18.1 in compose), so pin the 18 client.
RUN apk add --no-cache postgresql18-client ca-certificates

COPY --from=builder /app/bin/cli .
COPY config/backup/entrypoint.sh /app/entrypoint.sh
COPY config/backup/crontab /etc/crontabs/root
RUN chmod 755 /app/entrypoint.sh

# With no args the entrypoint migrates, writes /app/.migrated, then starts crond;
# a command runs that instead.
ENTRYPOINT ["/app/entrypoint.sh"]

# =========================
# Stage 3: Minimal runtime image (default target)
# =========================
FROM gcr.io/distroless/base-debian12

WORKDIR /app

# Copy the binaries from the builder stage
COPY --from=builder /app/bin/api .
COPY --from=builder /app/bin/worker .

# No writable home needed: config comes from env, uploads go to R2.
USER nonroot

# Run the API by default; the compose `worker` service overrides this command
CMD ["./api"]
