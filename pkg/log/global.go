package log

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"runtime/debug"
)

// global is the package-level default logger instance.
// It defaults to a slog-based JSON logger that writes to os.Stdout.
//
// This instance is used by all global logging functions (e.g., Info(), Error())
// when no explicit logger or context-bound logger is available./ Default to slog
var global Logger = NewSlogAdapter(false)

// EmptyLog is log with io.Discard writer (no log output) for omitting logs on test files
var EmptyLog *SlogAdapter = &SlogAdapter{
	l: slog.New(slog.NewTextHandler(io.Discard, nil)),
}

// SetLogger replaces the global logger used by all package-level logging calls.
//
// Passing a nil logger will cause a panic. This function should typically be called
// once during application initialization to configure the desired logging backend
// (for example, a development pretty printer or a production JSON logger).
func SetLogger(l Logger) {
	if l == nil {
		panic("logger: SetLogger called with nil")
	}
	global = l
}

func Debug(msg string, args ...any)            { global.Debug(msg, args...) }
func Info(msg string, args ...any)             { global.Info(msg, args...) }
func Warn(msg string, args ...any)             { global.Warn(msg, args...) }
func Error(msg string, err error, args ...any) { global.Error(msg, err, args...) }

func DebugCtx(ctx context.Context, msg string, args ...any) { global.DebugCtx(ctx, msg, args...) }
func InfoCtx(ctx context.Context, msg string, args ...any)  { global.InfoCtx(ctx, msg, args...) }
func WarnCtx(ctx context.Context, msg string, args ...any)  { global.WarnCtx(ctx, msg, args...) }
func ErrorCtx(ctx context.Context, msg string, err error, args ...any) {
	global.ErrorCtx(ctx, msg, err, args...)
}

// Recover stops a panic from killing the process and logs it with its stack.
// Defer it as the first statement in any detached goroutine (one whose panic no
// request-recover middleware would catch):
//
//	go func() {
//		defer log.Recover(logger)
//		...
//	}()
//
// A nil logger falls back to the package global. It recovers only an actual
// panic, so a clean return logs nothing.
func Recover(logger Logger) {
	p := recover()
	if p == nil {
		return
	}
	if logger == nil {
		logger = global
	}
	logger.Error("recovered from panic", fmt.Errorf("panic: %v", p), "stack", string(debug.Stack()))
}

// group represents a nested log object.
// Adapters decide how to render it.
type group struct {
	Key   string
	Attrs []any
}

// Group creates a nested log group.
func Group(key string, attrs ...any) group {
	return group{Key: key, Attrs: attrs}
}
