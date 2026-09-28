package postgres

import (
	"context"
	"testing"

	"github.com/prawirdani/go-react-monorepo/internal/auth"
	"github.com/prawirdani/go-react-monorepo/internal/ports/outbox"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// captureWriter records enqueued outbox topics and payloads.
type captureWriter struct {
	topics   []string
	payloads []any
}

func (w *captureWriter) Enqueue(_ context.Context, topic string, payload any) error {
	w.topics = append(w.topics, topic)
	w.payloads = append(w.payloads, payload)
	return nil
}

func TestAuthEventProducer(t *testing.T) {
	t.Run("Registration completion", func(t *testing.T) {
		w := &captureWriter{}
		p := NewAuthEventProducer(w)

		msg := auth.CompleteRegistrationMessage{
			To:     "john@example.com",
			Name:   "John Doe",
			URL:    "https://app/complete?token=abc",
			Expiry: 3600,
		}

		require.NoError(t, p.ProduceRegistrationCompletionEvent(context.Background(), msg))
		require.Len(t, w.topics, 1)

		assert.Equal(t, outbox.TopicUserRegistration, w.topics[0])
		// The domain message is stored unwrapped; the repository marshals it.
		assert.Equal(t, msg, w.payloads[0])
	})

	t.Run("Password recovery", func(t *testing.T) {
		w := &captureWriter{}
		p := NewAuthEventProducer(w)

		msg := auth.PasswordRecoveryMessage{
			To:       "john@example.com",
			Name:     "John Doe",
			ResetURL: "https://app/reset?token=xyz",
			Expiry:   1800,
		}

		require.NoError(t, p.ProducePasswordRecoveryEvent(context.Background(), msg))
		require.Len(t, w.topics, 1)

		assert.Equal(t, outbox.TopicPasswordRecovery, w.topics[0])
		assert.Equal(t, msg, w.payloads[0])
	})
}
