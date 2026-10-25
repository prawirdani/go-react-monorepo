package main

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/pressly/goose/v3"

	"github.com/prawirdani/go-react-monorepo/config"
	"github.com/prawirdani/go-react-monorepo/migrations"
)

// defaultMigrationsDir is where `--migrate create` writes new files.
const defaultMigrationsDir = "migrations"

// embeddedMigrationDir is the root of the embedded FS the database verbs read.
const embeddedMigrationDir = "."

// runMigrate applies goose migrations. Verbs are `up` (the default), `status`,
// `down [n]` and `create <name>`. The database verbs read the embedded SQL, so
// they need no checkout; create is the only verb that writes to the OS
// filesystem. Down refuses to run without --yes.
func runMigrate(ctx context.Context, args []string) error {
	dir := defaultMigrationsDir
	yes := false

	var pos []string
	for i := 0; i < len(args); i++ {
		switch {
		case args[i] == "--yes":
			yes = true
		case args[i] == "--dir":
			if i+1 >= len(args) {
				return usagef("flag %q needs a value", args[i])
			}
			i++
			dir = args[i]
		case strings.HasPrefix(args[i], "--dir="):
			dir = strings.TrimPrefix(args[i], "--dir=")
		default:
			pos = append(pos, args[i])
		}
	}

	verb := "up"
	if len(pos) > 0 {
		verb, pos = pos[0], pos[1:]
	}

	// Validate the verb before touching the config or the database, so a typo
	// fails fast and needs no reachable Postgres.
	steps := 1
	switch verb {
	case "create":
		if len(pos) != 1 {
			return usagef("usage: --migrate create <name> [--dir %s]", defaultMigrationsDir)
		}
		if err := goose.Create(nil, dir, pos[0], "sql"); err != nil {
			return fmt.Errorf("create migration: %w", err)
		}
		return nil
	case "up", "status":
	case "down":
		if !yes {
			return errors.New(`refusing to roll back without --yes: rerun as "--migrate down <n> --yes"`)
		}
		if len(pos) > 1 {
			return usagef("usage: --migrate down [n] --yes")
		}
		if len(pos) == 1 {
			n, err := strconv.Atoi(pos[0])
			if err != nil || n < 1 {
				return usagef("invalid rollback count %q", pos[0])
			}
			steps = n
		}
	default:
		return usagef("unknown migrate verb %q", verb)
	}

	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	db, err := openSQL(ctx, cfg.Postgres)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set goose dialect: %w", err)
	}
	goose.SetBaseFS(migrations.FS)

	switch verb {
	case "up":
		if err := goose.UpContext(ctx, db, embeddedMigrationDir); err != nil {
			return fmt.Errorf("migrate up: %w", err)
		}
		return nil
	case "status":
		if err := goose.StatusContext(ctx, db, embeddedMigrationDir); err != nil {
			return fmt.Errorf("migration status: %w", err)
		}
		return nil
	default: // down
		for range steps {
			if err := goose.DownContext(ctx, db, embeddedMigrationDir); err != nil {
				return fmt.Errorf("migrate down: %w", err)
			}
		}
		return nil
	}
}
