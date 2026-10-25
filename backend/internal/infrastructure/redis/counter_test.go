package redis

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestCounter returns a Counter backed by an in-process Redis. miniredis
// implements EVAL, so the real increment script runs unmodified.
func newTestCounter(t *testing.T) (*Counter, *miniredis.Miniredis) {
	t.Helper()

	mr := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = client.Close() })

	return NewCounter(client), mr
}

func TestCounterCountMissingKey(t *testing.T) {
	counter, _ := newTestCounter(t)

	n, ttl, err := counter.Count(context.Background(), "missing")

	assert.NoError(t, err)
	assert.Zero(t, n)
	assert.Zero(t, ttl)
}

func TestCounterIncrementSetsWindowOnce(t *testing.T) {
	counter, mr := newTestCounter(t)
	ctx := context.Background()
	window := 5 * time.Second

	n, first, err := counter.Increment(ctx, "lockout", window)
	require.NoError(t, err)
	assert.Equal(t, int64(1), n)
	assert.Positive(t, first)
	assert.LessOrEqual(t, first, window)

	// Time passes between attempts. The window must keep shrinking: an attacker
	// that keeps failing must not refresh its own lockout.
	mr.FastForward(time.Second)

	n, second, err := counter.Increment(ctx, "lockout", window)
	require.NoError(t, err)
	assert.Equal(t, int64(2), n)

	const tolerance = 100 * time.Millisecond
	assert.LessOrEqual(
		t,
		second,
		first,
		"second increment must not extend the window",
	)
	assert.LessOrEqual(
		t,
		second,
		first+tolerance,
		"second increment must not grow the window beyond tolerance",
	)
	assert.LessOrEqual(t, second, window)
}

func TestCounterCountReflectsIncrements(t *testing.T) {
	counter, _ := newTestCounter(t)
	ctx := context.Background()

	_, _, err := counter.Increment(ctx, "failures", time.Minute)
	require.NoError(t, err)
	_, _, err = counter.Increment(ctx, "failures", time.Minute)
	require.NoError(t, err)

	n, ttl, err := counter.Count(ctx, "failures")
	require.NoError(t, err)
	assert.Equal(t, int64(2), n)
	assert.Positive(t, ttl)
}

func TestCounterReset(t *testing.T) {
	counter, _ := newTestCounter(t)
	ctx := context.Background()

	_, _, err := counter.Increment(ctx, "reset-me", time.Minute)
	require.NoError(t, err)

	n, _, err := counter.Count(ctx, "reset-me")
	require.NoError(t, err)
	require.Equal(t, int64(1), n)

	require.NoError(t, counter.Reset(ctx, "reset-me"))

	n, ttl, err := counter.Count(ctx, "reset-me")
	assert.NoError(t, err)
	assert.Zero(t, n)
	assert.Zero(t, ttl)
}

func TestCounterIncrementConcurrent(t *testing.T) {
	counter, _ := newTestCounter(t)
	ctx := context.Background()

	const goroutines = 50
	var wg sync.WaitGroup
	wg.Add(goroutines)

	for range goroutines {
		go func() {
			defer wg.Done()
			_, _, err := counter.Increment(ctx, "concurrent", time.Minute)
			assert.NoError(t, err)
		}()
	}

	wg.Wait()

	n, _, err := counter.Count(ctx, "concurrent")
	require.NoError(t, err)
	assert.Equal(t, int64(goroutines), n)
}

func TestCounterValidation(t *testing.T) {
	ctx := context.Background()
	validTTL := time.Minute

	tests := []struct {
		name string
		call func(*Counter) error
	}{
		{
			name: "increment rejects empty key",
			call: func(c *Counter) error {
				_, _, err := c.Increment(ctx, "", validTTL)
				return err
			},
		},
		{
			name: "increment rejects zero ttl",
			call: func(c *Counter) error {
				_, _, err := c.Increment(ctx, "key", 0)
				return err
			},
		},
		{
			name: "increment rejects negative ttl",
			call: func(c *Counter) error {
				_, _, err := c.Increment(ctx, "key", -time.Second)
				return err
			},
		},
		{
			name: "count rejects empty key",
			call: func(c *Counter) error {
				_, _, err := c.Count(ctx, "")
				return err
			},
		},
		{
			name: "reset rejects empty key",
			call: func(c *Counter) error {
				return c.Reset(ctx, "")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			counter, _ := newTestCounter(t)
			assert.Error(t, tt.call(counter))
		})
	}
}
