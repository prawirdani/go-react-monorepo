package metrics

import (
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
)

func TestDBPoolCollector_EmitsGaugesAndCounters(t *testing.T) {
	c := NewDBPoolCollector(func() PoolStat {
		return PoolStat{Acquired: 3, Idle: 4, Total: 7, Max: 10, NewConns: 12, CanceledAcquire: 2}
	})

	expected := `
# HELP app_db_pool_acquired_conns Currently acquired connections in the pool.
# TYPE app_db_pool_acquired_conns gauge
app_db_pool_acquired_conns 3
# HELP app_db_pool_canceled_acquire_total Cumulative count of acquires canceled by context.
# TYPE app_db_pool_canceled_acquire_total counter
app_db_pool_canceled_acquire_total 2
# HELP app_db_pool_idle_conns Currently idle connections in the pool.
# TYPE app_db_pool_idle_conns gauge
app_db_pool_idle_conns 4
# HELP app_db_pool_max_conns Maximum size of the pool.
# TYPE app_db_pool_max_conns gauge
app_db_pool_max_conns 10
# HELP app_db_pool_new_conns_total Cumulative count of new connections opened.
# TYPE app_db_pool_new_conns_total counter
app_db_pool_new_conns_total 12
# HELP app_db_pool_total_conns Total connections currently in the pool.
# TYPE app_db_pool_total_conns gauge
app_db_pool_total_conns 7
`
	assert.NoError(t, testutil.CollectAndCompare(c, strings.NewReader(expected)))
}

func TestDBPoolCollector_SourceCalledPerScrape(t *testing.T) {
	calls := 0
	c := NewDBPoolCollector(func() PoolStat {
		calls++
		return PoolStat{}
	})

	assert.Equal(t, 6, testutil.CollectAndCount(c))
	assert.Equal(t, 1, calls)
}
