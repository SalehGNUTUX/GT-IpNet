import { ipcMain, BrowserWindow } from 'electron'
import { runCommand, streamCommand, commandExists, simpleExec } from '../utils/exec'
import { saveReport } from '../utils/report'

export interface DnsResult {
  server: string
  domain: string
  resolved: boolean
  ip: string
  responseTime: string
  error?: string
}

export interface TraceHop {
  hop: number
  host: string
  ip: string
  rtt1: string
  rtt2: string
  rtt3: string
}

export interface PingResult {
  target: string
  transmitted: number
  received: number
  loss: number
  minRtt: string
  avgRtt: string
  maxRtt: string
  jitter: string
  raw: string
}

let stopTrace: (() => void) | null = null
let stopPing: (() => void) | null = null

export function registerDiagnosticsIPC(win: BrowserWindow): void {
  // --- DNS ---
  ipcMain.handle('diag:dns-test', async (_, domain = 'example.com') => {
    const hasDig = await commandExists('dig')
    const hasNslookup = await commandExists('nslookup')
    const tool = hasDig ? 'dig' : hasNslookup ? 'nslookup' : null

    if (!tool) {
      return { error: 'No DNS tool available (install dnsutils)', results: [] }
    }

    const resolvers = await getConfiguredDNS()
    const results: DnsResult[] = []

    for (const server of resolvers) {
      const start = Date.now()
      let resolved = false
      let ip = ''
      let error: string | undefined

      try {
        if (tool === 'dig') {
          const { stdout, code } = await runCommand('dig', [`@${server}`, domain, '+short', '+time=3'])
          resolved = code === 0 && stdout.trim().length > 0
          ip = stdout.split('\n').find((l) => /^\d+\./.test(l)) || stdout.trim()
          if (!resolved) error = 'No response'
        } else {
          const { stdout, code } = await runCommand('nslookup', [domain, server])
          resolved = code === 0 && stdout.includes('Address')
          const m = stdout.match(/Address:\s+(\d+\.\d+\.\d+\.\d+)/)
          ip = m ? m[1] : ''
          if (!resolved) error = 'No response'
        }
      } catch (e: any) {
        error = e.message
      }

      const responseTime = `${Date.now() - start}ms`
      results.push({ server, domain, resolved, ip, responseTime, error })
    }

    const content = results
      .map((r) => `${r.server}: ${r.resolved ? `OK (${r.ip}) ${r.responseTime}` : `FAIL — ${r.error}`}`)
      .join('\n')
    await saveReport('dns', `DNS Test for ${domain}\n\n${content}`)
    return { results, tool }
  })

  ipcMain.handle('diag:resolv-conf', async () => {
    const { stdout } = await runCommand('cat', ['/etc/resolv.conf'])
    return stdout
  })

  // --- Trace ---
  ipcMain.handle('diag:trace', async (_, target = '8.8.8.8') => {
    if (stopTrace) { stopTrace(); stopTrace = null }

    const hasMtr = await commandExists('mtr')
    const hasTraceroute = await commandExists('traceroute')
    const hasTracepath = await commandExists('tracepath')

    if (hasMtr) {
      const { stdout, code } = await runCommand('mtr', ['--report', '--report-cycles', '3', '--no-dns', target])
      if (code === 0) {
        const path = await saveReport('trace', `Traceroute to ${target}\n\n${stdout}`)
        return { raw: stdout, hops: parseMtrOutput(stdout), tool: 'mtr', path }
      }
    }

    if (hasTraceroute) {
      const { stdout } = await runCommand('traceroute', ['-n', '-q', '1', '-w', '2', target])
      const path = await saveReport('trace', `Traceroute to ${target}\n\n${stdout}`)
      return { raw: stdout, hops: parseTracerouteOutput(stdout), tool: 'traceroute', path }
    }

    if (hasTracepath) {
      const { stdout } = await runCommand('tracepath', ['-n', target])
      const path = await saveReport('trace', `Traceroute to ${target}\n\n${stdout}`)
      return { raw: stdout, hops: parseTracepathOutput(stdout), tool: 'tracepath', path }
    }

    return { error: 'No trace tool available (install mtr or traceroute)', hops: [] }
  })

  ipcMain.handle('diag:trace-stream', async (_, target = '8.8.8.8') => {
    if (stopTrace) { stopTrace(); stopTrace = null }

    const hasMtr = await commandExists('mtr')
    const hasTraceroute = await commandExists('traceroute')

    if (hasMtr) {
      stopTrace = await streamCommand(win, 'mtr', ['--report', '--report-cycles', '5', target], {
        channel: 'diag:trace-stream',
        timeout: 60000
      })
    } else if (hasTraceroute) {
      stopTrace = await streamCommand(win, 'traceroute', ['-q', '1', '-w', '2', target], {
        channel: 'diag:trace-stream',
        timeout: 60000
      })
    } else {
      win.webContents.send('diag:trace-stream', { error: 'No trace tool', done: true })
    }
  })

  ipcMain.handle('diag:trace-stop', () => {
    if (stopTrace) { stopTrace(); stopTrace = null; return true }
    return false
  })

  // --- Ping ---
  ipcMain.handle('diag:ping', async (_, target = '8.8.8.8', count = 4) => {
    const { stdout, code } = await runCommand('ping', ['-c', String(count), '-W', '2', target])

    if (code !== 0 && !stdout) {
      return { error: 'Ping failed', target }
    }

    const result = parsePingOutput(stdout, target)
    const path = await saveReport('ping', `Ping to ${target}\n\n${stdout}`)
    return { ...result, path }
  })

  ipcMain.handle('diag:ping-stream', async (_, target = '8.8.8.8', count = 10) => {
    if (stopPing) { stopPing(); stopPing = null }
    stopPing = await streamCommand(win, 'ping', ['-c', String(count), '-i', '0.5', target], {
      channel: 'diag:ping-stream',
      timeout: 30000
    })
  })

  ipcMain.handle('diag:ping-stop', () => {
    if (stopPing) { stopPing(); stopPing = null; return true }
    return false
  })

  // --- System Info ---
  ipcMain.handle('diag:system-info', async () => {
    const [hostname, kernel, arch, cpuInfo] = await Promise.all([
      simpleExec('hostname'),
      simpleExec('uname -r'),
      simpleExec('uname -m'),
      simpleExec("cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d: -f2")
    ])
    return { hostname, kernel, arch, cpu: cpuInfo.trim() }
  })
}

async function getConfiguredDNS(): Promise<string[]> {
  const { stdout } = await runCommand('cat', ['/etc/resolv.conf'])
  const servers = stdout
    .split('\n')
    .filter((l) => l.startsWith('nameserver'))
    .map((l) => l.split(/\s+/)[1])
    .filter(Boolean)
  return servers.length > 0 ? servers.slice(0, 3) : ['8.8.8.8', '1.1.1.1', '9.9.9.9']
}

function parseMtrOutput(output: string): TraceHop[] {
  const hops: TraceHop[] = []
  const lines = output.split('\n').slice(2)
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\.\|--\s+(\S+)\s+[\d.]+%\s+\d+\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
    if (!m) continue
    const [, hop, host, rtt1, rtt2, rtt3] = m
    const ipMatch = host.match(/\((\d+\.\d+\.\d+\.\d+)\)/)
    hops.push({
      hop: parseInt(hop),
      host: ipMatch ? host.replace(/\(.*?\)/, '').trim() : host,
      ip: ipMatch ? ipMatch[1] : host,
      rtt1: `${rtt1}ms`,
      rtt2: `${rtt2}ms`,
      rtt3: `${rtt3}ms`
    })
  }
  return hops
}

function parseTracerouteOutput(output: string): TraceHop[] {
  const hops: TraceHop[] = []
  const lines = output.split('\n').slice(1)
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s+(\S+)\s+(?:\((\S+)\)\s+)?(.+)$/)
    if (!m) continue
    const [, hop, host, ip, rtts] = m
    const rttValues = rtts.match(/([\d.]+)\s+ms/g) || []
    hops.push({
      hop: parseInt(hop),
      host: ip ? host : host,
      ip: ip || host,
      rtt1: rttValues[0] || '* ms',
      rtt2: rttValues[1] || '* ms',
      rtt3: rttValues[2] || '* ms'
    })
  }
  return hops
}

function parseTracepathOutput(output: string): TraceHop[] {
  const hops: TraceHop[] = []
  const lines = output.split('\n')
  for (const line of lines) {
    const m = line.match(/^\s*(\d+):\s+(\S+)\s+(?:\((\S+)\)\s+)?([\d.]+)ms/)
    if (!m) continue
    const [, hop, host, ip, rtt] = m
    hops.push({
      hop: parseInt(hop),
      host: ip ? host : host,
      ip: ip || host,
      rtt1: `${rtt}ms`,
      rtt2: '',
      rtt3: ''
    })
  }
  return hops
}

function parsePingOutput(output: string, target: string): PingResult {
  const stats = output.match(/(\d+) packets transmitted,\s*(\d+) (?:packets )?received(?:,\s*([\d.]+)% packet loss)?/)
  const rtt = output.match(/rtt\s+min\/avg\/max\/mdev\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/)

  return {
    target,
    transmitted: stats ? parseInt(stats[1]) : 0,
    received: stats ? parseInt(stats[2]) : 0,
    loss: stats && stats[3] ? parseFloat(stats[3]) : 100,
    minRtt: rtt ? `${rtt[1]}ms` : 'N/A',
    avgRtt: rtt ? `${rtt[2]}ms` : 'N/A',
    maxRtt: rtt ? `${rtt[3]}ms` : 'N/A',
    jitter: rtt ? `${rtt[4]}ms` : 'N/A',
    raw: output
  }
}
