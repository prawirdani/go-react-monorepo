#!/usr/bin/env sh
# Refresh the Cloudflare edge IP ranges in Caddyfile.cloudflare.
#
# Caddy trusts exactly the peers listed on `trusted_proxies static ...`, so that
# list must match Cloudflare's current published ranges. Cloudflare changes them,
# so run this before deploying (and whenever CF announces a change).
#
# It rewrites ONLY the `trusted_proxies static ...` line, in place, and refuses
# to write anything that is not a plain space-separated list of CIDRs — a failed
# or malformed fetch leaves the file untouched. Needs curl or wget.
set -eu

die() {
	printf '%s\n' "update-cloudflare-ips: $*" >&2
	exit 1
}

# Resolve the directory this script lives in, so it works from any cwd.
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
caddyfile="$script_dir/Caddyfile.cloudflare"
[ -f "$caddyfile" ] || die "not found: $caddyfile"

if command -v curl >/dev/null 2>&1; then
	fetch() { curl -fsS "$1"; }
elif command -v wget >/dev/null 2>&1; then
	fetch() { wget -qO- "$1"; }
else
	die "need curl or wget on PATH"
fi

v4_url=https://www.cloudflare.com/ips-v4
v6_url=https://www.cloudflare.com/ips-v6

if ! v4=$(fetch "$v4_url"); then
	die "failed to fetch $v4_url"
fi
if ! v6=$(fetch "$v6_url"); then
	die "failed to fetch $v6_url"
fi

# One CIDR per line from CF; normalise to a single space-separated list.
ranges=$(printf '%s\n%s\n' "$v4" "$v6" | tr '\n' ' ' | tr -s ' ')
ranges=${ranges# }
ranges=${ranges% }

[ -n "$ranges" ] || die "fetched an empty range list"

# Count first, validating each token as a CIDR. Refuse to write a partial list.
count4=0
count6=0
for cidr in $v4; do
	case "$cidr" in
		*[!0-9a-fA-F:./]*) die "unexpected IPv4 token: '$cidr'" ;;
	esac
	case "$cidr" in
		*:*) die "unexpected IPv4 token (looks like IPv6): '$cidr'" ;;
		*/*) count4=$((count4 + 1)) ;;
		*) die "IPv4 token is not a CIDR: '$cidr'" ;;
	esac
done
for cidr in $v6; do
	case "$cidr" in
		*[!0-9a-fA-F:./]*) die "unexpected IPv6 token: '$cidr'" ;;
	esac
	case "$cidr" in
		*:*) : ;;
		*) die "IPv6 token is not IPv6: '$cidr'" ;;
	esac
	case "$cidr" in
		*/*) count6=$((count6 + 1)) ;;
		*) die "IPv6 token is not a CIDR: '$cidr'" ;;
	esac
done
[ "$count4" -gt 0 ] || die "no IPv4 ranges fetched"
[ "$count6" -gt 0 ] || die "no IPv6 ranges fetched"

# Rewrite only the trusted_proxies line, preserving its indentation.
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT HUP INT TERM
found=0
while IFS= read -r line || [ -n "$line" ]; do
	case "$line" in
		*trusted_proxies\ static*)
			indent=${line%%trusted_proxies*}
			printf '%s%s\n' "$indent" "trusted_proxies static $ranges" >>"$tmp"
			found=1
			;;
		*) printf '%s\n' "$line" >>"$tmp" ;;
	esac
done <"$caddyfile"

[ "$found" -eq 1 ] || die "no 'trusted_proxies static' line in $caddyfile"

mv "$tmp" "$caddyfile"
trap - EXIT HUP INT TERM

printf '%s\n' "update-cloudflare-ips: wrote $count4 IPv4 and $count6 IPv6 ranges to $caddyfile"
