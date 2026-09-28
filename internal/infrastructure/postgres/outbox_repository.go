package postgres

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/georgysavva/scany/v2/pgxscan"
	"github.com/prawirdani/go-react-monorepo/internal/ports/outbox"
)

type outboxRepository struct {
	db *DB
}

// NewOutboxRepository constructs an outbox repository backed by db.
func NewOutboxRepository(db *DB) *outboxRepository {
	return &outboxRepository{db: db}
}

// Enqueue implements [outbox.Writer]. It requires an active transaction so the
// write joins the business state and cannot silently autocommit a "ghost" event
// when called outside Transact.
func (r *outboxRepository) Enqueue(ctx context.Context, topic string, payload any) error {
	conn, err := r.db.MustGetTxConn(ctx)
	if err != nil {
		return fmt.Errorf("enqueue outbox message: %w", err)
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal outbox payload: %w", err)
	}

	const query = `INSERT INTO outbox_messages (topic, payload) VALUES ($1, $2)`
	if _, err := conn.Exec(ctx, query, topic, data); err != nil {
		return fmt.Errorf("insert outbox message: %w", err)
	}

	return nil
}

// FetchBatch implements [outbox.Store]. Rows that exhausted their retries are
// skipped; they stay in the table as the dead-letter record.
func (r *outboxRepository) FetchBatch(ctx context.Context, limit int) ([]outbox.Message, error) {
	const query = `
		SELECT seq, topic, payload
		FROM outbox_messages
		WHERE attempts < $2
		ORDER BY seq
		LIMIT $1
	`

	var rows []struct {
		Seq     int64  `db:"seq"`
		Topic   string `db:"topic"`
		Payload []byte `db:"payload"`
	}

	if err := pgxscan.Select(ctx, r.db.GetConn(ctx), &rows, query, limit, outbox.MaxAttempts); err != nil {
		return nil, fmt.Errorf("fetch outbox messages: %w", err)
	}

	msgs := make([]outbox.Message, 0, len(rows))
	for _, row := range rows {
		msgs = append(msgs, outbox.Message{
			Seq:     row.Seq,
			Topic:   row.Topic,
			Payload: row.Payload,
		})
	}

	return msgs, nil
}

// MarkDone implements [outbox.Store].
func (r *outboxRepository) MarkDone(ctx context.Context, seq int64) error {
	const query = `DELETE FROM outbox_messages WHERE seq = $1`

	if _, err := r.db.GetConn(ctx).Exec(ctx, query, seq); err != nil {
		return fmt.Errorf("delete outbox message: %w", err)
	}

	return nil
}

// MarkFailed implements [outbox.Store]. attempts is incremented on the row, so a
// concurrent reader may still see an older value; that only delays the retry.
func (r *outboxRepository) MarkFailed(ctx context.Context, seq int64, errMsg string) error {
	const query = `UPDATE outbox_messages SET attempts = attempts + 1, last_error = $2 WHERE seq = $1`

	if _, err := r.db.GetConn(ctx).Exec(ctx, query, seq, errMsg); err != nil {
		return fmt.Errorf("mark outbox message failed: %w", err)
	}

	return nil
}
