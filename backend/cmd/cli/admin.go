package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/term"

	"github.com/prawirdani/go-react-monorepo/config"
	"github.com/prawirdani/go-react-monorepo/internal/auth"
	"github.com/prawirdani/go-react-monorepo/internal/infrastructure/postgres"
	"github.com/prawirdani/go-react-monorepo/internal/rbac"
	"github.com/prawirdani/go-react-monorepo/internal/user"
)

const createAdminCmdName = "create-admin"

var createAdminCmd = command{
	name:    createAdminCmdName,
	summary: "interactively create an admin user",
	run:     runCreateAdmin,
}

// runCreateAdmin prompts for a name, email and password, then inserts an
// admin user directly through the repository. It is the bootstrap path for the
// first admin, since registration is invitation-based and needs an existing
// admin under APP_INTERNAL_MODE. The password is read without echo and the
// email is verified on creation (no confirmation mail).
func runCreateAdmin(args []string) error {
	fs := flag.NewFlagSet(createAdminCmdName, flag.ContinueOnError)
	if err := fs.Parse(args); err != nil {
		return err
	}

	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	in := bufio.NewReader(os.Stdin)

	name, err := promptLine(in, "Name: ")
	if err != nil {
		return err
	}
	email, err := promptLine(in, "Email: ")
	if err != nil {
		return err
	}

	password, err := promptPassword("Password (min 8 chars): ")
	if err != nil {
		return err
	}
	confirm, err := promptPassword("Confirm password: ")
	if err != nil {
		return err
	}
	if password != confirm {
		return errors.New("passwords do not match")
	}

	if err := createAdminUser(context.Background(), cfg, name, email, password); err != nil {
		return err
	}

	fmt.Printf("created admin %s\n", email)
	return nil
}

// createAdminUser validates the credentials and inserts an admin user directly
// through the repository. The CLI prompt and the TUI both call it, so the two
// paths cannot drift. It blocks on the insert, bounded at 10s.
func createAdminUser(ctx context.Context, cfg *config.Config, name, email, password string) error {
	if cfg == nil {
		return errors.New("config is not loaded")
	}
	// bcrypt truncates past 72 bytes; mirror the auth model's min=8,max=72.
	if n := len(password); n < 8 || n > 72 {
		return fmt.Errorf("password must be 8-72 bytes, got %d", n)
	}

	hashed, err := auth.HashPassword(password)
	if err != nil {
		return fmt.Errorf("hash password: %w", err)
	}

	id, err := uuid.NewV7()
	if err != nil {
		return fmt.Errorf("generate id: %w", err)
	}
	u := &user.User{
		ID:       id,
		Name:     name,
		Email:    email,
		Password: string(hashed),
		Role:     rbac.RoleAdmin,
	}
	u.EmailVerifiedAt.Set(time.Now(), false)
	if err := u.Validate(); err != nil {
		return err
	}

	pg, err := postgres.New(cfg.Postgres)
	if err != nil {
		return fmt.Errorf("connect postgres: %w", err)
	}
	defer pg.Close()

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	return postgres.NewUserRepository(pg).Store(ctx, u)
}

// promptLine prints a prompt and reads one trimmed, non-empty line.
func promptLine(r *bufio.Reader, prompt string) (string, error) {
	fmt.Print(prompt)
	line, err := r.ReadString('\n')
	if err != nil {
		return "", err
	}
	line = strings.TrimSpace(line)
	if line == "" {
		return "", fmt.Errorf("%s value is required", strings.TrimSuffix(prompt, ": "))
	}
	return line, nil
}

// promptPassword reads a password from the terminal without echoing it. It
// requires a real TTY (os.Stdin), so piped input is rejected rather than read
// in the clear.
func promptPassword(prompt string) (string, error) {
	fd := int(os.Stdin.Fd())
	if !term.IsTerminal(fd) {
		return "", errors.New("password prompt requires an interactive terminal")
	}
	fmt.Print(prompt)
	b, err := term.ReadPassword(fd)
	fmt.Println()
	if err != nil {
		return "", fmt.Errorf("read password: %w", err)
	}
	return string(b), nil
}
