package redis

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestThrottler returns a Throttler backed by an in-process Redis.
func newTestThrottler(t *testing.T) (*Throttler, *miniredis.Miniredis) {
	t.Helper()

	mr := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = client.Close() })

	return NewThrottler(client), mr
}

func TestThrottlerTryAcquireFirstAllows(t *testing.T) {
	throttler, _ := newTestThrottler(t)
	window := 3 * time.Second

	before := time.Now().UTC()
	result, err := throttler.TryAcquire(context.Background(), "recovery", window)
	require.NoError(t, err)

	assert.True(t, result.Allowed)
	// RetryAfter is stamped from the acquisition instant, so allow a little
	// slack for the call itself.
	assert.WithinDuration(t, before.Add(window), result.RetryAfter, 500*time.Millisecond)
}

func TestThrottlerTryAcquireSecondDenies(t *testing.T) {
	throttler, _ := newTestThrottler(t)
	ctx := context.Background()
	window := 3 * time.Second

	first, err := throttler.TryAcquire(ctx, "recovery", window)
	require.NoError(t, err)
	require.True(t, first.Allowed)

	second, err := throttler.TryAcquire(ctx, "recovery", window)
	require.NoError(t, err)

	assert.False(t, second.Allowed)
	assert.True(t, second.RetryAfter.After(time.Now()), "RetryAfter must be in the future")
	assert.WithinDuration(t, first.RetryAfter, second.RetryAfter, 500*time.Millisecond)
}

func TestThrottlerTryAcquireKeysIndependent(t *testing.T) {
	throttler, _ := newTestThrottler(t)
	ctx := context.Background()
	window := 3 * time.Second

	first, err := throttler.TryAcquire(ctx, "user-a", window)
	require.NoError(t, err)
	require.True(t, first.Allowed)

	second, err := throttler.TryAcquire(ctx, "user-b", window)
	require.NoError(t, err)
	assert.True(t, second.Allowed)

	denied, err := throttler.TryAcquire(ctx, "user-a", window)
	require.NoError(t, err)
	assert.False(t, denied.Allowed)
}

func TestThrottlerReleaseAllowsImmediately(t *testing.T) {
	throttler, _ := newTestThrottler(t)
	ctx := context.Background()
	window := 3 * time.Second

	_, err := throttler.TryAcquire(ctx, "email-change", window)
	require.NoError(t, err)

	denied, err := throttler.TryAcquire(ctx, "email-change", window)
	require.NoError(t, err)
	require.False(t, denied.Allowed)

	require.NoError(t, throttler.Release(ctx, "email-change"))

	again, err := throttler.TryAcquire(ctx, "email-change", window)
	require.NoError(t, err)
	assert.True(t, again.Allowed)
}

func TestThrottlerTryAcquireExpires(t *testing.T) {
	throttler, mr := newTestThrottler(t)
	ctx := context.Background()
	window := 3 * time.Second

	_, err := throttler.TryAcquire(ctx, "expiring", window)
	require.NoError(t, err)

	mr.FastForward(window + time.Second)

	result, err := throttler.TryAcquire(ctx, "expiring", window)
	require.NoError(t, err)
	assert.True(t, result.Allowed)
}

func TestThrottlerValidation(t *testing.T) {
	ctx := context.Background()
	validTTL := 3 * time.Second

	tests := []struct {
		name string
		call func(*Throttler) error
	}{
		{
			name: "try acquire rejects empty key",
			call: func(th *Throttler) error {
				_, err := th.TryAcquire(ctx, "", validTTL)
				return err
			},
		},
		{
			name: "try acquire rejects zero ttl",
			call: func(th *Throttler) error {
				_, err := th.TryAcquire(ctx, "key", 0)
				return err
			},
		},
		{
			name: "try acquire rejects negative ttl",
			call: func(th *Throttler) error {
				_, err := th.TryAcquire(ctx, "key", -time.Second)
				return err
			},
		},
		{
			name: "release rejects empty key",
			call: func(th *Throttler) error {
				return th.Release(ctx, "")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			throttler, _ := newTestThrottler(t)
			assert.Error(t, tt.call(throttler))
		})
	}
}
