package http

import (
	"fmt"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/prawirdani/go-react-monorepo/internal/ports/throttle"
	"github.com/prawirdani/go-react-monorepo/internal/rbac"
	"github.com/prawirdani/go-react-monorepo/pkg/log"
)

// RateLimiter builds fixed-window rate-limit middleware backed by a shared
// [throttle.Counter] (Redis), so a request budget holds across every API
// instance instead of per process. The in-memory alternative multiplied the
// real limit by the replica count.
type RateLimiter struct {
	counter throttle.Counter
}

func NewRateLimiter(counter throttle.Counter) *RateLimiter {
	return &RateLimiter{counter: counter}
}

// IP limits by client address. It is the only identity an unauthenticated route
// has, so it guards request volume rather than a single account — many users
// behind one CGNAT address (common with Indonesian ISPs) share this budget, so
// keep max generous here and rely on the per-account throttles in the auth
// service (per-email login lockout and recovery throttle) for targeted abuse.
func (rl *RateLimiter) IP(scope string, max int, window time.Duration) fiber.Handler {
	return rl.limit(scope, max, window, func(c fiber.Ctx) string {
		return "ip:" + c.IP()
	})
}

// User limits by authenticated user id, so one user on a shared ISP address
// cannot exhaust another's budget and vice versa. It must run only after the
// authenticator has verified the token and injected the rbac context; an
// unauthenticated request (no actor) falls back to the client IP, which is
// harmless because the authenticator rejects those with 401 first.
func (rl *RateLimiter) User(scope string, max int, window time.Duration) fiber.Handler {
	return rl.limit(scope, max, window, func(c fiber.Ctx) string {
		if rbacCtx, err := rbac.GetContext(c.Context()); err == nil && rbacCtx.Actor.UserID != nil {
			return "uid:" + rbacCtx.Actor.UserID.String()
		}
		return "ip:" + c.IP()
	})
}

func (rl *RateLimiter) limit(
	scope string,
	max int,
	window time.Duration,
	keyFn func(fiber.Ctx) string,
) fiber.Handler {
	return func(c fiber.Ctx) error {
		key := fmt.Sprintf("ratelimit:%s:%s", scope, keyFn(c))

		n, ttl, err := rl.counter.Increment(c.Context(), key, window)
		if err != nil {
			// Fail open: the counter contract treats an error as "state unknown",
			// and rate limiting is volume protection, not authorization, so a
			// Redis blip must not take the whole API down. Log and allow.
			log.WarnCtx(c.Context(), "rate limiter unavailable, allowing request", err)
			return c.Next()
		}

		remaining := max - int(n)
		if remaining < 0 {
			remaining = 0
		}
		c.Set("X-RateLimit-Limit", strconv.Itoa(max))
		c.Set("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Set("X-RateLimit-Reset", strconv.FormatInt(int64(ttl.Seconds()), 10))

		if int(n) > max {
			c.Set("Retry-After", strconv.FormatInt(int64(ttl.Seconds()), 10))
			return ErrRateLimit
		}

		return c.Next()
	}
}
