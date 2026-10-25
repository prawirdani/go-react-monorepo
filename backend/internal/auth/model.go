// Package auth provides authentication and authorization functionality.
// This package handles user authentication through sessions, access tokens, and
// password management including secure hashing and password reset flows. It manages
// the complete authentication lifecycle from login through logout, including token
// generation, validation, and session management.
package auth

import (
	"time"
)

// RegisterInput starts the invitation flow: an email is sent with a link to
// complete registration. The password is chosen later via CompleteRegistrationInput.
type RegisterInput struct {
	Name  string `json:"name"  validate:"required,min=3,max=100"`
	Email string `json:"email" validate:"required,email,max=254"`
}

// CompleteRegistrationInput finishes an invited registration by consuming the
// emailed token and setting the account password.
type CompleteRegistrationInput struct {
	Token    string `json:"token"    validate:"required"`
	Password string `json:"password" validate:"required,min=8,max=72"`
}

type LoginInput struct {
	Email    string `json:"email"    validate:"required,email,max=254"`
	Password string `json:"password" validate:"required"`
}

type RecoverPasswordInput struct {
	Email string `json:"email" validate:"required,email,max=254"`
}

type ResetPasswordInput struct {
	Token       string `json:"token"        validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8,max=72"`
}

type RequestEmailChangeInput struct {
	NewEmail string `json:"new_email" validate:"required,email,max=254"`
}

type ConfirmEmailChangeInput struct {
	Token string `json:"token" validate:"required"`
}

// TokenStatusInput carries an opaque one-time token in a request body instead
// of the URL, so it is never written to a server access log.
type TokenStatusInput struct {
	Token string `json:"token" validate:"required"`
}

type ChangePasswordInput struct {
	Password    string `json:"password"     validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8,max=72"`
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

// PasswordRecoveryMessage is payload shape for the password recovery outbox job
type PasswordRecoveryMessage struct {
	To       string        `json:"to"`         // Recipient's email address
	Name     string        `json:"name"`       // Recipient's name
	ResetURL string        `json:"reset_url"`  // Link for resetting the password
	Expiry   time.Duration `json:"expiry_min"` // Expiration time of the reset token in minutes
}

// EmailChangeMessage is payload shape for the email change outbox job
type EmailChangeMessage struct {
	To       string        `json:"to"`         // Recipient's new email address
	Name     string        `json:"name"`       // Recipient's name
	NewEmail string        `json:"new_email"`  // Address being confirmed
	URL      string        `json:"url"`        // Link for confirming the email change
	Expiry   time.Duration `json:"expiry_min"` // Expiration time of the token in minutes
}

// CompleteRegistrationMessage is payload shape for the registration completion outbox job
type CompleteRegistrationMessage struct {
	To     string        `json:"to"`         // Recipient's email address
	Name   string        `json:"name"`       // Recipient's name
	URL    string        `json:"url"`        // Link for completing registration (password creation form)
	Expiry time.Duration `json:"expiry_min"` // Expiration time of the token in minutes
}
