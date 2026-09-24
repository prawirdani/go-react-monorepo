package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/prawirdani/golang-restapi/config"
	"github.com/prawirdani/golang-restapi/internal/auth"
	"github.com/prawirdani/golang-restapi/internal/infrastructure/postgres"
	"github.com/prawirdani/golang-restapi/internal/ports/outbox"
	"github.com/prawirdani/golang-restapi/internal/worker"
	"github.com/prawirdani/golang-restapi/pkg/log"
	"github.com/prawirdani/golang-restapi/pkg/mailer"
)

func main() {
	if err := run(); err != nil {
		log.Error("Application stopped", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.LoadConfig()
	if err != nil {
		return fmt.Errorf("load config: %w", err)
	}

	log.SetLogger(log.NewZerologAdapter(cfg.IsProduction()))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pg, err := postgres.NewWorker(cfg.Postgres)
	if err != nil {
		return fmt.Errorf("connect to postgres: %w", err)
	}
	defer pg.Close()

	authWorker := worker.NewAuthWorker(mailer.New(cfg.SMTP))

	handlers := map[string]worker.Handler{
		outbox.TopicPasswordRecovery: func(ctx context.Context, payload []byte) error {
			var msg auth.PasswordRecoveryMessage
			if err := json.Unmarshal(payload, &msg); err != nil {
				return fmt.Errorf("decode password recovery message: %w", err)
			}
			return authWorker.SendPasswordRecoveryEmail(ctx, msg)
		},
		outbox.TopicUserRegistration: func(ctx context.Context, payload []byte) error {
			var msg auth.CompleteRegistrationMessage
			if err := json.Unmarshal(payload, &msg); err != nil {
				return fmt.Errorf("decode complete registration message: %w", err)
			}
			return authWorker.SendCompleteRegistrationEmail(ctx, msg)
		},
	}

	wrk := worker.NewOutboxWorker(postgres.NewOutboxRepository(pg), handlers)

	return wrk.Start(ctx)
}
