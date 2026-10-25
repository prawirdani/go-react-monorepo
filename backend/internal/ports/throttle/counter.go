package throttle

import (
	"context"
	"time"
)

// Counter tracks a bounded number of failures for a key. Unlike [Throttler],
// which only knows whether a single slot is held, a Counter accumulates
// failures so a caller can lock a key out after a threshold.
//
// Implementations must be safe for concurrent use by multiple goroutines and,
// if backed by a shared store such as Redis, by multiple processes. A non-nil
// error means the state is unknown; callers should treat errors as fail-open,
// not as an allow or deny decision.
type Counter interface {
	// Count returns the current failure count for key and the remaining TTL of
	// its window. A ttl <= 0 means no expiry is left. A missing key returns 0,
	// a ttl of 0, and a nil error.
	Count(ctx context.Context, key string) (n int64, ttl time.Duration, err error)

	// Increment adds one failure to key and returns the new count plus the
	// remaining TTL. The TTL is set only on the first increment, so later
	// failures do not extend the window. A ttl <= 0 passed in is invalid and
	// returns an error.
	Increment(ctx context.Context, key string, ttl time.Duration) (n int64, remaining time.Duration, err error)

	// Reset clears the counter for key, so the next Count returns 0.
	Reset(ctx context.Context, key string) error
}
