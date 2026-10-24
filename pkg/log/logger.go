package log

import (
	"context"
)

// Logger defines a structured, context-aware logging interface.
//
// It abstracts the behavior of modern structured loggers such as slog or zerolog,
// providing a consistent API for emitting logs at multiple levels, attaching contextual
// fields, and integrating with context.Context for per-request or per-operation logging.
//
// The logging methods accept a message string and a variadic list of key–value pairs
// (args ...any), which must alternate between string keys and values of any type.
//
// Implementations should ensure that the log output preserves both temporal and
// semantic fidelity - timestamps, caller metadata, and structured fields should
// remain intact across different backends.
//
// Available Levels:
//   - Debug - verbose diagnostic information.
//   - Info  - high-level application state changes.
//   - Warn  - non-fatal anomalies or recoverable errors.
//   - Error - unexpected failures or error states.
type Logger interface {
	// Basic logging methods (no context)
	Debug(msg string, args ...any)
	Info(msg string, args ...any)
	Warn(msg string, args ...any)
	Error(msg string, err error, args ...any)

	// Contextual logging methods
	DebugCtx(ctx context.Context, msg string, args ...any)
	InfoCtx(ctx context.Context, msg string, args ...any)
	WarnCtx(ctx context.Context, msg string, args ...any)
	ErrorCtx(ctx context.Context, msg string, err error, args ...any)

	// With returns a new Logger instance that includes the given key–value pairs
	// Use With() to attach persistent fields to a derived logger, preserving immutability.
	// For example, logger.With("component", "api") returns a new logger with that attribute
	// applied to all subsequent logs.
	With(args ...any) Logger
}
