// The subset of tailscaled's JSON (ipnstate.Status, ipn.Prefs) and of
// `tsctl` output that the WebUI reads.

export type BackendState =
  | "NoState"
  | "NeedsLogin"
  | "NeedsMachineAuth"
  | "Stopped"
  | "Starting"
  | "Running"

export interface PeerStatus {
  ID: string
  HostName: string
  DNSName: string
  OS: string
  UserID: number
  TailscaleIPs: string[] | null
  PrimaryRoutes?: string[] | null
  Tags?: string[] | null
  Online: boolean
  Active: boolean
  ExitNode: boolean
  ExitNodeOption: boolean
  Relay: string
  CurAddr: string
  LastSeen: string
  RxBytes: number
  TxBytes: number
  KeyExpiry?: string
  Expired?: boolean
}

export interface UserProfile {
  ID: number
  LoginName: string
  DisplayName: string
}

export interface Status {
  Version: string
  BackendState: BackendState
  AuthURL: string
  TailscaleIPs: string[] | null
  Self?: PeerStatus
  Health: string[] | null
  MagicDNSSuffix: string
  CurrentTailnet?: {
    Name: string
    MagicDNSSuffix: string
    MagicDNSEnabled: boolean
  } | null
  Peer?: Record<string, PeerStatus> | null
  User?: Record<string, UserProfile> | null
  ExitNodeStatus?: {
    ID: string
    Online: boolean
    TailscaleIPs: string[] | null
  } | null
}

export interface Prefs {
  RouteAll: boolean
  ExitNodeID: string
  ExitNodeIP: string
  ExitNodeAllowLANAccess: boolean
  CorpDNS: boolean
  WantRunning: boolean
  LoggedOut: boolean
  ShieldsUp: boolean
  Hostname: string
  AdvertiseRoutes: string[] | null
}

// ServiceStatus is `tsctl status --json`.
export interface ServiceStatus {
  running: boolean
  pid: number | null
  tunMode: TunMode
  tun: string
  moduleVersion: string
  tailscaleVersion: string
}

export type TunMode = "auto" | "tun" | "userspace"

// ModuleConfig is `tsctl config --json`.
export interface ModuleConfig {
  tunMode: TunMode
  port: number
  firewallMode: string
  verbose: number
}

export type LogKind = "tailscaled" | "service"

// Profile is an entry of `tailscale switch --list --json`: an account this
// device is logged in to.
export interface Profile {
  id: string
  nickname: string
  tailnet: string
  account: string
  selected: boolean
}

// PingResult is one `tailscale ping` round trip; ms is undefined when it
// timed out.
export interface PingResult {
  at: number
  ms?: number
  via?: string
  direct?: boolean
}
