package worker

import (
	"context"
	"errors"
	"testing"

	"github.com/prawirdani/golang-restapi/internal/ports/outbox"
	"github.com/prawirdani/golang-restapi/pkg/log"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	log.SetLogger(log.EmptyLog)
}

// fakeStore is an in-memory outbox.Store for the drain tests.
type fakeStore struct {
	msgs     []outbox.Message
	fetchErr error
	done     []int64
	failed   map[int64]string
}

func (s *fakeStore) Enqueue(context.Context, string, any) error { return nil }

func (s *fakeStore) FetchBatch(_ context.Context, limit int) ([]outbox.Message, error) {
	if s.fetchErr != nil {
		return nil, s.fetchErr
	}
	if len(s.msgs) > limit {
		return s.msgs[:limit], nil
	}
	return s.msgs, nil
}

func (s *fakeStore) MarkDone(_ context.Context, seq int64) error {
	s.done = append(s.done, seq)
	return nil
}

func (s *fakeStore) MarkFailed(_ context.Context, seq int64, errMsg string) error {
	if s.failed == nil {
		s.failed = map[int64]string{}
	}
	s.failed[seq] = errMsg
	return nil
}

func TestOutboxWorkerDrain(t *testing.T) {
	deliverErr := errors.New("smtp down")

	tests := []struct {
		name       string
		msgs       []outbox.Message
		fetchErr   error
		topic      string // topic registered with a handler; "" registers none
		handlerErr error
		wantCalls  int
		wantDone   []int64
		wantFailed map[int64]string
		wantErr    bool
	}{
		{
			name:      "Success marks done",
			msgs:      []outbox.Message{{Seq: 1, Topic: outbox.TopicUserRegistration, Payload: []byte(`{}`)}},
			topic:     outbox.TopicUserRegistration,
			wantCalls: 1,
			wantDone:  []int64{1},
		},
		{
			name:       "Handler error marks failed",
			msgs:       []outbox.Message{{Seq: 2, Topic: outbox.TopicPasswordRecovery, Payload: []byte(`{}`)}},
			topic:      outbox.TopicPasswordRecovery,
			handlerErr: deliverErr,
			wantCalls:  1,
			wantFailed: map[int64]string{2: deliverErr.Error()},
		},
		{
			name:       "Unknown topic marks failed without a handler call",
			msgs:       []outbox.Message{{Seq: 3, Topic: "email.unknown", Payload: []byte(`{}`)}},
			wantCalls:  0,
			wantFailed: map[int64]string{3: "no handler for topic email.unknown"},
		},
		{
			name:     "Fetch error aborts the drain",
			fetchErr: errors.New("db down"),
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			calls := 0
			handlers := map[string]Handler{}
			if tt.topic != "" {
				handlers[tt.topic] = func(context.Context, []byte) error {
					calls++
					return tt.handlerErr
				}
			}

			store := &fakeStore{msgs: tt.msgs, fetchErr: tt.fetchErr}
			w := NewOutboxWorker(store, handlers)

			err := w.drain(context.Background())

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tt.wantCalls, calls)
			assert.Equal(t, tt.wantDone, store.done)
			assert.Equal(t, tt.wantFailed, store.failed)
		})
	}
}
