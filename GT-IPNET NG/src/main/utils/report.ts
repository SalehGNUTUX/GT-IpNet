import { writeFile, mkdir, readdir, readFile, unlink, access, chown, stat } from 'fs/promises'
import { constants } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const _SYS_PATH = [
  '/usr/local/sbin', '/usr/local/bin',
  '/usr/sbin', '/usr/bin', '/sbin', '/bin',
  process.env.PATH || ''
].filter(Boolean).join(':')

const _execOpts = { env: { ...process.env, PATH: _SYS_PATH } }

/**
 * Get the real user's home directory.
 * When the app runs via `sudo`, $HOME is root's home but $SUDO_USER is the real user.
 * We always want to write reports to the real user's home.
 */
function getRealHome(): string {
  const sudoUser = process.env.SUDO_USER
  if (sudoUser && process.getuid?.() === 0) {
    return join('/home', sudoUser)
  }
  return homedir()
}

function buildReportsDir(): string {
  return join(getRealHome(), 'GT-IpNet_Reports')
}

// Lazily resolved path (can change if home changes)
export function getReportsDir(): string {
  return buildReportsDir()
}

/**
 * Ensure the reports directory exists and is writable by the current (real) user.
 * Handles the case where a previous sudo run left the dir owned by root.
 */
export async function ensureReportsDir(): Promise<string> {
  const dir = buildReportsDir()

  try {
    await mkdir(dir, { recursive: true })
  } catch (e: any) {
    if (e.code !== 'EEXIST') throw e
  }

  // Check if we can write
  try {
    await access(dir, constants.W_OK)
    return dir
  } catch {
    // Directory exists but we can't write — try to fix ownership
    await fixDirOwnership(dir)
    return dir
  }
}

/**
 * Attempt to fix a root-owned directory so the real user can write to it.
 * Uses `pkexec chown` or falls back gracefully.
 */
async function fixDirOwnership(dir: string): Promise<void> {
  const uid = process.getuid?.() ?? -1
  const gid = process.getgid?.() ?? -1

  // If we're root, chown directly
  if (uid === 0) {
    const targetUser = process.env.SUDO_USER
    if (targetUser) {
      try {
        await execAsync(`chown -R ${targetUser}:${targetUser} "${dir}"`, _execOpts)
      } catch { /* best-effort */ }
    }
    return
  }

  // Try pkexec chown
  try {
    const user = process.env.USER || process.env.LOGNAME || String(uid)
    await execAsync(`pkexec chown -R ${user}:${user} "${dir}"`, _execOpts)
    return
  } catch { /* pkexec not available or cancelled */ }

  // Try sudo -n chown (passwordless sudo)
  try {
    const user = process.env.USER || process.env.LOGNAME || String(uid)
    await execAsync(`sudo -n chown -R ${user}:${user} "${dir}"`, _execOpts)
    return
  } catch { /* no passwordless sudo */ }

  // Cannot fix ownership — we'll catch write errors per-file
}

export function getReportPath(tool: string): string {
  const ts = new Date()
    .toISOString()
    .replace('T', '_')
    .replace(/:/g, '-')
    .slice(0, 19)
  return join(buildReportsDir(), `${tool}_${ts}.txt`)
}

/**
 * Save a report. Returns the path on success, or null on permission error.
 * Never throws — a failed save should not abort the tool operation.
 */
export async function saveReport(tool: string, content: string): Promise<string | null> {
  try {
    await ensureReportsDir()
    const path = getReportPath(tool)
    const header = [
      '='.repeat(60),
      `GT-IpNet Report — ${tool}`,
      `Generated: ${new Date().toLocaleString()}`,
      `System: ${process.platform} ${process.arch}`,
      '='.repeat(60),
      ''
    ].join('\n')
    await writeFile(path, header + content, 'utf8')
    return path
  } catch (e: any) {
    console.warn(`[GT-IpNet] Could not save report for "${tool}": ${e.message}`)
    return null
  }
}

export async function listReports(): Promise<{ name: string; path: string; size: number; date: Date }[]> {
  try {
    await ensureReportsDir()
    const dir = buildReportsDir()
    const files = await readdir(dir)
    const reports = await Promise.all(
      files
        .filter((f) => f.endsWith('.txt'))
        .map(async (f) => {
          const path = join(dir, f)
          try {
            const s = await stat(path)
            return { name: f, path, size: s.size, date: s.mtime }
          } catch {
            return null
          }
        })
    )
    return (reports.filter(Boolean) as any[]).sort((a, b) => b.date.getTime() - a.date.getTime())
  } catch {
    return []
  }
}

export async function readReport(path: string): Promise<string> {
  return readFile(path, 'utf8')
}

export async function deleteReport(path: string): Promise<void> {
  await unlink(path)
}

// ── Error logs (separate subdirectory) ───────────────────────────────────────

function getErrorsDir(): string {
  return join(buildReportsDir(), 'errors')
}

export async function saveError(title: string, detail: string): Promise<string | null> {
  try {
    const dir = getErrorsDir()
    await mkdir(dir, { recursive: true })
    const ts = new Date().toISOString().replace('T', '_').replace(/:/g, '-').slice(0, 19)
    const path = join(dir, `error_${ts}.txt`)
    const content = [
      '='.repeat(60),
      `GT-IpNet Error Log`,
      `Date: ${new Date().toLocaleString()}`,
      `Title: ${title}`,
      '='.repeat(60),
      '',
      detail,
      ''
    ].join('\n')
    await writeFile(path, content, 'utf8')
    return path
  } catch (e: any) {
    console.warn(`[GT-IpNet] Could not save error log: ${e.message}`)
    return null
  }
}

export async function listErrors(): Promise<{ name: string; path: string; size: number; date: Date }[]> {
  try {
    const dir = getErrorsDir()
    await mkdir(dir, { recursive: true })
    const files = await readdir(dir)
    const entries = await Promise.all(
      files
        .filter((f) => f.endsWith('.txt'))
        .map(async (f) => {
          const path = join(dir, f)
          try {
            const s = await stat(path)
            return { name: f, path, size: s.size, date: s.mtime }
          } catch { return null }
        })
    )
    return (entries.filter(Boolean) as any[]).sort((a, b) => b.date.getTime() - a.date.getTime())
  } catch { return [] }
}
