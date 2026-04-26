import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { BrowserWindow } from 'electron'

const execAsync = promisify(exec)

// When launched from a desktop launcher (GNOME, KDE, etc.) the inherited PATH
// is minimal and often missing /usr/sbin, /sbin, /usr/local/bin, etc.
// Always inject the full standard Linux system PATH so tools like `ip`, `ping`,
// `arp-scan`, `nmap` are found regardless of how the app was launched.
const STANDARD_DIRS = [
  '/usr/local/sbin', '/usr/local/bin',
  '/usr/sbin', '/usr/bin',
  '/sbin', '/bin',
]

function buildPath(): string {
  const existing = (process.env.PATH || '').split(':').filter(Boolean)
  const merged = [...new Set([...STANDARD_DIRS, ...existing])]
  return merged.join(':')
}

const FULL_PATH = buildPath()

export interface ExecResult {
  stdout: string
  stderr: string
  code: number
  needsElevation?: boolean
}

export interface StreamOptions {
  channel: string
  sudo?: boolean
  env?: NodeJS.ProcessEnv
  timeout?: number
}

// Cache whether elevation methods are available
let _sudoAvailable: boolean | null = null
let _pkexecAvailable: boolean | null = null

export function isRoot(): boolean {
  return process.getuid?.() === 0
}

/** Check if `sudo -n` works (passwordless sudo) */
async function checkSudoNoPass(): Promise<boolean> {
  if (_sudoAvailable !== null) return _sudoAvailable
  const result = await _spawn('sudo', ['-n', 'true'])
  _sudoAvailable = result.code === 0
  return _sudoAvailable
}

/** Check if pkexec is installed */
async function checkPkexec(): Promise<boolean> {
  if (_pkexecAvailable !== null) return _pkexecAvailable
  const result = await _spawn('which', ['pkexec'])
  _pkexecAvailable = result.code === 0
  return _pkexecAvailable
}

/** Build the elevated command prefix based on what's available */
async function elevatedArgs(cmd: string, args: string[]): Promise<string[]> {
  if (isRoot()) return [cmd, ...args]

  if (await checkSudoNoPass()) {
    return ['sudo', '-n', cmd, ...args]
  }

  if (await checkPkexec()) {
    // pkexec needs DISPLAY/XAUTHORITY passed explicitly
    const display = process.env.DISPLAY || ':0'
    const xauth = process.env.XAUTHORITY || ''
    return [
      'pkexec', 'env',
      `DISPLAY=${display}`,
      ...(xauth ? [`XAUTHORITY=${xauth}`] : []),
      'LANG=C', 'LC_ALL=C',
      cmd, ...args
    ]
  }

  // No elevation method available — return as-is, caller handles the failure
  return [cmd, ...args]
}

/** Low-level spawn that returns stdout/stderr/code */
function _spawn(binary: string, args: string[], extraEnv: NodeJS.ProcessEnv = {}): Promise<ExecResult> {
  return new Promise((resolve) => {
    const proc = spawn(binary, args, {
      env: { ...process.env, PATH: FULL_PATH, LANG: 'C', LC_ALL: 'C', ...extraEnv }
    })
    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => (stdout += d.toString()))
    proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
    proc.on('close', (code) => resolve({ stdout, stderr, code: code ?? 0 }))
    proc.on('error', (err) => resolve({ stdout: '', stderr: err.message, code: 1 }))
  })
}

/**
 * Run a command, optionally with privilege elevation.
 * When sudo=true, tries: root-check → sudo -n → pkexec.
 * Returns { needsElevation: true } if elevation is required but unavailable.
 */
export async function runCommand(
  cmd: string,
  args: string[] = [],
  sudo = false
): Promise<ExecResult> {
  if (!sudo) return _spawn(cmd, args)

  if (isRoot()) return _spawn(cmd, args)

  const sudoOk = await checkSudoNoPass()
  if (sudoOk) return _spawn('sudo', ['-n', cmd, ...args])

  const pkOk = await checkPkexec()
  if (pkOk) {
    const display = process.env.DISPLAY || ':0'
    const xauth = process.env.XAUTHORITY || ''
    return _spawn('pkexec', [
      'env', `DISPLAY=${display}`,
      ...(xauth ? [`XAUTHORITY=${xauth}`] : []),
      cmd, ...args
    ])
  }

  // Cannot elevate — return descriptive error
  return {
    stdout: '',
    stderr: `"${cmd}" requires root privileges.\nRun GT-IpNet with: sudo -E npm run dev\nor install polkit (pkexec).`,
    code: 126,
    needsElevation: true
  }
}

/**
 * Stream command output line-by-line to the renderer via IPC.
 * Same elevation logic as runCommand.
 */
export async function streamCommand(
  win: BrowserWindow,
  cmd: string,
  args: string[],
  opts: StreamOptions
): Promise<() => void> {
  const { channel, sudo = false, env = {}, timeout } = opts

  const send = (payload: object) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }

  const finalArgs = sudo ? await elevatedArgs(cmd, args) : [cmd, ...args]

  // Check if we got an unelevated fallback when elevation was needed
  if (sudo && !isRoot() && !(await checkSudoNoPass()) && !(await checkPkexec())) {
    send({
      done: true, code: 126,
      error: `"${cmd}" requires root privileges. Install polkit or run app with sudo.`,
      needsElevation: true
    })
    return () => {}
  }

  const [binary, ...rest] = finalArgs
  const proc = spawn(binary, rest, {
    env: { ...process.env, PATH: FULL_PATH, LANG: 'C', LC_ALL: 'C', ...env }
  })

  let timer: ReturnType<typeof setTimeout> | null = null
  if (timeout) {
    timer = setTimeout(() => {
      proc.kill('SIGTERM')
      send({ error: 'Operation timed out', done: true, code: -1 })
    }, timeout)
  }

  proc.stdout.on('data', (d: Buffer) => {
    d.toString().split('\n').filter(Boolean).forEach((line) => send({ line }))
  })

  proc.stderr.on('data', (d: Buffer) => {
    d.toString().split('\n').filter(Boolean).forEach((line) => send({ line, isError: true }))
  })

  proc.on('close', (code) => {
    if (timer) clearTimeout(timer)
    send({ done: true, code: code ?? 0 })
  })

  proc.on('error', (err) => {
    if (timer) clearTimeout(timer)
    send({ error: err.message, done: true, code: 1 })
  })

  return () => proc.kill('SIGTERM')
}

export async function commandExists(cmd: string): Promise<boolean> {
  const { code } = await _spawn('which', [cmd])
  return code === 0
}

export async function simpleExec(cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, {
      env: { ...process.env, PATH: FULL_PATH, LANG: 'C', LC_ALL: 'C' }
    })
    return stdout.trim()
  } catch {
    return ''
  }
}

/** Expose elevation status to the IPC layer */
export async function getElevationStatus(): Promise<{
  isRoot: boolean
  sudoAvailable: boolean
  pkexecAvailable: boolean
  canElevate: boolean
}> {
  const root = isRoot()
  const sudo = root || await checkSudoNoPass()
  const pk = !sudo && await checkPkexec()
  return {
    isRoot: root,
    sudoAvailable: await checkSudoNoPass(),
    pkexecAvailable: await checkPkexec(),
    canElevate: root || sudo || pk
  }
}
