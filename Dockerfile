# =========================
# Stage 1: Build
# =========================
FROM golang:1.26.5 AS builder

RUN apt-get install -y make

WORKDIR /app

# Copy go.mod and go.sum first (for caching dependencies)
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build using Makefile
RUN make build

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
