package postgres

import (
	"context"

	"github.com/prawirdani/go-react-monorepo/internal/auth"
	"github.com/prawirdani/go-react-monorepo/internal/ports/outbox"
)

// authEventProducer enqueues auth notification events into the transactional
// outbox. It implements [auth.EventProducer].
//
// Events are enqueued on the connection carried by ctx, so when the service
// calls it inside a transaction the event commits with the business state.
// Email delivery is the worker's job.
type authEventProducer struct {
	w outbox.Writer
}

// NewAuthEventProducer constructs an outbox-backed auth event producer.
func NewAuthEventProducer(w outbox.Writer) *authEventProducer {
	return &authEventProducer{w: w}
}

// ProducePasswordRecoveryEvent implements [auth.EventProducer].
func (p *authEventProducer) ProducePasswordRecoveryEvent(
	ctx context.Context,
	msg auth.PasswordRecoveryMessage,
) error {
	return p.w.Enqueue(ctx, outbox.TopicPasswordRecovery, msg)
}

// ProduceRegistrationCompletionEvent implements [auth.EventProducer].
func (p *authEventProducer) ProduceRegistrationCompletionEvent(
	ctx context.Context,
	msg auth.CompleteRegistrationMessage,
) error {
	return p.w.Enqueue(ctx, outbox.TopicUserRegistration, msg)
}
