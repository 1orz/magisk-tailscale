import { exec, quote, run } from "@/lib/exec"
import type {
  LogKind,
  ModuleConfig,
  PingResult,
  Prefs,
  Profile,
  ServiceStatus,
  Status,
  TunMode,
} from "@/lib/types"

const MODULE_DIR = "/data/adb/modules/magisk-tailscale-next"
const TSCTL = `${MODULE_DIR}/system/bin/tsctl`

export const ADMIN_URL = "https://login.tailscale.com/admin/machines"
export const PROJECT_URL = "https://github.com/1orz/magisk-tailscale"

export const EXIT_ROUTES = ["0.0.0.0/0", "::/0"]

// parsePong reads a reply line such as
//   pong from seoul-01 (100.95.124.91) via [2603:c022::cc2d]:41641 in 351ms
//   pong from agent (100.114.241.21) via DERP(qcloud-bj) in 40ms
export function parsePong(out: string): Omit<PingResult, "at"> {
  const m = /^pong from .* via (\S+) in ([\d.]+)ms/m.exec(out)
  if (!m) return {}
  const derp = /^DERP\((.+)\)$/.exec(m[1])
  return { ms: Number(m[2]), via: derp ? derp[1] : m[1], direct: !derp }
}

function tsctl(...args: string[]): Promise<string> {
  return run([TSCTL, ...args.map(quote)].join(" "))
}

function cli(...args: string[]): Promise<string> {
  return tsctl("cli", ...args)
}

async function json<T>(p: Promise<string>): Promise<T> {
  return JSON.parse(await p) as T
}

export const api = {
  service: () => json<ServiceStatus>(tsctl("status", "--json")),
  start: () => tsctl("start"),
  stop: () => tsctl("stop"),
  restart: () => tsctl("restart"),

  status: () => json<Status>(cli("status", "--json")),
  prefs: () => json<Prefs>(cli("debug", "prefs")),
  up: () => cli("up"),
  down: () => cli("down"),
  login: () => tsctl("login"),
  // cancelLogin stops a pending login, then returns to the profile in use
  // before it.
  cancelLogin: async (profile: string) => {
    await tsctl("login", "cancel")
    await cli("switch", profile)
  },
  logout: () => cli("logout"),

  profiles: () => json<Profile[]>(cli("switch", "--list", "--json")),
  switchProfile: (id: string) => cli("switch", id),
  removeProfile: (id: string) => cli("switch", "remove", id),

  // ping sends one disco ping to ip, like the official clients' ping view.
  ping: async (ip: string): Promise<PingResult> => {
    const at = Date.now()
    const result = await exec(
      [TSCTL, "cli", "ping", "--c", "1", "--until-direct=false", "--timeout", "3s", ip]
        .map(quote)
        .join(" "),
    )
    return { at, ...parsePong(result.stdout) }
  },

  // set runs `tailscale set` with each flag as --name=value.
  set: (flags: Record<string, string | boolean>) =>
    cli("set", ...Object.entries(flags).map(([k, v]) => `--${k}=${v}`)),

  config: () => json<ModuleConfig>(tsctl("config", "--json")),
  setTunMode: (mode: TunMode) => tsctl("config", "set", "TS_TUN_MODE", mode),
  setPort: (port: number) => tsctl("config", "set", "TS_PORT", String(port)),

  logs: (kind: LogKind, lines = 500) =>
    tsctl("log", "-n", String(lines), ...(kind === "service" ? ["service"] : [])),

  // openURL opens url in the default browser.
  openURL: (url: string) =>
    run(`am start -a android.intent.action.VIEW -d ${quote(url)} >/dev/null 2>&1`),
}
