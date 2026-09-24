// Package outbox defines the transactional outbox port: a notification is
// persisted in the same database transaction as the business state it
// describes and delivered later by the worker, so a crash between commit and
// delivery cannot lose it.
package outbox

import "context"

// MaxAttempts is how many times a message is tried before it is left in the
// table as a dead-letter record (queryable with SQL) and skipped.
const MaxAttempts = 5

// Notification topics. Shared by the producer (auth) and the worker handlers.
const (
	TopicPasswordRecovery = "email.password_recovery"
	TopicUserRegistration = "email.user_registration"
)

// Message is a pending notification read by the worker.
type Message struct {
	// Seq is the insertion-ordered identity, also the FIFO key.
	Seq int64

	// Topic selects the worker handler.
	Topic string

	// Payload is the JSON-encoded domain message.
	Payload []byte
}

// Writer persists messages on the connection carried by ctx. When a transaction
// is active in ctx the write joins it, so the message commits or rolls back with
// the business state.
type Writer interface {
	Enqueue(ctx context.Context, topic string, payload any) error
}

// Store additionally drains messages for the worker.
type Store interface {
	Writer

	// FetchBatch returns up to limit undelivered messages, oldest first.
	FetchBatch(ctx context.Context, limit int) ([]Message, error)

	// MarkDone removes a delivered message.
	MarkDone(ctx context.Context, seq int64) error

	// MarkFailed records an attempt; retried until MaxAttempts is reached.
	MarkFailed(ctx context.Context, seq int64, errMsg string) error
}
