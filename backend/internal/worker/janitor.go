// Package worker delivers outbox messages and runs background housekeeping for
// the standalone worker process.
package worker

import (
	"context"
	"time"

	"github.com/prawirdani/go-react-monorepo/pkg/log"
)

// Cleaner removes rows that no longer serve a purpose. Implementations must be
// safe to call repeatedly, because the janitor calls them on every tick.
type Cleaner interface {
	Cleanup(ctx context.Context) error
}

// Janitor runs a Cleaner on a fixed interval for the life of the process.
//
// Cleanup is best-effort housekeeping: a failure is logged and the next tick
// retries. It never blocks or escalates to the caller.
type Janitor struct {
	cleaner  Cleaner
	interval time.Duration
}

// NewJanitor constructs a janitor that cleans once an hour.
func NewJanitor(cleaner Cleaner) *Janitor {
	return &Janitor{
		cleaner:  cleaner,
		interval: time.Hour,
	}
}

// Run cleans immediately, then on every tick until ctx is cancelled. It returns
// only when ctx is done; a cleanup error never stops the loop.
func (j *Janitor) Run(ctx context.Context) {
	log.InfoCtx(ctx, "Janitor started", "interval", j.interval)

	ticker := time.NewTicker(j.interval)
	defer ticker.Stop()

	// Log the transition, not every tick, so a sustained failure does not flood
	// the log at one line per interval.
	failing := false
	for {
		err := j.cleaner.Cleanup(ctx)
		switch {
		case err != nil && !failing:
			log.ErrorCtx(ctx, "Janitor cleanup failing", err)
			failing = true
		case err == nil && failing:
			log.InfoCtx(ctx, "Janitor cleanup recovered")
			failing = false
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
