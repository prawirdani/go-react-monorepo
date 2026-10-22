// Package auth provides authentication and authorization functionality.
// This package handles user authentication through sessions, access tokens, and
// password management including secure hashing and password reset flows. It manages
// the complete authentication lifecycle from login through logout, including token
// generation, validation, and session management.
package auth

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/prawirdani/go-react-monorepo/config"
	"github.com/prawirdani/go-react-monorepo/internal/apperr"
	"github.com/prawirdani/go-react-monorepo/internal/audit"
	"github.com/prawirdani/go-react-monorepo/internal/ports/repository"
	"github.com/prawirdani/go-react-monorepo/internal/ports/revocation"
	"github.com/prawirdani/go-react-monorepo/internal/ports/throttle"
	"github.com/prawirdani/go-react-monorepo/internal/rbac"
	"github.com/prawirdani/go-react-monorepo/internal/user"
	"github.com/prawirdani/go-react-monorepo/pkg/log"
)

const (
	PermChangePassword     rbac.Permission = "auth.change-password"
	PermRegisterUser       rbac.Permission = "auth.register-user" // new user registration by authorized roles (gated by internal mode=true)
	PermRevokeUserSessions rbac.Permission = "auth.revoke-user-sessions"
	PermViewUserSessions   rbac.Permission = "auth.view-user-sessions"
)

var permTables = rbac.PermissionTable{
	rbac.RoleSystem: {
		PermChangePassword:     {},
		PermRegisterUser:       {},
		PermRevokeUserSessions: {},
		PermViewUserSessions:   {},
	},
	rbac.RoleAdmin: {
		PermChangePassword:     {},
		PermRegisterUser:       {},
		PermRevokeUserSessions: {},
		PermViewUserSessions:   {},
	},
	rbac.RoleUser: {},
}

// Audit Actions for the auth entity. These record state changes (sessions,
// tokens, passwords); refused attempts and reuse signals are emitted as WARN
// logs instead of audit rows — they are security events, not state changes.
// nolint:gosec
// G101: audit action identifiers, not credentials
const (
	ActionRegister             audit.Action = "auth.register"
	ActionCompleteRegistration audit.Action = "auth.complete-registration"
	ActionLogin                audit.Action = "auth.login"
	ActionLogout               audit.Action = "auth.logout"
	ActionChangePassword       audit.Action = "auth.change-password"
	ActionResetPassword        audit.Action = "auth.reset-password"
	ActionRecoverPassword      audit.Action = "auth.password-recovery-request"
	ActionRequestEmailChange   audit.Action = "auth.email-change-request"
	ActionConfirmEmailChange   audit.Action = "auth.email-change-confirm"
	ActionRevokeUserSessions   audit.Action = "auth.revoke-user-sessions"
	ActionRevokeSession        audit.Action = "auth.revoke-session"
)

// ErrAccountLocked is returned while an account is locked out after too many
// consecutive failed logins. Details carry the remaining window in seconds.
var ErrAccountLocked = apperr.ThrottledErr(
	"too many failed login attempts, try again later",
	"AUTH_ACCOUNT_LOCKED",
)

// loginAttemptKey builds the per-account failure counter key from a hash of the
// normalized email. Hashing keeps raw addresses out of Redis keys, which are
// visible to anyone with store access, and keeps the key a fixed length.
func loginAttemptKey(email string) string {
	sum := HashStr(strings.ToLower(strings.TrimSpace(email)))
	return fmt.Sprintf("login:fail:%x", sum)
}

type Service struct {
	cfg           *config.Config
	transactor    repository.Transactor
	authRepo      Repository
	userRepo      UserRepository
	authorizer    rbac.Authorizer
	eventProducer EventProducer
	throttler     throttle.Throttler
	audit         audit.Recorder
	revoker       revocation.Revoker
	attempts      throttle.Counter
}

func NewService(
	cfg *config.Config,
	transactor repository.Transactor,
	userRepo UserRepository,
	authRepo Repository,
	authorizer rbac.Authorizer,
	eventProducer EventProducer,
	throttler throttle.Throttler,
	auditRecorder audit.Recorder,
	revoker revocation.Revoker,
	attempts throttle.Counter,
) *Service {
	authorizer.RegisterPermissions(permTables)

	return &Service{
		cfg:           cfg,
		transactor:    transactor,
		userRepo:      userRepo,
		authRepo:      authRepo,
		eventProducer: eventProducer,
		throttler:     throttler,
		authorizer:    authorizer,
		audit:         auditRecorder,
		revoker:       revoker,
		attempts:      attempts,
	}
}

// Register issues a short-lived registration token for inp.Email and
// sends a completion link once the token is durably stored. In internal
// mode it requires the PermRegisterUser permission (admin/system only).
// Returns [user.ErrEmailConflict] if the email is already registered.
func (s *Service) Register(ctx context.Context, inp RegisterInput) error {
	if s.cfg.App.InternalMode {
		if err := s.authorizer.Require(ctx, PermRegisterUser); err != nil {
			return err
		}
	}

	var token *RegistrationToken
	var rawToken string

	return s.transactor.Transact(ctx, func(ctx context.Context) error {
		u, err := s.userRepo.GetByEmail(ctx, inp.Email)
		if err != nil && !errors.Is(err, apperr.ErrNotFound) {
			return fmt.Errorf("looking up user by email: %w", err)
		}
		if u != nil {
			return user.ErrEmailConflict
		}

		// A new invitation supersedes any outstanding one for this email, so
		// re-inviting invalidates the previous link (latest invite wins).
		if err := s.authRepo.RevokeRegistrationTokens(ctx, inp.Email); err != nil {
			return fmt.Errorf("revoking previous registration tokens: %w", err)
		}

		token, rawToken, err = NewRegistrationToken(inp.Name, inp.Email, s.cfg.Auth.RegistrationTokenTTL)
		if err != nil {
			return fmt.Errorf("creating registration token: %w", err)
		}

		if err := s.authRepo.StoreRegistrationToken(ctx, token); err != nil {
			return fmt.Errorf("storing registration token: %w", err)
		}

		if err := s.audit.Record(ctx, audit.Entry{
			Action:   ActionRegister,
			Entity:   "registration_token",
			EntityID: strconv.Itoa(token.ID),
			Prev:     nil,
			Next:     token,
			Meta:     nil,
		}); err != nil {
			return err
		}

		// Enqueued in the same transaction as the token: the invitation and its
		// email can no longer diverge, so a publish failure rolls both back.
		return s.eventProducer.ProduceRegistrationCompletionEvent(ctx, CompleteRegistrationMessage{
			To:     inp.Email,
			Name:   inp.Name,
			URL:    fmt.Sprintf("%s?token=%s", s.cfg.Auth.CompleteRegistrationFormEndpoint, rawToken),
			Expiry: s.cfg.Auth.RegistrationTokenTTL,
		})
	})
}

// CompleteRegistration consumes a valid registration token and creates the
// user with the chosen password, atomically marking the token used.
//
// Returns [ErrInvalidRegistrationToken] for missing, already-consumed,
// expired, or revoked tokens. A consumed token is never re-applied, so the
// created account always keeps the password set on its first completion.
func (s *Service) CompleteRegistration(ctx context.Context, inp CompleteRegistrationInput) error {
	sum := HashStr(inp.Token)

	return s.transactor.Transact(ctx, func(ctx context.Context) error {
		regToken, err := s.authRepo.GetRegistrationToken(ctx, sum)
		if err != nil {
			// Mirror ResetPassword: an unknown token is an auth failure, not a 404.
			if errors.Is(err, apperr.ErrNotFound) {
				return ErrInvalidRegistrationToken
			}
			return err
		}

		// Consumed, expired, or superseded by a newer invitation.
		if !regToken.IsValid() {
			return ErrInvalidRegistrationToken
		}

		// Hash only after the token is confirmed usable so a garbage token
		// cannot force an expensive bcrypt on this unauthenticated route.
		passwordHash, err := HashPassword(inp.Password)
		if err != nil {
			return err
		}

		u, err := user.New(regToken.Name, regToken.Email, string(passwordHash))
		if err != nil {
			return err
		}

		if err := regToken.Use(); err != nil {
			return err
		}
		if err := s.authRepo.UpdateRegistrationToken(ctx, regToken); err != nil {
			return err
		}

		if err := s.userRepo.Store(ctx, u); err != nil {
			return err
		}

		return s.audit.Record(ctx, audit.Entry{
			Action:   ActionCompleteRegistration,
			Entity:   "user",
			EntityID: u.ID.String(),
			Next:     u,
		})
	})
}

// GetRegistrationToken looks up a registration token by its raw value so the
// completion form can show the invitee's status (expiry / already used).
func (s *Service) GetRegistrationToken(ctx context.Context, rawToken string) (*RegistrationToken, error) {
	sum := HashStr(rawToken)
	return s.authRepo.GetRegistrationToken(ctx, sum)
}

// Login is a method to authenticate the user, returning access token, refresh token, and error if any.
func (s *Service) Login(
	ctx context.Context,
	inp LoginInput,
) (*TokenPair, error) {
	attemptKey := loginAttemptKey(inp.Email)

	// Lockout check runs before any credential work. A locked account must not
	// cost a bcrypt compare, so the attacker cannot turn the lockout into CPU
	// load. A counter error is fail-open: a Redis outage must not lock everyone
	// out, mirroring the revocation store's default.
	if n, ttl, err := s.attempts.Count(ctx, attemptKey); err != nil {
		log.WarnCtx(ctx, "login attempt counter unavailable", "err", err)
	} else if n >= int64(s.cfg.Auth.LoginMaxAttempts) && ttl > 0 {
		log.WarnCtx(ctx, "login failed", "email", inp.Email, "reason", "account_locked")
		return nil, ErrAccountLocked.WithDetails(map[string]int64{
			"retry_after_seconds": int64(ttl.Seconds()),
		})
	}

	usr, err := s.userRepo.GetByEmail(ctx, inp.Email)
	if err != nil && !errors.Is(err, apperr.ErrNotFound) {
		// Surface real DB errors (e.g. outage) instead of masking them as 401.
		return nil, err
	}

	if usr == nil {
		// Unknown email: equalize timing with a dummy bcrypt compare so user
		// enumeration via response time is not possible. Logged, not audited —
		// this is a security event, and the email is attacker-supplied.
		DummyVerify()
		// Count unknown emails too, otherwise the lockout would itself leak
		// which addresses exist.
		s.countLoginFailure(ctx, attemptKey)
		log.WarnCtx(ctx, "login failed", "email", inp.Email, "reason", "unknown_email")
		return nil, ErrWrongCredentials
	}

	if err := VerifyPassword(inp.Password, usr.Password); err != nil {
		s.countLoginFailure(ctx, attemptKey)
		log.WarnCtx(ctx, "login failed",
			"email", inp.Email, "user_id", usr.ID.String(), "reason", "bad_password")
		return nil, err
	}

	// Correct credentials clear the failure window. Best-effort: a stale
	// counter only costs the user an earlier lockout, never a failed login.
	if err := s.attempts.Reset(ctx, attemptKey); err != nil {
		log.WarnCtx(ctx, "failed to reset login attempt counter", "err", err)
	}

	sess, refreshToken, err := NewSession(ctx, usr.ID, s.cfg.Auth.SessionTTL)
	if err != nil {
		return nil, err
	}

	accessToken, err := s.generateAccessToken(usr.ID, sess.ID, usr.Role)
	if err != nil {
		return nil, err
	}

	// Session and its audit record commit together, so a successful login is
	// never silently unaudited.
	if err := s.transactor.Transact(ctx, func(ctx context.Context) error {
		if err := s.authRepo.StoreSession(ctx, sess); err != nil {
			return err
		}
		return s.audit.Record(ctx, audit.Entry{
			Action:   ActionLogin,
			Entity:   "user",
			EntityID: usr.ID.String(),
			Meta:     map[string]any{"session_id": sess.ID.String()},
		})
	}); err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

// countLoginFailure records one failed attempt against key. A counter error is
// logged and ignored: losing a failure must not change the caller's answer.
func (s *Service) countLoginFailure(ctx context.Context, key string) {
	if _, _, err := s.attempts.Increment(ctx, key, s.cfg.Auth.LoginLockoutTTL); err != nil {
		log.WarnCtx(ctx, "failed to record login failure", "err", err)
	}
}

// RefreshAccessToken refresh access token. it will rotate the refresh token if refreshing success.
func (s *Service) RefreshAccessToken(
	ctx context.Context,
	refreshToken string,
) (*TokenPair, error) {
	sum := HashStr(refreshToken)

	tokenPair := new(TokenPair)
	err := s.transactor.Transact(ctx, func(ctx context.Context) error {
		sess, err := s.authRepo.GetSessionByRefreshTokenHash(ctx, sum)
		if err != nil {
			if errors.Is(err, apperr.ErrNotFound) {
				return ErrSessionInvalid
			}
			return err
		}

		if sess.IsExpired() {
			return ErrSessionInvalid
		}

		if sess.RevokedAt.NotNull() {
			// ponytail: logs reuse signal; full token-family/history tracking out of scope (no schema change)
			log.WarnCtx(
				ctx, "Refresh attempt against revoked session; possible token reuse",
				"user_id", sess.UserID.String(),
				"session_id", sess.ID.String(),
			)
			return ErrSessionInvalid
		}

		u, err := s.userRepo.GetByID(ctx, sess.UserID)
		if err != nil {
			return err
		}

		newAccessToken, err := s.generateAccessToken(sess.UserID, sess.ID, u.Role)
		if err != nil {
			return err
		}
		tokenPair.AccessToken = newAccessToken

		// Rotate refreshToken
		newRefreshToken, err := sess.Rotate(ctx)
		if err != nil {
			return err
		}
		tokenPair.RefreshToken = newRefreshToken

		// Save session changes
		return s.authRepo.UpdateSession(ctx, sess)
	})
	if err != nil {
		return nil, err
	}

	return tokenPair, nil
}

func (s *Service) Logout(ctx context.Context, sessID uuid.UUID) error {
	if err := s.transactor.Transact(ctx, func(ctx context.Context) error {
		session, err := s.authRepo.GetSessionByID(ctx, sessID)
		if err != nil {
			return err
		}

		if session.IsExpired() || session.RevokedAt.NotNull() {
			return nil
		}

		session.Revoke()

		if err := s.authRepo.UpdateSession(ctx, session); err != nil {
			return err
		}

		return s.audit.Record(ctx, audit.Entry{
			Action:   ActionLogout,
			Entity:   "user",
			EntityID: session.UserID.String(),
			Meta:     map[string]any{"session_id": sessID.String()},
		})
	}); err != nil {
		return err
	}

	// Best-effort: the session row is already revoked so refresh is dead even
	// if the access-token watermark write fails.
	cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()

	if err := s.revoker.RevokeSession(cleanupCtx, sessID); err != nil {
		log.WarnCtx(ctx, "failed to revoke session access tokens", err)
	}

	return nil
}

// RecoverPassword initiates the password recovery process by sending a reset link or token to the user's email.
func (s *Service) RecoverPassword(ctx context.Context, inp RecoverPasswordInput) (throttle.Result, error) {
	key := fmt.Sprintf("recover-password:%s", inp.Email)

	th, err := s.throttler.TryAcquire(ctx, key, PasswordRecoveryThrottledTTL)
	if err != nil {
		return th, err
	}

	if !th.Allowed {
		return th, ErrPasswordRecoveryThrottled.WithDetails(th)
	}

	err = s.transactor.Transact(ctx, func(ctx context.Context) error {
		usr, err := s.userRepo.GetByEmail(ctx, inp.Email)
		if err != nil {
			return err
		}

		tokenObj, tokenRaw, err := NewPasswordRecoveryToken(usr.ID, s.cfg.Auth.PasswordRecoveryTokenTTL)
		if err != nil {
			log.ErrorCtx(ctx, "Failed to create reset password token", err)
			return err
		}

		// Save token to db
		if err := s.authRepo.StorePasswordRecoveryToken(ctx, tokenObj); err != nil {
			return err
		}

		// Token, its audit record, and the email event commit together; the
		// event is enqueued in the same transaction.
		if err := s.audit.Record(ctx, audit.Entry{
			Action:   ActionRecoverPassword,
			Entity:   "user",
			EntityID: usr.ID.String(),
		}); err != nil {
			return err
		}

		return s.eventProducer.ProducePasswordRecoveryEvent(ctx, PasswordRecoveryMessage{
			To:       usr.Email,
			Name:     usr.Name,
			ResetURL: s.cfg.Auth.ResetPasswordFormEndpoint + "?token=" + tokenRaw,
			Expiry:   s.cfg.Auth.PasswordRecoveryTokenTTL,
		})
	})
	if err != nil {
		// Release the slot on internal failures so a transient error does not
		// lock the user out for the full TTL. An unknown email stays throttled:
		// releasing it would re-open enumeration probing (see README).
		if !errors.Is(err, apperr.ErrNotFound) {
			if rerr := s.throttler.Release(ctx, key); rerr != nil {
				log.WarnCtx(ctx, "failed to release recovery throttle", rerr)
			}
		}
		return th, err
	}

	return th, nil
}

func (s *Service) GetPasswordRecoveryToken(
	ctx context.Context,
	token string,
) (*PasswordRecoveryToken, error) {
	sum := HashStr(token)
	return s.authRepo.GetPasswordRecoveryToken(ctx, sum)
}

// ResetPassword resets a user's password using a valid password recovery token from email.
func (s *Service) ResetPassword(ctx context.Context, inp ResetPasswordInput) error {
	sum := HashStr(inp.Token)

	var revokedUserID uuid.UUID
	if err := s.transactor.Transact(ctx, func(ctx context.Context) error {
		token, err := s.authRepo.GetPasswordRecoveryToken(ctx, sum)
		if err != nil {
			if errors.Is(err, apperr.ErrNotFound) {
				return ErrInvalidPasswordRecoveryToken
			}
			return err
		}

		if token.Expired() || token.IsUsed() {
			return ErrInvalidPasswordRecoveryToken
		}

		user, err := s.userRepo.GetByID(ctx, token.UserID)
		if err != nil {
			return err
		}

		newHashedPassword, err := HashPassword(inp.NewPassword)
		if err != nil {
			log.ErrorCtx(ctx, "Failed to hash new password", err)
			return err
		}
		user.Password = string(newHashedPassword)
		revokedUserID = user.ID

		token.Use()
		if err := s.authRepo.UpdatePasswordRecoveryToken(ctx, token); err != nil {
			return err
		}

		if err := s.userRepo.Update(ctx, user); err != nil {
			return err
		}

		if err := s.authRepo.RevokeUserSessions(ctx, user.ID); err != nil {
			return err
		}

		return s.audit.Record(ctx, audit.Entry{
			Action:   ActionResetPassword,
			Entity:   "user",
			EntityID: user.ID.String(),
		})
	}); err != nil {
		return err
	}

	// Session rows are already revoked, so refresh is dead. Also watermark
	// stateless access tokens; a write failure must not turn a completed
	// password change into a 500.
	cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if err := s.revoker.RevokeAllForUser(cleanupCtx, revokedUserID); err != nil {
		log.ErrorCtx(ctx, "Failed to revoke user access tokens after password reset", err)
	}

	return nil
}

// RequestEmailChange starts an email change: a confirmation link is sent to the
// requested new address. The authenticated user is identified by userID, never
// by the email in the payload.
// Returns [user.ErrEmailConflict] if the new email is already registered.
func (s *Service) RequestEmailChange(
	ctx context.Context,
	userID uuid.UUID,
	inp RequestEmailChangeInput,
) (throttle.Result, error) {
	key := fmt.Sprintf("change-email:%s", userID)

	th, err := s.throttler.TryAcquire(ctx, key, EmailChangeThrottledTTL)
	if err != nil {
		return th, err
	}

	if !th.Allowed {
		return th, ErrEmailChangeThrottled.WithDetails(th)
	}

	err = s.transactor.Transact(ctx, func(ctx context.Context) error {
		usr, err := s.userRepo.GetByID(ctx, userID)
		if err != nil {
			return err
		}

		existing, err := s.userRepo.GetByEmail(ctx, inp.NewEmail)
		if err != nil && !errors.Is(err, apperr.ErrNotFound) {
			return fmt.Errorf("looking up user by email: %w", err)
		}
		if existing != nil {
			return user.ErrEmailConflict
		}

		// A new request supersedes any outstanding one for that address, so a
		// re-request invalidates the previous link (latest request wins).
		if err := s.authRepo.RevokeEmailChangeTokens(ctx, inp.NewEmail); err != nil {
			return fmt.Errorf("revoking previous email change tokens: %w", err)
		}

		tokenObj, tokenRaw, err := NewEmailChangeToken(usr.ID, inp.NewEmail, s.cfg.Auth.EmailChangeTokenTTL)
		if err != nil {
			log.ErrorCtx(ctx, "Failed to create email change token", err)
			return err
		}

		if err := s.authRepo.StoreEmailChangeToken(ctx, tokenObj); err != nil {
			return err
		}

		// Token, its audit record, and the email event commit together; the
		// event is enqueued in the same transaction.
		if err := s.audit.Record(ctx, audit.Entry{
			Action:   ActionRequestEmailChange,
			Entity:   "user",
			EntityID: usr.ID.String(),
		}); err != nil {
			return err
		}

		return s.eventProducer.ProduceEmailChangeEvent(ctx, EmailChangeMessage{
			To:       inp.NewEmail,
			Name:     usr.Name,
			NewEmail: inp.NewEmail,
			URL:      s.cfg.Auth.ConfirmEmailChangeFormEndpoint + "?token=" + tokenRaw,
			Expiry:   s.cfg.Auth.EmailChangeTokenTTL,
		})
	})
	if err != nil {
		// Release the slot on internal failures so a transient error does not
		// lock the user out for the full TTL.
		if !errors.Is(err, apperr.ErrNotFound) {
			if rerr := s.throttler.Release(ctx, key); rerr != nil {
				log.WarnCtx(ctx, "failed to release email change throttle", rerr)
			}
		}
		return th, err
	}

	return th, nil
}

// ConfirmEmailChange applies a requested email change using the token sent to
// the new address.
//
// Returns [ErrInvalidEmailChangeToken] for missing, already-consumed, or
// expired tokens.
func (s *Service) ConfirmEmailChange(ctx context.Context, inp ConfirmEmailChangeInput) error {
	sum := HashStr(inp.Token)

	var revokedUserID uuid.UUID
	if err := s.transactor.Transact(ctx, func(ctx context.Context) error {
		token, err := s.authRepo.GetEmailChangeToken(ctx, sum)
		if err != nil {
			if errors.Is(err, apperr.ErrNotFound) {
				return ErrInvalidEmailChangeToken
			}
			return err
		}

		if token.Expired() || token.IsUsed() {
			return ErrInvalidEmailChangeToken
		}

		usr, err := s.userRepo.GetByID(ctx, token.UserID)
		if err != nil {
			return err
		}

		// The address may have been claimed since the request was made.
		existing, err := s.userRepo.GetByEmail(ctx, token.NewEmail)
		if err != nil && !errors.Is(err, apperr.ErrNotFound) {
			return fmt.Errorf("looking up user by email: %w", err)
		}
		if existing != nil {
			return user.ErrEmailConflict
		}

		usr.Email = token.NewEmail
		revokedUserID = usr.ID

		token.Use()
		if err := s.authRepo.UpdateEmailChangeToken(ctx, token); err != nil {
			return err
		}

		if err := s.userRepo.Update(ctx, usr); err != nil {
			return err
		}

		// Email change is a credential change: every session dies with it.
		if err := s.authRepo.RevokeUserSessions(ctx, usr.ID); err != nil {
			return err
		}

		return s.audit.Record(ctx, audit.Entry{
			Action:   ActionConfirmEmailChange,
			Entity:   "user",
			EntityID: usr.ID.String(),
		})
	}); err != nil {
		return err
	}

	// Session rows are already revoked, so refresh is dead. Also watermark
	// stateless access tokens; a write failure must not turn a completed
	// email change into a 500.
	cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if err := s.revoker.RevokeAllForUser(cleanupCtx, revokedUserID); err != nil {
		log.ErrorCtx(ctx, "Failed to revoke user access tokens after email change", err)
	}

	return nil
}

// ChangePassword updates the authenticated user's password after verifying the current password.
func (s *Service) ChangePassword(
	ctx context.Context,
	userID uuid.UUID,
	inp ChangePasswordInput,
) error {
	if err := s.authorizer.RequireSelfOr(ctx, userID, PermChangePassword); err != nil {
		return err
	}

	usr, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	// Verify old password
	if err := VerifyPassword(inp.Password, usr.Password); err != nil {
		return err
	}

	// Hash new password
	newHashedPassword, err := HashPassword(inp.NewPassword)
	if err != nil {
		return err
	}

	usr.Password = string(newHashedPassword)

	if err := s.transactor.Transact(ctx, func(ctx context.Context) error {
		if err := s.userRepo.Update(ctx, usr); err != nil {
			return err
		}
		// ponytail: revokes ALL sessions incl. current; pass current sessID to exempt if desired
		if err := s.authRepo.RevokeUserSessions(ctx, userID); err != nil {
			return err
		}

		return s.audit.Record(ctx, audit.Entry{
			Action:   ActionChangePassword,
			Entity:   "user",
			EntityID: userID.String(),
		})
	}); err != nil {
		return err
	}

	// Session rows are already revoked, so refresh is dead. Also watermark
	// stateless access tokens; a write failure must not turn a completed
	// password change into a 500.
	cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if err := s.revoker.RevokeAllForUser(cleanupCtx, userID); err != nil {
		log.ErrorCtx(ctx, "Failed to revoke user access tokens after password change", err)
	}

	return nil
}

func (s *Service) ListUserSessions(ctx context.Context, userID uuid.UUID) ([]Session, error) {
	if err := s.authorizer.RequireSelfOr(ctx, userID, PermViewUserSessions); err != nil {
		return nil, err
	}
	return s.authRepo.ListSessions(ctx, userID)
}

// RevokeUserSessions revokes every persisted session and stateless access token
// belonging to userID. It is the admin escape hatch for a compromised account,
// so unlike the password flows it returns an error when the access-token
// watermark cannot be written.
func (s *Service) RevokeUserSessions(ctx context.Context, userID uuid.UUID) error {
	if err := s.authorizer.Require(ctx, PermRevokeUserSessions); err != nil {
		return err
	}

	if err := s.transactor.Transact(ctx, func(ctx context.Context) error {
		if err := s.authRepo.RevokeUserSessions(ctx, userID); err != nil {
			return err
		}

		return s.audit.Record(ctx, audit.Entry{
			Action:   ActionRevokeUserSessions,
			Entity:   "user",
			EntityID: userID.String(),
		})
	}); err != nil {
		return err
	}

	cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if err := s.revoker.RevokeAllForUser(cleanupCtx, userID); err != nil {
		return err
	}

	return nil
}

// RevokeSession revokes a single session by id. The caller may revoke their own
// session; a role holding auth.revoke-user-session may revoke any session.
func (s *Service) RevokeSession(ctx context.Context, sessionID uuid.UUID) error {
	if err := s.transactor.Transact(ctx, func(ctx context.Context) error {
		sess, err := s.authRepo.GetSessionByID(ctx, sessionID)
		if err != nil {
			return err
		}

		// Authorize against the SESSION OWNER's id, never one supplied by the
		// request, so a plain user cannot revoke someone else's session.
		if err := s.authorizer.RequireSelfOr(ctx, sess.UserID, PermRevokeUserSessions); err != nil {
			return err
		}

		if sess.IsExpired() || sess.RevokedAt.NotNull() {
			return nil
		}

		sess.Revoke()

		if err := s.authRepo.UpdateSession(ctx, sess); err != nil {
			return err
		}

		return s.audit.Record(ctx, audit.Entry{
			Action:   ActionRevokeSession,
			Entity:   "session",
			EntityID: sessionID.String(),
		})
	}); err != nil {
		return err
	}

	// The session row is already revoked, so refresh is dead; denylist the
	// stateless access token too, and surface a failure since this endpoint
	// exists to guarantee revocation.
	cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if err := s.revoker.RevokeSession(cleanupCtx, sessionID); err != nil {
		log.ErrorCtx(ctx, "Failed to revoke session access tokens", err)
		return err
	}

	return nil
}

func (s *Service) ListPermission(ctx context.Context) ([]rbac.Permission, error) {
	return s.authorizer.ListPermission(ctx)
}

func (s *Service) generateAccessToken(userID, sessID uuid.UUID, role rbac.Role) (string, error) {
	return SignAccessToken(s.cfg.Auth.JwtSecret, s.cfg.Auth.JwtTTL, userID, sessID, role)
}
