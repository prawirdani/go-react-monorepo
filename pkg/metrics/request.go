package metrics

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
)

// InstrumentHandler is a Fiber middleware that records Prometheus request
// metrics (in-flight, duration, count, size, errors) labelled by route
// template, method, and status.
//
// resolve maps a handler-returned error to the HTTP status the app's
// ErrorHandler will send and the stable application error code. It is required
// because Fiber runs the ErrorHandler only after the middleware chain unwinds,
// so c.Response().StatusCode() is not yet the final status when a handler
// returned an error.
func (m *Metrics) InstrumentHandler(resolve func(error) (int, string)) fiber.Handler {
	return func(c fiber.Ctx) error {
		start := time.Now()
		method := c.Method()

		m.ReqInFlight.WithLabelValues(method).Inc()
		defer m.ReqInFlight.WithLabelValues(method).Dec()

		// A panicking handler unwinds past this middleware (recoverer is
		// registered outside it), so recover here to count the panic, record it
		// in the RED metrics, then re-panic for the outer recoverer to turn into
		// the normal 500 response.
		defer func() {
			p := recover()
			if p == nil {
				return
			}
			route := routeTemplate(c)
			m.Panics.Inc()
			m.ReqDuration.WithLabelValues(route, method, "500").Observe(time.Since(start).Seconds())
			m.ReqCounter.WithLabelValues(route, method, "500").Inc()
			m.Errors.WithLabelValues("INTERNAL").Inc()
			panic(p)
		}()

		chainErr := c.Next()

		status := c.Response().StatusCode()
		code := ""
		if chainErr != nil {
			status, code = resolve(chainErr)
		} else if status >= 400 {
			code = strconv.Itoa(status)
		}

		route := routeTemplate(c)
		statusStr := strconv.Itoa(status)
		m.ReqDuration.WithLabelValues(route, method, statusStr).Observe(time.Since(start).Seconds())
		m.ReqCounter.WithLabelValues(route, method, statusStr).Inc()

		if status >= 400 && code != "" {
			m.Errors.WithLabelValues(code).Inc()
		}

		m.observeRequestSize(c, route, method)
		m.RespSize.WithLabelValues(route, method).Observe(float64(len(c.Response().Body())))

		return chainErr
	}
}

// routeTemplate returns the matched route template (e.g. "/users/:id") rather
// than the raw path to keep label cardinality bounded. Fiber reports "/" for
// unmatched (404) requests, which is itself a fixed low-cardinality label.
func routeTemplate(c fiber.Ctx) string {
	if r := c.Route(); r != nil && r.Path != "" {
		return r.Path
	}
	return "unknown"
}

// observeRequestSize records the request body size from Content-Length. Chunked
// or otherwise unknown lengths (< 0, or no header) are skipped.
func (m *Metrics) observeRequestSize(c fiber.Ctx, route, method string) {
	cl := c.Get(fiber.HeaderContentLength)
	if cl == "" {
		return
	}
	n, err := strconv.ParseInt(cl, 10, 64)
	if err != nil || n < 0 {
		return
	}
	m.ReqSize.WithLabelValues(route, method).Observe(float64(n))
}
