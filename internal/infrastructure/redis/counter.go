package redis

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// counterPrefix namespaces counters so they cannot collide with other keys.
// The caller builds the rest of the key (its own namespace), keeping this
// implementation generic.
const counterPrefix = "counter:"

// Counter implements [throttle.Counter] on Redis.
type Counter struct {
	client *redis.Client
}

func NewCounter(client *redis.Client) *Counter {
	return &Counter{
		client: client,
	}
}

func (c *Counter) Count(
	ctx context.Context,
	key string,
) (int64, time.Duration, error) {
	if key == "" {
		return 0, 0, errors.New("counter key cannot be empty")
	}
	key = counterPrefix + key

	n, err := c.client.Get(ctx, key).Int64()
	if errors.Is(err, redis.Nil) {
		return 0, 0, nil
	}
	if err != nil {
		return 0, 0, fmt.Errorf("get counter: %w", err)
	}

	ttl, err := c.client.TTL(ctx, key).Result()
	if err != nil {
		return 0, 0, fmt.Errorf("get counter TTL: %w", err)
	}
	// TTL reports -1 (no expiry) or -2 (missing key); both mean no window left.
	if ttl < 0 {
		ttl = 0
	}

	return n, ttl, nil
}

func (c *Counter) Increment(
	ctx context.Context,
	key string,
	ttl time.Duration,
) (int64, time.Duration, error) {
	if key == "" {
		return 0, 0, errors.New("counter key cannot be empty")
	}
	if ttl <= 0 {
		return 0, 0, errors.New("counter TTL must be greater than zero")
	}
	key = counterPrefix + key

	n, err := c.client.Incr(ctx, key).Result()
	if err != nil {
		return 0, 0, fmt.Errorf("increment counter: %w", err)
	}

	// ExpireNX only arms the window when the key has none yet, so a sustained
	// attack cannot keep its own lockout alive by refreshing the TTL.
	if err := c.client.ExpireNX(ctx, key, ttl).Err(); err != nil {
		return 0, 0, fmt.Errorf("set counter TTL: %w", err)
	}

	remaining, err := c.client.TTL(ctx, key).Result()
	if err != nil {
		return 0, 0, fmt.Errorf("get counter TTL: %w", err)
	}
	if remaining < 0 {
		remaining = 0
	}

	return n, remaining, nil
}

func (c *Counter) Reset(
	ctx context.Context,
	key string,
) error {
	if key == "" {
		return errors.New("counter key cannot be empty")
	}

	if err := c.client.Del(
		ctx,
		counterPrefix+key,
	).Err(); err != nil {
		return fmt.Errorf(
			"reset counter: %w",
			err,
		)
	}

	return nil
}
