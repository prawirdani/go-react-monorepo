// Command cli groups the project's developer utilities behind subcommands.
//
//	cli permissions [-out file]   regenerate the client permission catalog
//	cli create-admin              interactively create an admin user
//	cli --migrate <verb> [args]   run goose migrations (up, status, down, create)
//	cli --backup [list]           back up the database, or list existing backups
//	cli --help                    list available commands
//
// Run `cli --help` for the current command list.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"golang.org/x/term"

	"github.com/prawirdani/go-react-monorepo/config"
)

// backupCmdName is the flag and registry name for the backup command.
const backupCmdName = "backup"

// command is one CLI subcommand.
type command struct {
	name    string
	summary string
	run     func(args []string) error
}

// commands is the ordered subcommand registry (also the `help` listing order).
var commands = []command{
	permissionsCmd,
	createAdminCmd,
}

// usageError marks a dispatch failure that should exit with status 2.
type usageError struct {
	err error
}

func (e usageError) Error() string { return e.err.Error() }
func (e usageError) Unwrap() error { return e.err }

// usagef builds a usage error with a formatted message.
func usagef(format string, args ...any) error {
	return usageError{fmt.Errorf(format, args...)}
}

func main() {
	if err := dispatch(context.Background(), os.Args[1:]); err != nil {
		// --help is not an error.
		if errors.Is(err, flag.ErrHelp) {
			return
		}

		var usage usageError
		if errors.As(err, &usage) {
			printUsage(os.Stderr)
			fmt.Fprintln(os.Stderr, "error:", err)
			os.Exit(2)
		}

		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

// dispatch routes args to a flag, a legacy positional subcommand, or the
// interactive TUI. Flags accept both `--flag value` and `--flag=value`.
func dispatch(ctx context.Context, args []string) error {
	if len(args) > 0 {
		switch args[0] {
		case "help", "-h", "--help":
			printUsage(os.Stdout)
			return nil
		case "--version":
			printVersion()
			return nil
		}

		// Legacy positional subcommands keep their exact behaviour.
		for _, cmd := range commands {
			if cmd.name == args[0] {
				return cmd.run(args[1:])
			}
		}
	}

	// Only a bare invocation may open the interactive menu, and only from a
	// real terminal: a piped or CI run must never block on a menu.
	if len(args) == 0 {
		if !isInteractive() {
			return usagef("no command given")
		}
		return runTUI(ctx)
	}

	var (
		migrateSet  bool
		migrateArgs []string
		action      string
		actionArgs  []string
		dir         = defaultMigrationsDir
		dirSet      bool
		yes         bool
	)

	for i := 0; i < len(args); i++ {
		arg := args[i]
		name, inlineValue, inline := strings.Cut(arg, "=")

		switch name {
		case "--help", "-h":
			printUsage(os.Stdout)
			return nil
		case "--version":
			printVersion()
			return nil
		case "--create-admin":
			action = createAdminCmdName
		case "--permissions":
			action = permissionsCmdName
		case "--backup":
			action = backupCmdName
		case "--yes":
			yes = true
		case "--dir":
			v, err := flagValue(args, &i, inlineValue, inline)
			if err != nil {
				return err
			}
			dir, dirSet = v, true
		case "--migrate":
			v, err := flagValue(args, &i, inlineValue, inline)
			if err != nil {
				return err
			}
			migrateSet = true
			migrateArgs = append(migrateArgs, v)
		default:
			switch {
			case strings.HasPrefix(arg, "-"):
				return usagef("unknown flag %q", arg)
			case migrateSet:
				migrateArgs = append(migrateArgs, arg)
			default:
				actionArgs = append(actionArgs, arg)
			}
		}
	}

	if migrateSet {
		// `--dir` and `--yes` only mean something to the migrate verbs.
		if dirSet {
			migrateArgs = append(migrateArgs, "--dir", dir)
		}
		if yes {
			migrateArgs = append(migrateArgs, "--yes")
		}
		return runMigrate(ctx, migrateArgs)
	}

	switch action {
	case "":
		if len(actionArgs) > 0 {
			return usagef("unknown command %q", actionArgs[0])
		}
		return usagef("no command given")
	case createAdminCmdName:
		return createAdminCmd.run(actionArgs)
	case permissionsCmdName:
		return permissionsCmd.run(actionArgs)
	case backupCmdName:
		return runBackupCLI(ctx, actionArgs)
	}

	return usagef("unknown command %q", action)
}

// flagValue reads a flag's value, accepting `--flag=value` and `--flag value`.
func flagValue(args []string, i *int, inlineValue string, inline bool) (string, error) {
	if inline {
		return inlineValue, nil
	}
	if *i+1 >= len(args) {
		return "", usagef("flag %q needs a value", args[*i])
	}
	*i++
	return args[*i], nil
}

// isInteractive reports whether both stdin and stdout are terminals.
func isInteractive() bool {
	return term.IsTerminal(int(os.Stdin.Fd())) && term.IsTerminal(int(os.Stdout.Fd()))
}

// printVersion prints the app version, falling back to "dev" when unset. It
// reads the env directly instead of loading the whole config.
func printVersion() {
	var app config.App
	version := "dev"
	if err := app.Parse(); err == nil && app.Version != "" {
		version = app.Version
	}
	fmt.Println(version)
}

func printUsage(w io.Writer) {
	fmt.Fprintln(w, "usage: cli <command> [flags]")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "commands:")
	for _, cmd := range commands {
		fmt.Fprintf(w, "  %-14s %s\n", cmd.name, cmd.summary)
	}
	fmt.Fprintln(w)
	fmt.Fprintln(w, "flags:")
	fmt.Fprintf(w, "  %-14s %s\n", "--migrate", "run goose migrations: up (default), status, down [n], create <name>")
	fmt.Fprintf(w, "  %-14s %s\n", "--backup", "back up the database, or list backups with `--backup list`")
	fmt.Fprintf(w, "  %-14s %s\n", "--dir", "directory for `--migrate create` (default "+defaultMigrationsDir+")")
	fmt.Fprintf(w, "  %-14s %s\n", "--yes", "confirm `--migrate down`")
	fmt.Fprintf(w, "  %-14s %s\n", "--create-admin", "interactively create an admin user")
	fmt.Fprintf(w, "  %-14s %s\n", "--permissions", "regenerate the client permission catalog")
	fmt.Fprintf(w, "  %-14s %s\n", "--help", "print this help")
	fmt.Fprintf(w, "  %-14s %s\n", "--version", "print the version")
	fmt.Fprintln(w)
	fmt.Fprintln(w, "run with no arguments on a terminal for the interactive menu")
}
