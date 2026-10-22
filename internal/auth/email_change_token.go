package auth

import (
	"time"

	"github.com/google/uuid"
	"github.com/prawirdani/go-react-monorepo/internal/apperr"
	"github.com/prawirdani/go-react-monorepo/pkg/nullable"
)

var ErrInvalidEmailChangeToken = apperr.UnauthorizedErr(
	"invalid or expired email change token",
	"AUTH_INVALID_EMAIL_CHANGE_TOKEN",
)

var ErrEmailChangeThrottled = apperr.ThrottledErr(
	"too many email change requests, please try again later",
	"AUTH_EMAIL_CHANGE_THROTTLED",
)

const EmailChangeThrottledTTL = 30 * time.Second

// EmailChangeToken is a single-use, time-boxed confirmation of a requested
// email change. Only the token hash is persisted; the raw value is emailed to
// the new address once.
type EmailChangeToken struct {
	ID        int                          `json:"id"         db:"id"`
	UserID    uuid.UUID                    `json:"user_id"    db:"user_id"`
	NewEmail  string                       `json:"new_email"  db:"new_email"`
	TokenHash []byte                       `json:"-"          db:"token_hash"`
	IssuedAt  time.Time                    `json:"issued_at"  db:"issued_at"`
	ExpiresAt time.Time                    `json:"expires_at" db:"expires_at"`
	UsedAt    nullable.Nullable[time.Time] `json:"used_at"    db:"used_at"`
}

// NewEmailChangeToken creates a new token for the given user and requested new
// email with a specified expiration.
func NewEmailChangeToken(userID uuid.UUID, newEmail string, ttl time.Duration) (*EmailChangeToken, string, error) {
	token, err := GenerateOpaqueToken(32, "et") // 256-bit token
	if err != nil {
		return nil, "", err
	}

	tokenHash := HashStr(token)

	now := time.Now()
	return &EmailChangeToken{
		UserID:    userID,
		NewEmail:  newEmail,
		TokenHash: tokenHash,
		IssuedAt:  now,
		ExpiresAt: now.Add(ttl),
	}, token, nil
}

// Expired reports whether the token has passed its expiration time.
func (t EmailChangeToken) Expired() bool {
	return t.ExpiresAt.Before(time.Now())
}

// IsUsed reports whether the token has already been used.
func (t EmailChangeToken) IsUsed() bool {
	return t.UsedAt.NotNull()
}

// Use marks the token as used immediately.
func (t *EmailChangeToken) Use() {
	t.UsedAt.Set(time.Now(), false)
}
