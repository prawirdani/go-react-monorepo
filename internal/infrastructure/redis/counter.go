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

// incrementScript increments a counter and arms its window atomically. The TTL
// is set only when the key has none yet (first hit, or self-healing a key that
// a crash left without expiry between a previous INCR and EXPIRE), so a
// sustained attacker cannot refresh its own lockout by keeping the key hot.
// Returning the count and TTL in the same round trip keeps the whole operation
// a single atomic step — a plain INCR then EXPIRE could strand a key with no
// expiry if the process died between them, pinning the limit forever.
var incrementScript = redis.NewScript(`
local n = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
	redis.call('PEXPIRE', KEYS[1], ARGV[1])
	ttl = tonumber(ARGV[1])
end
return {n, ttl}
`)

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

	res, err := incrementScript.Run(ctx, c.client, []string{key}, ttl.Milliseconds()).Int64Slice()
	if err != nil {
		return 0, 0, fmt.Errorf("increment counter: %w", err)
	}

	n, remainingMS := res[0], res[1]
	remaining := time.Duration(remainingMS) * time.Millisecond
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
