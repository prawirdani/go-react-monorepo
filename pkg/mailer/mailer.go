package mailer

import (
	"bytes"
	"errors"
	"fmt"
	"time"

	"github.com/prawirdani/go-react-monorepo/config"
	"gopkg.in/gomail.v2"
)

// sendTimeout bounds the SMTP dial+send so a hung mail server can't wedge a
// worker goroutine (and by extension graceful shutdown) forever.
const sendTimeout = 10 * time.Second

// ErrSendTimeout is returned when DialAndSend does not finish within sendTimeout.
var ErrSendTimeout = errors.New("mail send timed out")

type HeaderParams struct {
	To      []string
	Cc      []string
	Subject string
}

type Mailer struct {
	Templates  *Templates
	dialer     *gomail.Dialer
	senderName string
}

func New(cfg config.SMTP) *Mailer {
	dialer := gomail.NewDialer(
		cfg.Host,
		cfg.Port,
		cfg.AuthEmail,
		cfg.AuthPassword,
	)

	templates := parseTemplates()

	return &Mailer{
		dialer:     dialer,
		Templates:  templates,
		senderName: cfg.SenderName,
	}
}

func (m *Mailer) Send(headerParams HeaderParams, body bytes.Buffer) error {
	mail := m.createHeader(headerParams)
	mail.SetBody("text/html", body.String())

	// gomail v2.0.0-2016 only bounds the TCP dial (hardcoded 10s); the SMTP
	// conversation (EHLO/AUTH/MAIL/DATA) is unbounded, so a hung server could
	// block this goroutine forever. Bound the whole send instead.
	errCh := make(chan error, 1)
	go func() { errCh <- m.dialer.DialAndSend(mail) }()

	select {
	case err := <-errCh:
		if err != nil {
			return fmt.Errorf("failed to send mail: %w", err)
		}
		return nil
	case <-time.After(sendTimeout):
		// ponytail: the stuck goroutine leaks until its conn eventually errors
		// or closes — bounded per message, so shutdown can't wedge. Fix: upgrade
		// gomail (newer versions expose a Dialer.Timeout) or use net/smtp with
		// explicit conn deadlines.
		return fmt.Errorf("failed to send mail: %w", ErrSendTimeout)
	}
}

func (m *Mailer) createHeader(params HeaderParams) *gomail.Message {
	mail := gomail.NewMessage()

	mail.SetHeader("From", m.senderName)
	mail.SetHeader("To", params.To...)
	mail.SetHeader("Cc", params.Cc...)
	mail.SetHeader("Subject", params.Subject)

	return mail
}
