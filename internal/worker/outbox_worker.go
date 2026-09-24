package worker

import (
	"context"
	"errors"
	"time"

	"github.com/prawirdani/golang-restapi/internal/ports/outbox"
	"github.com/prawirdani/golang-restapi/pkg/log"
)

// Handler turns a stored payload into a delivery. Returning an error records the
// attempt and leaves the row to be retried on a later tick.
type Handler func(ctx context.Context, payload []byte) error

// OutboxWorker polls the outbox table and delivers messages sequentially.
//
// Delivery is at-least-once: a crash after the send and before MarkDone resends
// that one message. Handlers must therefore be idempotent (sending a duplicate
// email is acceptable; losing one is not).
type OutboxWorker struct {
	store    outbox.Store
	handlers map[string]Handler
	batch    int
	interval time.Duration
}

// NewOutboxWorker constructs a polling worker. handlerByTopic maps an
// outbox topic to the function that delivers it.
func NewOutboxWorker(store outbox.Store, handlerByTopic map[string]Handler) *OutboxWorker {
	return &OutboxWorker{
		store:    store,
		handlers: handlerByTopic,
		batch:    50,
		interval: time.Second,
	}
}

// Start polls immediately, then on every tick until ctx is cancelled.
func (w *OutboxWorker) Start(ctx context.Context) error {
	log.InfoCtx(ctx, "Outbox worker started", "interval", w.interval, "batch_size", w.batch)

	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	// Log the transition, not every tick, so a sustained Postgres outage does
	// not flood the log at one line per second.
	failing := false
	for {
		err := w.drain(ctx)
		switch {
		case err != nil && !failing:
			log.ErrorCtx(ctx, "Outbox drain failing", err)
			failing = true
		case err == nil && failing:
			log.InfoCtx(ctx, "Outbox drain recovered")
			failing = false
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

// drain delivers one batch sequentially. Only a fetch error aborts the drain;
// per-message failures are recorded and left for the next tick.
func (w *OutboxWorker) drain(ctx context.Context) error {
	msgs, err := w.store.FetchBatch(ctx, w.batch)
	if err != nil {
		return err
	}

	for _, m := range msgs {
		// The send is done, so the bookkeeping must survive a cancelled ctx or
		// the row would be redelivered on every restart.
		done := context.WithoutCancel(ctx)

		h, ok := w.handlers[m.Topic]
		if !ok {
			handlerErr := errors.New("no handler for topic " + m.Topic)
			log.ErrorCtx(ctx, "No handler for outbox topic", handlerErr, "seq", m.Seq, "topic", m.Topic)
			_ = w.store.MarkFailed(done, m.Seq, handlerErr.Error())
			continue
		}

		if err := h(ctx, m.Payload); err != nil {
			log.ErrorCtx(ctx, "Failed to handle outbox message", err, "seq", m.Seq, "topic", m.Topic)
			_ = w.store.MarkFailed(done, m.Seq, err.Error())
			continue
		}

		if err := w.store.MarkDone(done, m.Seq); err != nil {
			log.ErrorCtx(ctx, "Failed to delete handled outbox message", err, "seq", m.Seq)
			continue
		}

		log.DebugCtx(ctx, "Outbox message handled", "seq", m.Seq, "topic", m.Topic)
	}

	return nil
}
