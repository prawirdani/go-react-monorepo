package log

import (
	"context"
	"testing"
)

// spyLogger records whether Error was called. Only the methods the test needs
// do anything; the rest satisfy the Logger interface.
type spyLogger struct {
	errCalled bool
	errMsg    string
}

func (s *spyLogger) Debug(string, ...any) {}
func (s *spyLogger) Info(string, ...any)  {}
func (s *spyLogger) Warn(string, ...any)  {}
func (s *spyLogger) Error(msg string, _ error, _ ...any) {
	s.errCalled = true
	s.errMsg = msg
}
func (s *spyLogger) DebugCtx(context.Context, string, ...any)        {}
func (s *spyLogger) InfoCtx(context.Context, string, ...any)         {}
func (s *spyLogger) WarnCtx(context.Context, string, ...any)         {}
func (s *spyLogger) ErrorCtx(context.Context, string, error, ...any) {}
func (s *spyLogger) With(...any) Logger                              { return s }

func TestRecover_SwallowsPanicAndLogs(t *testing.T) {
	spy := &spyLogger{}

	// Recover must turn a panic into a normal return. If it rethrows, the
	// deferred fail below never runs and the test panics out.
	func() {
		defer func() {
			if p := recover(); p != nil {
				t.Fatalf("panic escaped Recover: %v", p)
			}
		}()
		func() {
			defer Recover(spy)
			panic("boom")
		}()
	}()

	if !spy.errCalled {
		t.Fatal("expected Error to be logged on panic")
	}
	if spy.errMsg != "recovered from panic" {
		t.Fatalf("unexpected log message: %q", spy.errMsg)
	}
}

func TestRecover_SilentOnCleanReturn(t *testing.T) {
	spy := &spyLogger{}

	func() {
		defer Recover(spy)
		// no panic
	}()

	if spy.errCalled {
		t.Fatal("Recover logged on a clean return")
	}
}

func TestRecover_NilLoggerFallsBackToGlobal(t *testing.T) {
	// A nil logger must not itself panic; it falls back to the global logger.
	func() {
		defer func() {
			if p := recover(); p != nil {
				t.Fatalf("nil-logger path panicked: %v", p)
			}
		}()
		func() {
			defer Recover(nil)
			panic("boom")
		}()
	}()
}
