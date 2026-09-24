package metrics

import "github.com/prometheus/client_golang/prometheus"

// PoolStat is a snapshot of database connection pool counters. It is defined
// here (rather than importing pgxpool) so pkg/metrics stays free of internal/
// infrastructure dependencies; the composition root adapts the real pool.
type PoolStat struct {
	Acquired, Idle, Total, Max int32
	NewConns, CanceledAcquire  int64
}

// PoolStatSource returns the current pool snapshot on each scrape.
type PoolStatSource func() PoolStat

type dbPoolCollector struct {
	src PoolStatSource

	acquired, idle, total, max *prometheus.Desc
	newConns, canceledAcquire  *prometheus.Desc
}

// NewDBPoolCollector builds a prometheus.Collector that emits the app_db_pool_*
// metrics from the given cumulative pool snapshot source.
func NewDBPoolCollector(src PoolStatSource) prometheus.Collector {
	return &dbPoolCollector{
		src:             src,
		acquired:        prometheus.NewDesc("app_db_pool_acquired_conns", "Currently acquired connections in the pool.", nil, nil),
		idle:            prometheus.NewDesc("app_db_pool_idle_conns", "Currently idle connections in the pool.", nil, nil),
		total:           prometheus.NewDesc("app_db_pool_total_conns", "Total connections currently in the pool.", nil, nil),
		max:             prometheus.NewDesc("app_db_pool_max_conns", "Maximum size of the pool.", nil, nil),
		newConns:        prometheus.NewDesc("app_db_pool_new_conns_total", "Cumulative count of new connections opened.", nil, nil),
		canceledAcquire: prometheus.NewDesc("app_db_pool_canceled_acquire_total", "Cumulative count of acquires canceled by context.", nil, nil),
	}
}

func (c *dbPoolCollector) Describe(ch chan<- *prometheus.Desc) {
	ch <- c.acquired
	ch <- c.idle
	ch <- c.total
	ch <- c.max
	ch <- c.newConns
	ch <- c.canceledAcquire
}

func (c *dbPoolCollector) Collect(ch chan<- prometheus.Metric) {
	s := c.src()
	ch <- prometheus.MustNewConstMetric(c.acquired, prometheus.GaugeValue, float64(s.Acquired))
	ch <- prometheus.MustNewConstMetric(c.idle, prometheus.GaugeValue, float64(s.Idle))
	ch <- prometheus.MustNewConstMetric(c.total, prometheus.GaugeValue, float64(s.Total))
	ch <- prometheus.MustNewConstMetric(c.max, prometheus.GaugeValue, float64(s.Max))
	ch <- prometheus.MustNewConstMetric(c.newConns, prometheus.CounterValue, float64(s.NewConns))
	ch <- prometheus.MustNewConstMetric(c.canceledAcquire, prometheus.CounterValue, float64(s.CanceledAcquire))
}
