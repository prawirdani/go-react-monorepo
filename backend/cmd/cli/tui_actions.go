package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/pressly/goose/v3"

	"github.com/prawirdani/go-react-monorepo/config"
	"github.com/prawirdani/go-react-monorepo/internal/rbac"
	"github.com/prawirdani/go-react-monorepo/migrations"
)

const (
	// actionTimeout bounds the quick TUI actions (status, pings, lists).
	actionTimeout = 10 * time.Second

	// migrationTimeout bounds a schema run. A migration can legitimately outlive
	// actionTimeout on a large table, so it gets its own, still finite, bound.
	migrationTimeout = 2 * time.Minute

	// missingMigrationName marks an applied version with no file in this build.
	missingMigrationName = "(not in this build)"
)

// MigrationRow is one goose migration, embedded in the binary or already
// applied to the database.
type MigrationRow struct {
	Version   int64
	Name      string
	Applied   bool
	AppliedAt time.Time
}

// AdminRow is one admin account shown read-only by the TUI.
type AdminRow struct {
	Name      string
	Email     string
	CreatedAt time.Time
}

// Check is one diagnostic result.
type Check struct {
	Name   string
	OK     bool
	Detail string
}

// migrationStatuses reads the embedded migrations and the applied versions.
// Applied versions missing from this build are included, named
// missingMigrationName, so the UI can show that the database is ahead.
func migrationStatuses(ctx context.Context, cfg *config.Config) ([]MigrationRow, error) {
	if cfg == nil {
		return nil, errors.New("config is not loaded")
	}
	db, err := openSQL(ctx, cfg.Postgres)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(ctx, actionTimeout)
	defer cancel()

	if err := goose.SetDialect("postgres"); err != nil {
		return nil, fmt.Errorf("set goose dialect: %w", err)
	}
	goose.SetBaseFS(migrations.FS)

	embedded, err := goose.CollectMigrations(embeddedMigrationDir, 0, math.MaxInt64)
	if err != nil && !errors.Is(err, goose.ErrNoMigrationFiles) {
		return nil, fmt.Errorf("collect migrations: %w", err)
	}

	applied, err := appliedVersions(ctx, db)
	if err != nil {
		return nil, err
	}

	rows := make([]MigrationRow, 0, len(embedded)+len(applied))
	seen := make(map[int64]struct{}, len(embedded))
	for _, m := range embedded {
		row := MigrationRow{Version: m.Version, Name: filepath.Base(m.Source)}
		if at, ok := applied[m.Version]; ok {
			row.Applied = true
			row.AppliedAt = at
		}
		seen[m.Version] = struct{}{}
		rows = append(rows, row)
	}

	var missing []int64
	for version := range applied {
		if _, ok := seen[version]; !ok {
			missing = append(missing, version)
		}
	}
	sort.Slice(missing, func(i, j int) bool { return missing[i] < missing[j] })
	for _, version := range missing {
		rows = append(rows, MigrationRow{
			Version:   version,
			Name:      missingMigrationName,
			Applied:   true,
			AppliedAt: applied[version],
		})
	}

	sort.Slice(rows, func(i, j int) bool { return rows[i].Version < rows[j].Version })
	return rows, nil
}

// appliedVersions returns the appliedAt time of each applied migration. A
// missing version table means nothing has been applied yet.
func appliedVersions(ctx context.Context, db *sql.DB) (map[int64]time.Time, error) {
	var exists bool
	if err := db.QueryRowContext(ctx, "SELECT to_regclass($1) IS NOT NULL", goose.TableName()).Scan(&exists); err != nil {
		return nil, fmt.Errorf("check migration table: %w", err)
	}
	applied := make(map[int64]time.Time)
	if !exists {
		return applied, nil
	}

	rows, err := db.QueryContext(
		ctx,
		"SELECT version_id, is_applied, tstamp FROM goose_db_version ORDER BY id DESC",
	)
	if err != nil {
		return nil, fmt.Errorf("list applied migrations: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			version   int64
			isApplied bool
			at        time.Time
		)
		if err := rows.Scan(&version, &isApplied, &at); err != nil {
			return nil, fmt.Errorf("scan applied migration: %w", err)
		}
		// Ordered newest first, so the first row per version is the latest one.
		if _, ok := applied[version]; ok || !isApplied {
			continue
		}
		applied[version] = at
	}
	return applied, rows.Err()
}

// embedVersion is the highest migration version compiled into this binary.
func embedVersion() (int64, error) {
	goose.SetBaseFS(migrations.FS)
	embedded, err := goose.CollectMigrations(embeddedMigrationDir, 0, math.MaxInt64)
	if err != nil {
		if errors.Is(err, goose.ErrNoMigrationFiles) {
			return 0, nil
		}
		return 0, fmt.Errorf("collect migrations: %w", err)
	}

	var highest int64
	for _, m := range embedded {
		if m.Version > highest {
			highest = m.Version
		}
	}
	return highest, nil
}

// dbVersion is the highest applied migration version in the database. A missing
// version table reads as 0.
func dbVersion(ctx context.Context, cfg *config.Config) (int64, error) {
	if cfg == nil {
		return 0, errors.New("config is not loaded")
	}
	db, err := openSQL(ctx, cfg.Postgres)
	if err != nil {
		return 0, err
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(ctx, actionTimeout)
	defer cancel()

	applied, err := appliedVersions(ctx, db)
	if err != nil {
		return 0, err
	}

	var highest int64
	for version := range applied {
		if version > highest {
			highest = version
		}
	}
	return highest, nil
}

// runMigrations is the TUI's migrate path. verb is "up" or "down"; steps is the
// number of migrations to roll back. The TUI has already confirmed a down.
func runMigrations(ctx context.Context, cfg *config.Config, verb string, steps int) error {
	if cfg == nil {
		return errors.New("config is not loaded")
	}
	db, err := openSQL(ctx, cfg.Postgres)
	if err != nil {
		return err
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(ctx, migrationTimeout)
	defer cancel()

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
	case "down":
		for range steps {
			if err := goose.DownContext(ctx, db, embeddedMigrationDir); err != nil {
				return fmt.Errorf("migrate down: %w", err)
			}
		}
		return nil
	default:
		return fmt.Errorf("unknown migrate verb %q", verb)
	}
}

// createMigration scaffolds a goose migration in dir and returns its path.
func createMigration(name, dir string) (string, error) {
	if dir == "" {
		dir = defaultMigrationsDir
	}
	if _, err := os.Stat(dir); err != nil {
		return "", fmt.Errorf("migrations directory: %w", err)
	}

	before, err := os.ReadDir(dir)
	if err != nil {
		return "", fmt.Errorf("read %s: %w", dir, err)
	}
	existing := make(map[string]struct{}, len(before))
	for _, entry := range before {
		existing[entry.Name()] = struct{}{}
	}

	if err := goose.Create(nil, dir, name, "sql"); err != nil {
		return "", fmt.Errorf("create migration: %w", err)
	}

	after, err := os.ReadDir(dir)
	if err != nil {
		return "", fmt.Errorf("reread %s: %w", dir, err)
	}
	for _, entry := range after {
		if _, ok := existing[entry.Name()]; !ok {
			return filepath.Join(dir, entry.Name()), nil
		}
	}
	return filepath.Join(dir, name+".sql"), nil
}

// backupConfigFrom builds the backup options from the app config.
func backupConfigFrom(cfg *config.Config) backupConfig {
	if cfg == nil {
		return backupConfig{}
	}
	return backupConfig{
		DB:           cfg.Postgres,
		PublicBucket: cfg.R2.Bucket,
		Backup:       cfg.Backup,
	}
}

// validateBackupConfig is the offline check: bucket set, and never the public
// images bucket.
func validateBackupConfig(cfg *config.Config) error {
	if cfg == nil {
		return errors.New("config is not loaded")
	}
	return guardBackupConfig(backupConfigFrom(cfg))
}

// runBackupOnce dumps the database and returns the object key. progress may be
// nil; the engine keeps its own 2h bound.
func runBackupOnce(ctx context.Context, cfg *config.Config, progress func(string)) (string, error) {
	if cfg == nil {
		return "", errors.New("config is not loaded")
	}
	return runBackupEngine(ctx, backupConfigFrom(cfg), progress)
}

// listBackupObjects returns the newest n dump objects.
func listBackupObjects(ctx context.Context, cfg *config.Config, n int) ([]backupObject, error) {
	if cfg == nil {
		return nil, errors.New("config is not loaded")
	}
	ctx, cancel := context.WithTimeout(ctx, actionTimeout)
	defer cancel()
	return listBackups(ctx, backupConfigFrom(cfg), n)
}

// listAdmins returns the admin accounts, newest first.
func listAdmins(ctx context.Context, cfg *config.Config) ([]AdminRow, error) {
	if cfg == nil {
		return nil, errors.New("config is not loaded")
	}
	db, err := openSQL(ctx, cfg.Postgres)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(ctx, actionTimeout)
	defer cancel()

	rows, err := db.QueryContext(
		ctx,
		`SELECT name, email, created_at
		   FROM users
		  WHERE role = $1 AND deleted_at IS NULL
		  ORDER BY created_at DESC`,
		string(rbac.RoleAdmin),
	)
	if err != nil {
		return nil, fmt.Errorf("list admins: %w", err)
	}
	defer rows.Close()

	admins := make([]AdminRow, 0, 8)
	for rows.Next() {
		var a AdminRow
		if err := rows.Scan(&a.Name, &a.Email, &a.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan admin: %w", err)
		}
		admins = append(admins, a)
	}
	return admins, rows.Err()
}

// diagnose runs the five health checks the System screen shows. Every network
// call is bounded; a failure is data, not a returned error.
func diagnose(ctx context.Context, cfg *config.Config) []Check {
	checks := make([]Check, 0, 5)

	configCheck := Check{Name: "config"}
	if cfg == nil {
		configCheck.Detail = "config is not loaded"
	} else if err := cfg.Validate(); err != nil {
		configCheck.Detail = err.Error()
	} else {
		configCheck.OK = true
		configCheck.Detail = "valid"
	}
	checks = append(checks, configCheck)

	pgCheck := Check{Name: "postgres"}
	if cfg == nil {
		pgCheck.Detail = "config is not loaded"
	} else if db, err := openSQL(ctx, cfg.Postgres); err != nil {
		pgCheck.Detail = err.Error()
	} else {
		_ = db.Close()
		pgCheck.OK = true
		pgCheck.Detail = fmt.Sprintf("%s:%d/%s", cfg.Postgres.Host, cfg.Postgres.Port, cfg.Postgres.Name)
	}
	checks = append(checks, pgCheck)

	redisCheck := Check{Name: "redis"}
	if cfg == nil {
		redisCheck.Detail = "config is not loaded"
	} else {
		client := openRedis(cfg.Redis)
		pingCtx, cancel := context.WithTimeout(ctx, actionTimeout)
		err := client.Ping(pingCtx).Err()
		cancel()
		_ = client.Close()
		if err != nil {
			redisCheck.Detail = err.Error()
		} else {
			redisCheck.OK = true
			redisCheck.Detail = fmt.Sprintf("%s:%d", cfg.Redis.Host, cfg.Redis.Port)
		}
	}
	checks = append(checks, redisCheck)

	driftCheck := Check{Name: "migrations"}
	embedded, embedErr := embedVersion()
	if embedErr != nil {
		driftCheck.Detail = embedErr.Error()
	} else if applied, err := dbVersion(ctx, cfg); err != nil {
		driftCheck.Detail = err.Error()
	} else if embedded == applied {
		driftCheck.OK = true
		driftCheck.Detail = fmt.Sprintf("embedded and applied both at %d", embedded)
	} else {
		driftCheck.Detail = fmt.Sprintf("embedded at %d, applied at %d", embedded, applied)
	}
	checks = append(checks, driftCheck)

	backupCheck := Check{Name: "backup config"}
	if cfg == nil {
		backupCheck.Detail = "config is not loaded"
	} else if err := validateBackupConfig(cfg); err != nil {
		backupCheck.Detail = err.Error()
	} else {
		backupCheck.OK = true
		backupCheck.Detail = "bucket " + cfg.Backup.Bucket
	}
	checks = append(checks, backupCheck)

	return checks
}

// syncPermissions runs the existing permissions subcommand in a child process
// and returns its output, so the TUI shows exactly what the command printed.
func syncPermissions(ctx context.Context) (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("resolve executable: %w", err)
	}

	ctx, cancel := context.WithTimeout(ctx, actionTimeout)
	defer cancel()

	out, err := exec.CommandContext(ctx, exe, permissionsCmdName).CombinedOutput()
	text := strings.TrimSpace(string(out))
	if err != nil {
		if text != "" {
			return text, fmt.Errorf("%s: %w", permissionsCmdName, err)
		}
		return "", fmt.Errorf("%s: %w", permissionsCmdName, err)
	}
	return text, nil
}
