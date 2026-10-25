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
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -a -installsuffix cgo -o ./bin/api ./cmd/api/ \
 && CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -a -installsuffix cgo -o ./bin/worker ./cmd/worker/

# =========================
# Stage 2: Minimal runtime image
# =========================
FROM gcr.io/distroless/base-debian12

WORKDIR /app

# Copy the binaries from the builder stage
COPY --from=builder /app/bin/api .
COPY --from=builder /app/bin/worker .

# Run the API by default; the compose `worker` service overrides this command
CMD ["./api"]
