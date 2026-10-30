import { EXIT_ROUTES } from "@/lib/api"
import type { PeerStatus, Prefs, Status } from "@/lib/types"

// shortName returns the first label of a MagicDNS name ("phone" for
// "phone.tail1234.ts.net."), falling back to the OS hostname.
export function shortName(p: Pick<PeerStatus, "DNSName" | "HostName">): string {
  return p.DNSName.split(".")[0] || p.HostName
}

// fqdn returns a MagicDNS name without its trailing dot.
export function fqdn(p: Pick<PeerStatus, "DNSName">): string {
  return p.DNSName.replace(/\.$/, "")
}

export function ipv4(p: Pick<PeerStatus, "TailscaleIPs">): string | undefined {
  return p.TailscaleIPs?.find((ip) => !ip.includes(":"))
}

export function ipv6(p: Pick<PeerStatus, "TailscaleIPs">): string | undefined {
  return p.TailscaleIPs?.find((ip) => ip.includes(":"))
}

// peers returns the status' peers, online ones first, then by name.
export function peers(status: Status | undefined): PeerStatus[] {
  return Object.values(status?.Peer ?? {}).sort(
    (a, b) => Number(b.Online) - Number(a.Online) || shortName(a).localeCompare(shortName(b)),
  )
}

export function exitNode(status: Status | undefined): PeerStatus | undefined {
  return peers(status).find((p) => p.ExitNode)
}

export function isAdvertisingExitNode(prefs: Prefs | undefined): boolean {
  return EXIT_ROUTES.every((r) => prefs?.AdvertiseRoutes?.includes(r))
}

// subnetRoutes returns the advertised routes other than the exit node ones.
export function subnetRoutes(prefs: Prefs | undefined): string[] {
  return (prefs?.AdvertiseRoutes ?? []).filter((r) => !EXIT_ROUTES.includes(r))
}

// parseRoutes splits a comma or whitespace separated list of CIDR
// prefixes, returning undefined if any entry is not one.
export function parseRoutes(text: string): string[] | undefined {
  const routes = text.split(/[\s,]+/).filter(Boolean)
  const cidr = /^(\d{1,3}(\.\d{1,3}){3}\/\d{1,2}|[0-9a-f:]+\/\d{1,3})$/i
  return routes.every((r) => cidr.test(r)) ? routes : undefined
}

// connection describes how traffic reaches a peer: its direct endpoint, or
// the DERP relay region.
export function connection(p: PeerStatus): { direct: boolean; via: string } | undefined {
  if (p.CurAddr) return { direct: true, via: p.CurAddr }
  if (p.Relay) return { direct: false, via: p.Relay }
  return undefined
}

// zeroTime is how Go's encoding/json writes a zero time.Time.
const zeroTime = "0001-01-01T00:00:00Z"

export function lastSeen(p: PeerStatus): Date | undefined {
  return p.LastSeen && p.LastSeen !== zeroTime ? new Date(p.LastSeen) : undefined
}
