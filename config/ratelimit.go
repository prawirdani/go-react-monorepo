package config

import (
	"os"
	"strconv"
	"time"
)

// RateLimit configures the HTTP request budgets enforced by the transport
// middleware. Every budget is counted in Redis, so the numbers hold across API
// replicas rather than per process.
type RateLimit struct {
	// GlobalMax is the per-IP budget for every route, applied in production
	// only (RATE_LIMIT_GLOBAL_MAX, default 300). It runs before
	// authentication, so it can only see the client IP; keep it generous
	// because one CGNAT address can front many users.
	GlobalMax int
	// UserMax is the per-user budget for authenticated routes, keyed by the
	// verified user id (RATE_LIMIT_USER_MAX, default 120).
	UserMax int
	// AuthMax is the per-IP budget for the unauthenticated auth routes
	// (login, registration completion, password recovery)
	// (RATE_LIMIT_AUTH_MAX, default 20). The per-email login lockout and
	// recovery throttle provide the targeted defence.
	AuthMax int
	// Window is the fixed window all budgets reset on
	// (RATE_LIMIT_WINDOW, default 1m).
	Window time.Duration
}

func (r *RateLimit) Parse() error {
	if val := os.Getenv("RATE_LIMIT_GLOBAL_MAX"); val != "" {
		if n, err := strconv.Atoi(val); err == nil {
			r.GlobalMax = n
		}
	}
	if val := os.Getenv("RATE_LIMIT_USER_MAX"); val != "" {
		if n, err := strconv.Atoi(val); err == nil {
			r.UserMax = n
		}
	}
	if val := os.Getenv("RATE_LIMIT_AUTH_MAX"); val != "" {
		if n, err := strconv.Atoi(val); err == nil {
			r.AuthMax = n
		}
	}
	if val := os.Getenv("RATE_LIMIT_WINDOW"); val != "" {
		if d, err := time.ParseDuration(val); err == nil {
			r.Window = d
		}
	}

	if r.GlobalMax <= 0 {
		r.GlobalMax = 300
	}
	if r.UserMax <= 0 {
		r.UserMax = 120
	}
	if r.AuthMax <= 0 {
		r.AuthMax = 20
	}
	if r.Window <= 0 {
		r.Window = time.Minute
	}
	return nil
}
