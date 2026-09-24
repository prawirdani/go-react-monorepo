package metrics

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v3"
	recoverer "github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// resolveStatus mirrors Fiber's default error mapping: a *fiber.Error carries
// its own code, anything else is a 500.
func resolveStatus(err error) (int, string) {
	var fe *fiber.Error
	if errors.As(err, &fe) {
		return fe.Code, "FIBER_ERROR"
	}
	return fiber.StatusInternalServerError, "INTERNAL"
}

// newTestApp wires the instrument middleware into a Fiber app with a couple of
// routes so route templates and error statuses can be exercised. The recoverer
// is registered outside the instrument middleware, matching production, so the
// re-panic path can be observed.
func newTestApp(m *Metrics) *fiber.App {
	app := fiber.New()
	app.Use(recoverer.New())
	app.Use(m.InstrumentHandler(resolveStatus))
	app.Get("/users/:id", func(c fiber.Ctx) error {
		return c.SendStatus(http.StatusOK)
	})
	app.Post("/users/:id", func(c fiber.Ctx) error {
		return c.SendStatus(http.StatusOK)
	})
	app.Get("/boom", func(c fiber.Ctx) error {
		return fiber.NewError(http.StatusTeapot, "boom")
	})
	app.Get("/panic", func(c fiber.Ctx) error {
		panic("boom")
	})
	return app
}

func do(t *testing.T, app *fiber.App, method, target string) {
	t.Helper()
	req, err := http.NewRequestWithContext(context.Background(), method, target, nil)
	require.NoError(t, err)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())
}

func TestInstrumentHandler_UsesRouteTemplate(t *testing.T) {
	m := newTestMetrics()
	app := newTestApp(m)

	do(t, app, http.MethodGet, "/users/123")
	do(t, app, http.MethodGet, "/users/456")

	// Both concrete paths collapse onto the "/users/:id" template -> count 2,
	// proving the raw path is not used as a label (which would yield two series).
	got := testutil.ToFloat64(m.ReqCounter.WithLabelValues("/users/:id", http.MethodGet, "200"))
	assert.Equal(t, float64(2), got)

	// The concrete path must NOT exist as its own series.
	raw := testutil.ToFloat64(m.ReqCounter.WithLabelValues("/users/123", http.MethodGet, "200"))
	assert.Equal(t, float64(0), raw)

	// In-flight gauge must be back to zero once the request completes.
	assert.Equal(t, float64(0), testutil.ToFloat64(m.ReqInFlight.WithLabelValues(http.MethodGet)))
}

func TestInstrumentHandler_RecordsErrorStatus(t *testing.T) {
	m := newTestMetrics()
	app := newTestApp(m)

	do(t, app, http.MethodGet, "/boom")

	// Handler returned fiber.NewError(418); the status label must reflect it.
	got := testutil.ToFloat64(m.ReqCounter.WithLabelValues("/boom", http.MethodGet, "418"))
	assert.Equal(t, float64(1), got)

	// The resolver's error code drives app_errors_total.
	assert.Equal(t, float64(1), testutil.ToFloat64(m.Errors.WithLabelValues("FIBER_ERROR")))
}

func TestInstrumentHandler_SuccessDoesNotIncrementErrors(t *testing.T) {
	m := newTestMetrics()
	app := newTestApp(m)

	do(t, app, http.MethodGet, "/users/123")

	assert.Equal(t, float64(0), testutil.ToFloat64(m.Errors.WithLabelValues("FIBER_ERROR")))
	assert.Equal(t, float64(0), testutil.ToFloat64(m.Errors.WithLabelValues("INTERNAL")))
}

func TestInstrumentHandler_UnmatchedRoute(t *testing.T) {
	m := newTestMetrics()
	app := newTestApp(m)

	do(t, app, http.MethodGet, "/missing")

	// Fiber reports the "/" template for an unmatched request; the error status
	// (404) must still be captured from the returned fiber.Error.
	got := testutil.ToFloat64(m.ReqCounter.WithLabelValues("/", http.MethodGet, "404"))
	assert.Equal(t, float64(1), got)
}

func TestInstrumentHandler_RecordsSizes(t *testing.T) {
	m := newTestMetrics()
	app := newTestApp(m)

	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, "/users/1", strings.NewReader(`{"hello":"world"}`))
	require.NoError(t, err)
	require.Equal(t, int64(17), req.ContentLength)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())

	// Request size histogram got a sample for the route/method pair.
	assert.Equal(t, 1, testutil.CollectAndCount(m.ReqSize, "app_request_size_bytes"))
	assert.Equal(t, 1, testutil.CollectAndCount(m.RespSize, "app_response_size_bytes"))
}

func TestInstrumentHandler_PanicRecoveredAndRecorded(t *testing.T) {
	m := newTestMetrics()
	app := newTestApp(m)

	do(t, app, http.MethodGet, "/panic")

	// The panic was counted...
	assert.Equal(t, float64(1), testutil.ToFloat64(m.Panics))
	// ...and surfaced in the RED metrics as a 500...
	assert.Equal(t, float64(1), testutil.ToFloat64(m.ReqCounter.WithLabelValues("/panic", http.MethodGet, "500")))
	assert.Equal(t, float64(1), testutil.ToFloat64(m.Errors.WithLabelValues("INTERNAL")))
	// ...and the in-flight gauge was decremented exactly once.
	assert.Equal(t, float64(0), testutil.ToFloat64(m.ReqInFlight.WithLabelValues(http.MethodGet)))
}
