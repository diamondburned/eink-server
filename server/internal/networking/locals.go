// Package networking provides utilities for working with network addresses and
// connections.
package networking

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/netip"
	"slices"
	"strings"
)

func ResolveHostname(ctx context.Context, hostname string) (netip.Addr, error) {
	ips, err := net.DefaultResolver.LookupIPAddr(ctx, hostname)
	if err != nil {
		return netip.Addr{}, fmt.Errorf("failed to resolve hostname: %w", err)
	}

	netIPs := make([]netip.Addr, 0, len(ips))
	for _, ip := range ips {
		// Ignore all loopback addresses:
		if netipAddr, ok := netip.AddrFromSlice(ip.IP); ok && !netipAddr.IsLoopback() {
			netIPs = append(netIPs, netipAddr)
		}
	}

	if len(netIPs) == 0 {
		return netip.Addr{}, fmt.Errorf("no IP addresses found for hostname")
	}

	// Prefer IPv6 global unicast addresses:
	if v6gua := filterAndSortIPs(netIPs, netip.Addr.IsGlobalUnicast); len(v6gua) > 0 {
		slog.DebugContext(ctx,
			"Resolved hostname to global unicast IPv6 address",
			"hostname", hostname,
			"address", v6gua[0].String(),
			"address_type", "global_unicast_ipv6")
		return v6gua[0], nil
	}

	// Prefer IPv6 link-local addresses next:
	if v6lla := filterAndSortIPs(netIPs, netip.Addr.IsLinkLocalUnicast); len(v6lla) > 0 {
		slog.DebugContext(ctx,
			"Resolved hostname to link-local unicast IPv6 address",
			"hostname", hostname,
			"address", v6lla[0].String(),
			"address_type", "link_local_unicast_ipv6")
		return v6lla[0], nil
	}

	// If no global unicast or link-local IPv6 addresses are found, return the
	// first non-private IP address:
	if ips := filterAndSortIPs(netIPs, func(a netip.Addr) bool { return !a.IsPrivate() }); len(ips) > 0 {
		slog.DebugContext(ctx,
			"Resolved hostname to non-private IP address",
			"hostname", hostname,
			"address", ips[0].String(),
			"address_type", "non_private_ip")
		return ips[0], nil
	}

	// Else, return whatever is first.
	return netIPs[0], nil
}

func filterAndSortIPs(s []netip.Addr, f func(netip.Addr) bool) []netip.Addr {
	var filtered []netip.Addr
	for _, ip := range s {
		if f(ip) {
			filtered = append(filtered, ip)
		}
	}

	slices.SortFunc(filtered, func(a, b netip.Addr) int {
		return strings.Compare(a.String(), b.String())
	})

	return filtered
}
