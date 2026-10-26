// Package user provides the data model and business logic for managing users in system.
package user

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/prawirdani/go-react-monorepo/internal/apperr"
	"github.com/prawirdani/go-react-monorepo/internal/audit"
	"github.com/prawirdani/go-react-monorepo/internal/ports/repository"
	"github.com/prawirdani/go-react-monorepo/internal/ports/revocation"
	"github.com/prawirdani/go-react-monorepo/internal/ports/storage"
	"github.com/prawirdani/go-react-monorepo/internal/rbac"
	"github.com/prawirdani/go-react-monorepo/pkg/log"
)

// Authorization vocabulary for the user entity. Permissions (coarse gates) and
// audit Actions (fine-grained events) share the "<entity>.<verb>[-<object>]"
// grammar. Each Action is gated by the permission carrying its coarse verb, so
// they are declared side by side to keep the two layers aligned.
//
// Only permissions with an enforcement point are declared. User creation is
// gated in the auth domain (auth.register-user), so there is no user.create
// here.
const (
	PermRead    rbac.Permission = "user.read"
	PermUpdate  rbac.Permission = "user.update"
	PermDelete  rbac.Permission = "user.delete"
	PermRestore rbac.Permission = "user.restore"

	// Update-class actions, all gated by PermUpdate.
	ActionUpdate               audit.Action = "user.update"
	ActionDelete               audit.Action = "user.delete"
	ActionRestore              audit.Action = "user.restore"
	ActionChangeProfilePicture audit.Action = "user.change-profile-picture"
	ActionDeleteProfilePicture audit.Action = "user.delete-profile-picture"
)

var permTables = rbac.PermissionTable{
	rbac.RoleSystem: {PermRead: {}, PermUpdate: {}, PermDelete: {}, PermRestore: {}},
	rbac.RoleAdmin:  {PermRead: {}, PermUpdate: {}, PermDelete: {}, PermRestore: {}},
	rbac.RoleUser:   {}, // Self read and update through authorize.SelfOr
}

// SessionRevoker revokes a user's persisted sessions. Implemented by the auth
// repository; declared here so the user service can revoke sessions inside its
// own transaction without depending on the auth package.
type SessionRevoker interface {
	// RevokeUserSessions revokes all active sessions belonging to userID.
	RevokeUserSessions(ctx context.Context, userID uuid.UUID) error
}

type Service struct {
	transactor     repository.Transactor
	userRepo       Repository
	imageStorage   storage.Storage
	authorizer     rbac.Authorizer
	audit          audit.Recorder
	sessionRevoker SessionRevoker
	revoker        revocation.Revoker
}

func NewService(
	transactor repository.Transactor,
	userRepo Repository,
	imageStorage storage.Storage,
	authorizer rbac.Authorizer,
	auditRecorder audit.Recorder,
	sessionRevoker SessionRevoker,
	revoker revocation.Revoker,
) *Service {
	authorizer.RegisterPermissions(permTables)

	return &Service{
		transactor:     transactor,
		userRepo:       userRepo,
		imageStorage:   imageStorage,
		authorizer:     authorizer,
		audit:          auditRecorder,
		sessionRevoker: sessionRevoker,
		revoker:        revoker,
	}
}

func (s *Service) ListUser(ctx context.Context, search *Search) ([]User, error) {
	if err := s.authorizer.Require(ctx, PermRead); err != nil {
		return nil, err
	}
	return s.userRepo.List(ctx, search)
}

func (s *Service) GetUserByID(ctx context.Context, userID uuid.UUID) (*User, error) {
	if err := s.authorizer.RequireSelfOr(ctx, userID, PermRead); err != nil {
		return nil, err
	}

	usr, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return usr, nil
}

func (s *Service) GetUserByEmail(ctx context.Context, email string) (*User, error) {
	usr, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	if err := s.authorizer.RequireSelfOr(ctx, usr.ID, PermRead); err != nil {
		return nil, err
	}

	return usr, nil
}

// UpdateUser updates basic user's data (name and phone)
func (s *Service) UpdateUser(ctx context.Context, userID uuid.UUID, input UpdateUserInput) error {
	if err := s.authorizer.RequireSelfOr(ctx, userID, PermUpdate); err != nil {
		return err
	}
	return s.transactor.Transact(ctx, func(ctx context.Context) error {
		usr, err := s.userRepo.GetByID(ctx, userID)
		if err != nil {
			return err
		}
		prev := *usr // snapshot before mutation

		usr.Name = input.Name
		usr.Phone.Set(input.Phone, false)
		usr.Gender.Set(Gender(strings.ToUpper(input.Gender)), false)

		if err := usr.Validate(); err != nil {
			return err
		}

		if err := s.userRepo.Update(ctx, usr); err != nil {
			return err
		}

		return s.audit.Record(ctx, audit.Entry{
			Action:   ActionUpdate,
			Entity:   "user",
			EntityID: userID.String(),
			Prev:     prev,
			Next:     *usr,
		})
	})
}

func (s *Service) DeleteUser(ctx context.Context, userID uuid.UUID) error {
	if err := s.authorizer.Require(ctx, PermDelete); err != nil {
		return err
	}

	// The not-found path is idempotent: it skips session rows (nothing to
	// revoke) but still writes the access-token watermark below.
	err := s.transactor.Transact(ctx, func(ctx context.Context) error {
		usr, err := s.userRepo.GetByID(ctx, userID)
		if err != nil {
			// Idempotent
			if errors.Is(err, apperr.ErrNotFound) {
				return nil
			}
			return err
		}

		if err := s.userRepo.Delete(ctx, usr); err != nil {
			return err
		}

		// Repository joins this transaction via db.GetConn; persisting the
		// revocation makes a committed delete never leave sessions alive.
		if err := s.sessionRevoker.RevokeUserSessions(ctx, userID); err != nil {
			return err
		}

		return s.audit.Record(ctx, audit.Entry{
			Action:   ActionDelete,
			Entity:   "user",
			EntityID: usr.ID.String(),
			Prev:     nil,
			Next:     nil,
		})
	})
	if err != nil {
		return err
	}

	// Watermark stateless access tokens after the DB commit. This also runs on
	// the idempotent not-found path: a retry after a failed post-commit write
	// must converge and revoke the pre-delete access tokens. Unlike the session
	// rows this is the only record that access-token revocation happened, so its
	// failure is surfaced to the caller (the deletion itself stands).
	logger := log.GetFromContext(ctx).With("user_id", userID.String())
	cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()

	if err := s.revoker.RevokeAllForUser(cleanupCtx, userID); err != nil {
		logger.Error("failed to revoke user access tokens", err)
		return err
	}

	return nil
}

// RestoreUser clears a user's soft-delete marker. It is the inverse of
// [Service.DeleteUser] but has its own admin-only permission (PermRestore):
// restoring is never self-serve, so there is no RequireSelfOr path.
func (s *Service) RestoreUser(ctx context.Context, userID uuid.UUID) error {
	if err := s.authorizer.Require(ctx, PermRestore); err != nil {
		return err
	}

	return s.transactor.Transact(ctx, func(ctx context.Context) error {
		if err := s.userRepo.Restore(ctx, userID); err != nil {
			return err
		}

		// No prev/next snapshot: the restore only clears deleted_at.
		return s.audit.Record(ctx, audit.Entry{
			Action:   ActionRestore,
			Entity:   "user",
			EntityID: userID.String(),
		})
	})
}

func (s *Service) ChangeProfilePicture(
	ctx context.Context,
	userID uuid.UUID,
	file storage.File,
) error {
	if err := s.authorizer.RequireSelfOr(ctx, userID, PermUpdate); err != nil {
		return err
	}

	if err := file.SetName(uuid.NewString()); err != nil {
		return err
	}
	newImageName := file.Name()
	newImagePath := s.buildImagePath(newImageName)

	if err := s.imageStorage.Put(ctx, newImagePath, file, file.ContentType()); err != nil {
		return err
	}

	// Swap only the DB reference. The previous object stays in the bucket (and a
	// failed swap leaves the new one there too), so a restored snapshot still
	// resolves the image it recorded. Stray objects are accepted.
	return s.transactor.Transact(ctx, func(ctx context.Context) error {
		u, err := s.userRepo.GetByID(ctx, userID)
		if err != nil {
			return err
		}
		prev := *u

		u.ProfilePicture.Set(newImageName, false)
		if err := s.userRepo.Update(ctx, u); err != nil {
			return err
		}

		return s.audit.Record(ctx, audit.Entry{
			Action:   ActionChangeProfilePicture,
			Entity:   "user",
			EntityID: userID.String(),
			Prev:     prev,
			Next:     *u,
		})
	})
}

func (s *Service) DeleteProfilePicture(ctx context.Context, userID uuid.UUID) error {
	if err := s.authorizer.RequireSelfOr(ctx, userID, PermUpdate); err != nil {
		return err
	}

	// Only the DB reference is cleared: the object stays in the bucket so a
	// restored backup snapshot still resolves its profile picture.
	return s.transactor.Transact(ctx, func(ctx context.Context) error {
		u, err := s.userRepo.GetByID(ctx, userID)
		if err != nil {
			return err
		}

		if !u.ProfilePicture.NotNull() {
			return nil
		}
		prev := *u

		u.ProfilePicture.Set("", false)

		if err := s.userRepo.Update(ctx, u); err != nil {
			return err
		}

		return s.audit.Record(ctx, audit.Entry{
			Action:   ActionDeleteProfilePicture,
			Entity:   "user",
			EntityID: userID.String(),
			Prev:     prev,
			Next:     *u,
		})
	})
}

const ImageStoragePath = "profiles"

func (s *Service) buildImagePath(imageName string) string {
	return fmt.Sprintf("%s/%s", ImageStoragePath, imageName)
}
