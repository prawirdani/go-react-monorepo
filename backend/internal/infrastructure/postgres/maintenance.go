package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/prawirdani/go-react-monorepo/internal/ports/outbox"
	"github.com/prawirdani/go-react-monorepo/pkg/log"
)

// cleanupTimeout bounds one housekeeping run, so a slow DELETE cannot pin a
// pooled connection.
const cleanupTimeout = 30 * time.Second

// Maintenance deletes rows that have outlived their purpose: expired sessions
// and one-time tokens, plus old dead-lettered outbox messages.
//
// audit_logs is deliberately untouched: the audit trail needs its own retention
// decision.
type Maintenance struct {
	db *DB
}

// NewMaintenance constructs a maintenance runner backed by db.
func NewMaintenance(db *DB) *Maintenance {
	return &Maintenance{db: db}
}

// Cleanup runs each DELETE on its own. The first error stops the run and is
// returned; already-deleted rows stay deleted, and the next tick retries the
// remaining statements. The whole run is bounded, so a slow DELETE cannot hold
// a pooled connection for the life of the process.
func (m *Maintenance) Cleanup(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, cleanupTimeout)
	defer cancel()

	deletes := []struct {
		table string
		query string
	}{
		{"sessions", `DELETE FROM sessions WHERE expires_at < now() - interval '7 days'`},
		{"registration_tokens", `DELETE FROM registration_tokens WHERE expires_at < now() - interval '7 days'`},
		{"password_recovery_tokens", `DELETE FROM password_recovery_tokens WHERE expires_at < now() - interval '7 days'`},
		{"email_change_tokens", `DELETE FROM email_change_tokens WHERE expires_at < now() - interval '7 days'`},
		{"outbox_messages", fmt.Sprintf(
			`DELETE FROM outbox_messages WHERE attempts >= %d AND created_at < now() - interval '30 days'`,
			outbox.MaxAttempts,
		)},
	}

	var total int64
	args := make([]any, 0, len(deletes)*2+2)
	for _, d := range deletes {
		tag, err := m.db.GetConn(ctx).Exec(ctx, d.query)
		if err != nil {
			return fmt.Errorf("cleanup %s: %w", d.table, err)
		}

		deleted := tag.RowsAffected()
		total += deleted
		args = append(args, d.table, deleted)
	}

	args = append(args, "total_deleted", total)
	log.DebugCtx(ctx, "Maintenance cleanup finished", args...)

	return nil
}
