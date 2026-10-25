package main

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" database/sql driver
	"github.com/redis/go-redis/v9"

	"github.com/prawirdani/go-react-monorepo/config"
)

// pingTimeout bounds the openSQL liveness check. A CLI must not hang on an
// unreachable database.
const pingTimeout = 5 * time.Second

// dsn builds the same URL postgres.newDB uses, for database/sql.
func dsn(pg config.Postgres) string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%v/%s",
		pg.User,
		pg.Password,
		pg.Host,
		pg.Port,
		pg.Name,
	)
}

// openSQL opens a database/sql handle on the pgx driver and pings it, so a
// caller learns about an unreachable database here instead of on the first
// query. The caller closes it.
func openSQL(ctx context.Context, pg config.Postgres) (*sql.DB, error) {
	db, err := sql.Open("pgx", dsn(pg))
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, pingTimeout)
	defer cancel()
	if err := db.PingContext(pingCtx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return db, nil
}

// openRedis builds the client with the same options cmd/api uses. It does not
// connect; the caller pings or uses it.
func openRedis(cfg config.Redis) *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%v", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       0, // use default DB
	})
}
