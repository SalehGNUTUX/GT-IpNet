import { ipcMain, BrowserWindow } from 'electron'
import { runCommand, commandExists } from '../utils/exec'
import { saveReport } from '../utils/report'

export interface PortEntry {
  protocol: string
  localAddr: string
  localPort: number
  remoteAddr: string
  remotePort: number
  state: string
  pid: string
  program: string
}

export function registerPortsIPC(win: BrowserWindow): void {
  ipcMain.handle('ports:list', async (_, filter?: 'tcp' | 'udp' | 'all') => {
    const hasSS = await commandExists('ss')
    const hasNetstat = await commandExists('netstat')

    let stdout = ''
    let tool = ''

    if (hasSS) {
      tool = 'ss'
      const args = ['-tulnp']
      if (filter === 'tcp') args.push('-t')
      else if (filter === 'udp') args.push('-u')
      const result = await runCommand('ss', args)
      stdout = result.stdout
    } else if (hasNetstat) {
      tool = 'netstat'
      const { stdout: out } = await runCommand('netstat', ['-tulnp'])
      stdout = out
    } else {
      return { error: 'No port tool (install iproute2 or net-tools)', ports: [], tool: 'none' }
    }

    const ports = tool === 'ss' ? parseSSOutput(stdout) : parseNetstatOutput(stdout)
    const path = await saveReport('ports', `Open Ports (${tool})\n\n${stdout}`)
    return { ports, tool, path, raw: stdout }
  })

  ipcMain.handle('ports:connections', async () => {
    const hasSS = await commandExists('ss')
    if (!hasSS) {
      return { error: 'ss not available', connections: [] }
    }

    const { stdout } = await runCommand('ss', ['-tunp', 'state', 'established'])
    const connections = parseSSConnections(stdout)
    return { connections, raw: stdout }
  })

  ipcMain.handle('ports:scan-host', async (_, ip: string, portRange = '1-1000') => {
    const hasNmap = await commandExists('nmap')
    if (!hasNmap) {
      return { error: 'nmap not installed', ports: [] }
    }

    const { stdout, code } = await runCommand('nmap', ['-sV', '-T4', '--open', '-p', portRange, ip], true)
    const ports = parseNmapOutput(stdout)
    const path = await saveReport('port_scan', `Port Scan of ${ip}:${portRange}\n\n${stdout}`)
    return { ports, raw: stdout, path, success: code === 0 }
  })

  ipcMain.handle('ports:process-info', async (_, port: number) => {
    const hasSS = await commandExists('ss')
    if (!hasSS) return { error: 'ss not available' }

    const { stdout } = await runCommand('ss', ['-tulnp', `sport = :${port}`])
    return { raw: stdout }
  })
}

function parseSSOutput(output: string): PortEntry[] {
  const ports: PortEntry[] = []
  const lines = output.split('\n').slice(1)

  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 5) continue

    const [protocol, , , localFull, , , process] = parts
    const [localAddr, localPort] = splitAddrPort(localFull)
    const pidMatch = process?.match(/pid=(\d+)/)
    const progMatch = process?.match(/users:\(\("([^"]+)"/)

    ports.push({
      protocol: protocol.replace('UNCONN', 'UDP'),
      localAddr,
      localPort: parseInt(localPort) || 0,
      remoteAddr: '0.0.0.0',
      remotePort: 0,
      state: 'LISTEN',
      pid: pidMatch ? pidMatch[1] : '',
      program: progMatch ? progMatch[1] : ''
    })
  }
  return ports.filter((p) => p.localPort > 0)
}

function parseSSConnections(output: string): PortEntry[] {
  const ports: PortEntry[] = []
  const lines = output.split('\n').slice(1)

  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 5) continue

    const [protocol, , , localFull, remoteFull, , process] = parts
    const [localAddr, localPort] = splitAddrPort(localFull)
    const [remoteAddr, remotePort] = splitAddrPort(remoteFull)
    const pidMatch = process?.match(/pid=(\d+)/)
    const progMatch = process?.match(/users:\(\("([^"]+)"/)

    ports.push({
      protocol,
      localAddr,
      localPort: parseInt(localPort) || 0,
      remoteAddr,
      remotePort: parseInt(remotePort) || 0,
      state: 'ESTABLISHED',
      pid: pidMatch ? pidMatch[1] : '',
      program: progMatch ? progMatch[1] : ''
    })
  }
  return ports
}

function parseNetstatOutput(output: string): PortEntry[] {
  const ports: PortEntry[] = []
  const lines = output.split('\n').slice(2)

  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 6) continue

    const [protocol, , , localFull, remoteFull, state, pid_prog] = parts
    const [localAddr, localPort] = splitAddrPort(localFull)
    const [remoteAddr, remotePort] = splitAddrPort(remoteFull)
    const pidParts = pid_prog?.split('/') || []

    ports.push({
      protocol,
      localAddr,
      localPort: parseInt(localPort) || 0,
      remoteAddr,
      remotePort: parseInt(remotePort) || 0,
      state: state || 'LISTEN',
      pid: pidParts[0] || '',
      program: pidParts[1] || ''
    })
  }
  return ports.filter((p) => p.localPort > 0)
}

function parseNmapOutput(output: string): { port: number; protocol: string; state: string; service: string; version: string }[] {
  const ports: { port: number; protocol: string; state: string; service: string; version: string }[] = []
  for (const line of output.split('\n')) {
    const m = line.match(/^(\d+)\/(tcp|udp)\s+(\S+)\s+(\S+)\s*(.*)$/)
    if (!m) continue
    const [, port, protocol, state, service, version] = m
    ports.push({ port: parseInt(port), protocol, state, service, version: version.trim() })
  }
  return ports
}

function splitAddrPort(addrPort: string): [string, string] {
  const lastColon = addrPort.lastIndexOf(':')
  if (lastColon === -1) return [addrPort, '0']
  return [addrPort.slice(0, lastColon) || '0.0.0.0', addrPort.slice(lastColon + 1)]
}
