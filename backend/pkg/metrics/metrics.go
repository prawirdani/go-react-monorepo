package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Bucket sets are HTTP-tuned rather than prometheus.DefBuckets, which tops out
// at 10s and is too coarse for request latency.
var (
	durationBuckets = []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10}
	sizeBuckets     = []float64{.1, .5, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 50000}
)

type Metrics struct {
	Info        *prometheus.GaugeVec
	ReqDuration *prometheus.HistogramVec
	ReqCounter  *prometheus.CounterVec

	ReqInFlight *prometheus.GaugeVec
	ReqSize     *prometheus.HistogramVec
	RespSize    *prometheus.HistogramVec
	Errors      *prometheus.CounterVec
	Panics      prometheus.Counter
}

func Init(version, env string) *Metrics {
	m := &Metrics{
		Info: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: "app",
				Name:      "info",
				Help:      "Application Information",
			}, []string{"version", "environment"},
		),
		ReqDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "app",
				Name:      "request_duration",
				Help:      "Request duration in seconds",
				Buckets:   durationBuckets,
			}, []string{"path", "method", "status_code"},
		),
		ReqCounter: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "app",
				Name:      "request_total",
				Help:      "Total number of requests",
			}, []string{"path", "method", "status_code"},
		),
		ReqInFlight: prometheus.NewGaugeVec(
			prometheus.GaugeOpts{
				Namespace: "app",
				Name:      "requests_in_flight",
				Help:      "Number of requests currently being handled",
			}, []string{"method"},
		),
		ReqSize: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "app",
				Name:      "request_size_bytes",
				Help:      "Request body size in bytes (from Content-Length)",
				Buckets:   sizeBuckets,
			}, []string{"route", "method"},
		),
		RespSize: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Namespace: "app",
				Name:      "response_size_bytes",
				Help:      "Response body size in bytes",
				Buckets:   sizeBuckets,
			}, []string{"route", "method"},
		),
		Errors: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Namespace: "app",
				Name:      "errors_total",
				Help:      "Total number of error responses by stable application error code",
			}, []string{"code"},
		),
		Panics: prometheus.NewCounter(
			prometheus.CounterOpts{
				Namespace: "app",
				Name:      "panics_total",
				Help:      "Total number of recovered panics",
			},
		),
	}
	m.Info.WithLabelValues(version, env).Set(1)

	prometheus.MustRegister(
		m.ReqDuration, m.Info, m.ReqCounter,
		m.ReqInFlight, m.ReqSize, m.RespSize, m.Errors, m.Panics,
	)
	return m
}

func (m *Metrics) ExporterHandler() http.Handler {
	return promhttp.Handler()
}
