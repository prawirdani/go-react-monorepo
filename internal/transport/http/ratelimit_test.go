package http

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/prawirdani/go-react-monorepo/internal/ports/throttle"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeCounter is a per-key hit counter that mirrors the Redis contract: it
// increments on every call and ignores the window (the tests do not need time).
type fakeCounter struct {
	hits map[string]int64
	err  error
}

func newFakeCounter() *fakeCounter {
	return &fakeCounter{hits: make(map[string]int64)}
}

func (f *fakeCounter) Count(_ context.Context, key string) (int64, time.Duration, error) {
	return f.hits[key], time.Minute, nil
}

func (f *fakeCounter) Increment(_ context.Context, key string, _ time.Duration) (int64, time.Duration, error) {
	if f.err != nil {
		return 0, 0, f.err
	}
	f.hits[key]++
	return f.hits[key], time.Minute, nil
}

func (f *fakeCounter) Reset(_ context.Context, key string) error {
	delete(f.hits, key)
	return nil
}

func serveRateLimited(t *testing.T, counter throttle.Counter, max int) (int, http.Header) {
	t.Helper()

	// Mirror the server's error handler so ErrRateLimit maps to 429 rather than
	// Fiber's default 500.
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c fiber.Ctx, err error) error {
			e := ParseError(err)
			return c.Status(e.Status()).JSON(map[string]any{"error": e})
		},
	})
	app.Use(NewRateLimiter(counter).IP("test", max, time.Minute))
	app.Get("/", func(c fiber.Ctx) error { return c.SendStatus(http.StatusOK) })

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, "/", nil)
	require.NoError(t, err)

	resp, err := app.Test(req)
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())
	return resp.StatusCode, resp.Header
}

func TestRateLimitIP(t *testing.T) {
	t.Run("allows up to max then throttles", func(t *testing.T) {
		counter := newFakeCounter()

		for i := 1; i <= 3; i++ {
			status, _ := serveRateLimited(t, counter, 3)
			assert.Equal(t, http.StatusOK, status, "hit %d", i)
		}

		status, header := serveRateLimited(t, counter, 3)
		assert.Equal(t, http.StatusTooManyRequests, status)
		assert.Equal(t, "3", header.Get("X-RateLimit-Limit"))
		assert.Equal(t, "0", header.Get("X-RateLimit-Remaining"))
		assert.NotEmpty(t, header.Get("Retry-After"))
	})

	t.Run("fails open when the counter errors", func(t *testing.T) {
		counter := newFakeCounter()
		counter.err = errors.New("redis down")

		status, _ := serveRateLimited(t, counter, 1)
		assert.Equal(t, http.StatusOK, status)
	})
}
