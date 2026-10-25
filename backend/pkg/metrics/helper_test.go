package metrics

import "github.com/prometheus/client_golang/prometheus"

// newTestMetrics builds the metric vectors without touching the global
// Prometheus registry, so tests can run independently and repeatedly.
func newTestMetrics() *Metrics {
	return &Metrics{
		ReqDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "app",
				Name:      "request_duration",
				Buckets:   durationBuckets,
			}, []string{"path", "method", "status_code"}),
		ReqCounter: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "app",
				Name:      "request_total",
			}, []string{"path", "method", "status_code"}),
		ReqInFlight: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: "app",
				Name:      "requests_in_flight",
			}, []string{"method"}),
		ReqSize: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "app",
				Name:      "request_size_bytes",
				Buckets:   sizeBuckets,
			}, []string{"route", "method"}),
		RespSize: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "app",
				Name:      "response_size_bytes",
				Buckets:   sizeBuckets,
			}, []string{"route", "method"}),
		Errors: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "app",
				Name:      "errors_total",
			}, []string{"code"}),
		Panics: prometheus.NewCounter(prometheus.CounterOpts{
			Namespace: "app",
			Name:      "panics_total",
		}),
	}
}
