package config

import (
	"os"
	"strconv"
)

// Proxy holds reverse-proxy trust configuration for client IP resolution.
type Proxy struct {
	// Trust marks that the API runs behind a reverse proxy reaching it over a
	// trusted network hop (TRUST_PROXY). When true, the client IP is taken from
	// X-Forwarded-For by walking the chain right-to-left and skipping trusted
	// (loopback / private / unix-socket) peers, so a client-appended entry
	// cannot spoof it. When false, the socket peer address is used.
	//
	// Keep it false for a directly-exposed API: trusting X-Forwarded-For with
	// no proxy in front lets any client forge the audit-log IP. The trust
	// boundary is the private socket (a container-only network, or a loopback /
	// unix-socket bind), not an address allowlist - so this flag stays correct
	// whether the proxy is a sidecar container or a host-level nginx.
	Trust bool
}

func (p *Proxy) Parse() error {
	if val := os.Getenv("TRUST_PROXY"); val != "" {
		if b, err := strconv.ParseBool(val); err == nil {
			p.Trust = b
		}
	}
	return nil
}
