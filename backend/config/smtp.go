package config

import (
	"os"
	"strconv"
)

type SMTP struct {
	Host         string
	Port         int
	SenderName   string
	AuthEmail    string
	AuthPassword string
}

func (s *SMTP) Parse() error {
	s.Host = os.Getenv("SMTP_HOST")
	s.SenderName = os.Getenv("SMTP_SENDER_NAME")
	s.AuthEmail = os.Getenv("SMTP_AUTH_EMAIL")
	s.AuthPassword = os.Getenv("SMTP_AUTH_PASSWORD")

	if val := os.Getenv("SMTP_PORT"); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			s.Port = i
		}
	}
	return nil
}
