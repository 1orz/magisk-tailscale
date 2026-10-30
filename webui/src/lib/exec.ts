// Runs shell commands as root through the root manager's WebUI bridge.
//
// KernelSU (and APatch, which implements the same API) expose
// window.ksu.exec(cmd, optionsJson, callbackName); the result is delivered
// by calling window[callbackName](errno, stdout, stderr). During `vite dev`
// the commands go to the dev server instead (see dev/bridge.ts).

export interface ExecResult {
  errno: number
  stdout: string
  stderr: string
}

interface KsuBridge {
  exec(cmd: string, options: string, callback: string): void
}

declare global {
  interface Window {
    ksu?: KsuBridge
  }
}

type Callbacks = Record<string, (errno: number, stdout: string, stderr: string) => void>

let seq = 0

export function hasBridge(): boolean {
  return window.ksu !== undefined || import.meta.env.DEV
}

export function exec(cmd: string): Promise<ExecResult> {
  const ksu = window.ksu
  if (ksu) {
    return new Promise((resolve) => {
      const name = `__tsnext_exec_${Date.now()}_${seq++}`
      const callbacks = window as unknown as Callbacks
      callbacks[name] = (errno, stdout, stderr) => {
        delete callbacks[name]
        resolve({ errno, stdout, stderr })
      }
      ksu.exec(cmd, "{}", name)
    })
  }
  if (import.meta.env.DEV) {
    return fetch("/__exec", {
      method: "POST",
      headers: { "X-Tsnext-Dev": "1" },
      body: JSON.stringify({ cmd }),
    }).then(
      (r) => r.json() as Promise<ExecResult>,
    )
  }
  return Promise.reject(new BridgeMissingError())
}

export class BridgeMissingError extends Error {
  constructor() {
    super("No root manager WebUI bridge (window.ksu) is available.")
  }
}

export class CommandError extends Error {
  readonly errno: number
  readonly stderr: string

  constructor(cmd: string, result: ExecResult) {
    const detail = result.stderr.trim() || result.stdout.trim()
    super(detail || `${cmd.split(" ")[0]} exited with status ${result.errno}`)
    this.errno = result.errno
    this.stderr = result.stderr
  }
}

// run executes cmd and returns its stdout, throwing CommandError on a
// non-zero exit status.
export async function run(cmd: string): Promise<string> {
  const result = await exec(cmd)
  if (result.errno !== 0) {
    throw new CommandError(cmd, result)
  }
  return result.stdout
}

// quote returns s as a single shell word.
export function quote(s: string): string {
  return `'${s.replaceAll("'", `'\\''`)}'`
}
