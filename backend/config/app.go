package config

import (
	"os"
	"strconv"
	"strings"
)

type App struct {
	Name        string
	Version     string
	Port        int
	Environment AppEnv
	// InternalMode makes user registration admin-only (APP_INTERNAL_MODE)
	// instead of public self-service.
	InternalMode bool
	// MetricsEnabled serves the Prometheus /metrics sidecar (METRICS_ENABLED).
	// Defaults to production when unset.
	MetricsEnabled bool
	// MetricsPort is the port the Prometheus /metrics sidecar listens on
	// (METRICS_PORT). It defaults to Port+1 but is settable independently, so
	// a scraper never has to track APP_PORT to find the exporter.
	MetricsPort int
}

func (a *App) Parse() error {
	a.Name = os.Getenv("APP_NAME")
	a.Version = os.Getenv("APP_VERSION")
	a.Environment = AppEnv(strings.ToLower(os.Getenv("APP_ENV")))

	if val := os.Getenv("APP_PORT"); val != "" {
		port, err := strconv.Atoi(val)
		if err != nil {
			return err
		}
		a.Port = port
	}

	a.MetricsPort = a.Port + 1
	if val := os.Getenv("METRICS_PORT"); val != "" {
		metricsPort, err := strconv.Atoi(val)
		if err != nil {
			return err
		}
		a.MetricsPort = metricsPort
	}

	if val := os.Getenv("APP_INTERNAL_MODE"); val != "" {
		if b, err := strconv.ParseBool(val); err == nil {
			a.InternalMode = b
		}
	}

	// Metrics default to production-only (today's behaviour); an explicit value
	// wins either way.
	a.MetricsEnabled = a.Environment == EnvProduction
	if val := os.Getenv("METRICS_ENABLED"); val != "" {
		if b, err := strconv.ParseBool(val); err == nil {
			a.MetricsEnabled = b
		}
	}

	return nil
}
