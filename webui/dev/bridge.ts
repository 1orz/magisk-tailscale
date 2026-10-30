// Vite dev-server plugin standing in for the root manager's exec bridge:
// POST /__exec {"cmd": "..."} returns {errno, stdout, stderr}, the shape
// window.ksu.exec delivers. Only `vite dev` loads this; it is not part of
// the build.
//
// It is not a general shell: a command must be the module's tsctl (run as
// dev/tsctl, which answers from this machine's tailscale) or `am start`
// (dev/bin/am), with arguments in the form src/lib/exec.ts's quote()
// produces. Nothing goes through sh. Requests must come from the dev
// server's own page, so other sites can't drive it.
import { execFile } from "node:child_process"
import path from "node:path"
import type { IncomingMessage } from "node:http"
import type { Plugin } from "vite"

const MODULE_TSCTL = "/data/adb/modules/magisk-tailscale-next/system/bin/tsctl"
export const DEV_HEADER = "x-tsnext-dev"

// splitWords splits a command into words: bare words of safe characters
// and single-quoted strings (with '\'' for a quote). Anything else, such
// as shell operators or expansions, is rejected.
export function splitWords(cmd: string): string[] | undefined {
  const words: string[] = []
  const re = /\s*(?:([A-Za-z0-9_./:=,@%+-]+)|'((?:[^']|'\\'')*)')/y
  let m: RegExpExecArray | null
  let pos = 0
  while (pos < cmd.trimEnd().length) {
    re.lastIndex = pos
    if (!(m = re.exec(cmd))) return undefined
    words.push(m[1] ?? m[2].replaceAll(`'\\''`, "'"))
    pos = re.lastIndex
  }
  return words
}

function resolve(cmd: string, devDir: string): [string, string[]] | undefined {
  // api.openURL discards am's output; there is nothing to discard here.
  const words = splitWords(cmd.replace(/ >\/dev\/null 2>&1$/, ""))
  if (!words?.length) return undefined
  const [prog, ...args] = words
  if (prog === MODULE_TSCTL) return [path.join(devDir, "tsctl"), args]
  if (prog === "am" && args[0] === "start") return [path.join(devDir, "bin", "am"), args]
  return undefined
}

function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  return origin !== undefined && new URL(origin).host === req.headers.host
}

export function devBridge(): Plugin {
  const devDir = path.resolve(import.meta.dirname)
  return {
    name: "tsnext-dev-bridge",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__exec", (req, res) => {
        const reply = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify(body))
        }
        if (req.method !== "POST" || req.headers[DEV_HEADER] !== "1" || !sameOrigin(req)) {
          return reply(403, { error: "forbidden" })
        }
        let body = ""
        req.on("data", (chunk: Buffer) => (body += chunk))
        req.on("end", () => {
          const { cmd } = JSON.parse(body) as { cmd: string }
          const target = resolve(cmd, devDir)
          if (!target) {
            server.config.logger.warn(`[exec] refused: ${cmd}`)
            return reply(200, { errno: 126, stdout: "", stderr: `dev bridge: refused: ${cmd}` })
          }
          execFile(target[0], target[1], (err, stdout, stderr) => {
            const errno = err ? (typeof err.code === "number" ? err.code : 1) : 0
            server.config.logger.info(`[exec] ${errno} ${cmd.replaceAll(MODULE_TSCTL, "tsctl")}`)
            reply(200, { errno, stdout, stderr })
          })
        })
      })
    },
  }
}
