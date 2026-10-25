package config

import (
	"os"
	"strconv"
	"strings"
)

type Cors struct {
	Origins     []string
	Credentials bool
}

func (c *Cors) Parse() error {
	if val := os.Getenv("CORS_ORIGINS"); val != "" {
		c.Origins = strings.Split(val, ",")
	}
	if val := os.Getenv("CORS_CREDENTIALS"); val != "" {
		if b, err := strconv.ParseBool(val); err == nil {
			c.Credentials = b
		}
	}
	return nil
}
