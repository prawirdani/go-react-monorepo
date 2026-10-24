package http

import (
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/prawirdani/go-react-monorepo/config"
)

func NewRouter(cfg *config.Config) *fiber.App {
	router := fiber.New(fiber.Config{
		EnableSplittingOnParsers: true, // Enable comma separated for multiple query param values
		// Trust is gated on TRUST_PROXY, not an address list. When off (a
		// directly-exposed API), IsProxyTrusted() is false and c.IP() returns the
		// socket peer - a real IP that sessions.ip_addr (INET NOT NULL) accepts.
		// When on, the peer class below is trusted instead of a baked-in CIDR, so
		// the same build works behind a sidecar container or a host nginx.
		TrustProxy: cfg.Proxy.Trust,
		TrustProxyConfig: fiber.TrustProxyConfig{
			Loopback:   true, // host nginx on 127.0.0.1
			Private:    true, // sidecar proxy on the Docker bridge (RFC1918)
			UnixSocket: true, // host nginx over a unix socket
		},
		// Required: with validation off, c.IP() returns the raw header string and
		// net.ParseIP yields nil the moment a proxy appends. On, c.IP() walks
		// X-Forwarded-For right-to-left and returns the rightmost non-trusted IP,
		// so a client-forged leftmost entry is skipped. Inert when TrustProxy is off.
		EnableIPValidation: true,
		ProxyHeader:        fiber.HeaderXForwardedFor,
		BodyLimit:          MaxBodySize,
		ErrorHandler: func(c fiber.Ctx, err error) error {
			e := ParseError(err)
			err = c.Status(e.status).JSON(map[string]any{"error": e})
			if err != nil {
				return c.Status(fiber.StatusInternalServerError).SendString("Internal server error")
			}
			return nil
		},
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	})

	return router
}
