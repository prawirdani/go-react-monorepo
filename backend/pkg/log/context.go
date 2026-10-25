package log

import (
	"context"
)

type ctxKey struct{}

var loggerKey ctxKey

// GetFromContext retrieves the logger from context, or returns default logger
func GetFromContext(ctx context.Context) Logger {
	if ctx == nil {
		return global
	}

	if logger, ok := ctx.Value(loggerKey).(Logger); ok {
		return logger
	}

	return global
}

// WithContext stores a logger with additional attributes in context
func WithContext(ctx context.Context, args ...any) context.Context {
	logger := GetFromContext(ctx).With(args...)
	return context.WithValue(ctx, loggerKey, logger)
}
