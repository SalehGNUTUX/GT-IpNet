import { ipcMain, BrowserWindow } from 'electron'
import { runCommand, streamCommand, commandExists } from '../utils/exec'
import { saveReport } from '../utils/report'
import { enrichHosts, quickOuiEnrich, runMdnsScan, loadOui, ouiLookup, appleModelName, appleDeviceType } from '../utils/deviceInfo'

export interface DiscoveredHost {
  ip: string
  mac: string
  hostname: string
  vendor: string
  status: 'online' | 'filtered' | 'unknown'
  latency?: string
  openPorts?: number[]
}

let stopCurrentScan: (() => void) | null = null

export function registerDiscoveryIPC(win: BrowserWindow): void {
  ipcMain.handle('discovery:quick-scan', async (_, iface: string) => {
    if (stopCurrentScan) {
      stopCurrentScan()
      stopCurrentScan = null
    }

    const hasArpScan = await commandExists('arp-scan')
    if (!hasArpScan) {
      return { error: 'arp-scan not installed', hosts: [], method: 'none' }
    }

    const { stdout, stderr, code } = await runCommand(
      'arp-scan',
      ['--interface', iface, '--localnet', '--retry=2'],
      true
    )

    if (code !== 0) {
      return { error: stderr, hosts: [], method: 'arp-scan' }
    }

    const hosts = parseArpScanOutput(stdout)
    const content = `Quick Scan (arp-scan) on ${iface}\n\n${stdout}`
    const path = await saveReport('discovery_quick', content)
    return { hosts, method: 'arp-scan', path }
  })

  ipcMain.handle('discovery:full-scan', async (_, iface: string, subnet: string) => {
    const hasNmap = await commandExists('nmap')
    if (!hasNmap) {
      return { error: 'nmap not installed', hosts: [], method: 'none' }
    }

    const target = subnet || (await getSubnet(iface)) || '192.168.1.0/24'
    const { stdout, stderr, code } = await runCommand(
      'nmap',
      ['-sn', '-e', iface, '--open', '-T4', target],
      true
    )

    if (code !== 0) {
      return { error: stderr, hosts: [], method: 'nmap' }
    }

    const hosts = parseNmapPingOutput(stdout)
    const content = `Full Scan (nmap) on ${iface} — ${target}\n\n${stdout}`
    const path = await saveReport('discovery_full', content)
    return { hosts, method: 'nmap', path }
  })

  ipcMain.handle('discovery:stream-scan', async (_, iface: string, mode: 'quick' | 'full', subnet?: string) => {
    if (stopCurrentScan) {
      stopCurrentScan()
      stopCurrentScan = null
    }

    if (mode === 'quick') {
      const hasArp = await commandExists('arp-scan')
      if (!hasArp) {
        win.webContents.send('discovery:stream', { error: 'arp-scan not installed', done: true })
        return
      }
      stopCurrentScan = await streamCommand(win, 'arp-scan', ['--interface', iface, '--localnet'], {
        channel: 'discovery:stream',
        sudo: true,
        timeout: 30000
      })
    } else {
      const hasNmap = await commandExists('nmap')
      if (!hasNmap) {
        win.webContents.send('discovery:stream', { error: 'nmap not installed', done: true })
        return
      }
      const target = subnet || (await getSubnet(iface)) || '192.168.1.0/24'
      stopCurrentScan = await streamCommand(win, 'nmap', ['-sn', '-e', iface, '-T4', target], {
        channel: 'discovery:stream',
        sudo: true,
        timeout: 120000
      })
    }
  })

  ipcMain.handle('discovery:stop', () => {
    if (stopCurrentScan) {
      stopCurrentScan()
      stopCurrentScan = null
      return true
    }
    return false
  })

  ipcMain.handle('discovery:host-details', async (_, ip: string) => {
    const hasNmap = await commandExists('nmap')
    if (!hasNmap) return { error: 'nmap not installed' }

    const { stdout } = await runCommand('nmap', ['-sV', '-T4', '--open', ip], true)
    return { raw: stdout, ports: parseNmapPortOutput(stdout) }
  })

  ipcMain.handle('discovery:get-subnet', async (_, iface: string) => {
    return getSubnet(iface)
  })

  // ── Device identification ────────────────────────────────────────────────

  /** Enrich a batch of {ip, mac} hosts with manufacturer, model, OS, etc. */
  ipcMain.handle('discovery:enrich', async (_, hosts: { ip: string; mac: string }[]) => {
    if (!hosts || hosts.length === 0) return {}
    const enriched = await enrichHosts(hosts)
    return Object.fromEntries(enriched)
  })

  /** Quick OUI lookup only (no network, instant) */
  ipcMain.handle('discovery:oui-lookup', async (_, mac: string) => {
    return quickOuiEnrich(mac)
  })

  /** Run mDNS scan and return all discovered devices */
  ipcMain.handle('discovery:mdns-scan', async () => {
    const devices = await runMdnsScan(10000)
    return Object.fromEntries(devices)
  })

  /** Deep identify a single host: OUI + mDNS + nmap OS + NetBIOS */
  ipcMain.handle('discovery:identify-host', async (_, ip: string, mac: string) => {
    const [ouiDb, mdnsDevices] = await Promise.all([loadOui(), runMdnsScan(5000)])

    // OUI
    const manufacturer = ouiLookup(mac, ouiDb)

    // mDNS
    const mdns = mdnsDevices.get(ip)

    // nmap OS detection (needs sudo)
    let nmapOs = ''
    let nmapHostname = ''
    const hasNmap = await commandExists('nmap')
    if (hasNmap) {
      const { stdout } = await runCommand('nmap', ['-O', '--osscan-guess', '-T4', ip], true)
      const osMatch = stdout.match(/OS details:\s+(.+)/) || stdout.match(/Aggressive OS guesses:\s+(.+)/)
      if (osMatch) nmapOs = osMatch[1].split(',')[0].trim()
      const hnMatch = stdout.match(/Nmap scan report for (\S+) \(/)
      if (hnMatch) nmapHostname = hnMatch[1]
    }

    return {
      ip, mac,
      manufacturer,
      deviceName:  mdns?.name || mdns?.hostname || nmapHostname || '',
      hostname:    mdns?.hostname || nmapHostname || '',
      modelId:     mdns?.modelId || '',
      modelName:   mdns?.modelId ? appleModelName(mdns.modelId) : '',
      os:          mdns?.os || nmapOs || '',
      deviceType:  mdns?.deviceType || 'unknown',
      services:    mdns?.services || [],
      source:      [
        manufacturer ? 'oui' : '',
        mdns ? 'mdns' : '',
        nmapOs ? 'nmap-os' : ''
      ].filter(Boolean)
    }
  })

  /** Warm up: pre-load OUI database (called at startup) */
  ipcMain.handle('discovery:preload', async () => {
    await loadOui()
    return true
  })
}

async function getSubnet(iface: string): Promise<string | null> {
  const { stdout } = await runCommand('ip', ['-o', 'addr', 'show', iface])
  const m = stdout.match(/inet\s+(\d+\.\d+\.\d+)\.\d+\/(\d+)/)
  if (!m) return null
  const [, prefix, cidr] = m
  return `${prefix}.0/${cidr}`
}

function parseArpScanOutput(output: string): DiscoveredHost[] {
  const hosts: DiscoveredHost[] = []
  const lines = output.split('\n')

  for (const line of lines) {
    const m = line.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F:]{17})\s+(.*)$/)
    if (!m) continue
    const [, ip, mac, vendor] = m
    hosts.push({ ip, mac, vendor: vendor.trim(), hostname: '', status: 'online' })
  }
  return hosts
}

function parseNmapPingOutput(output: string): DiscoveredHost[] {
  const hosts: DiscoveredHost[] = []
  const blocks = output.split('Nmap scan report for ').slice(1)

  for (const block of blocks) {
    const firstLine = block.split('\n')[0]
    const ipMatch = firstLine.match(/\((\d+\.\d+\.\d+\.\d+)\)/)
    const hostname = ipMatch ? firstLine.split(' ')[0] : ''
    const ip = ipMatch ? ipMatch[1] : firstLine.trim()

    const macMatch = block.match(/MAC Address:\s+([0-9A-F:]+)\s+\(([^)]+)\)/)
    const mac = macMatch ? macMatch[1] : ''
    const vendor = macMatch ? macMatch[2] : ''

    const latencyMatch = block.match(/(\d+\.?\d*)\s*ms/)
    const latency = latencyMatch ? `${latencyMatch[1]}ms` : undefined

    const status = block.includes('Host is up') ? 'online' : 'unknown'
    hosts.push({ ip, mac, hostname, vendor, status, latency })
  }
  return hosts
}

function parseNmapPortOutput(output: string): { port: number; protocol: string; state: string; service: string; version: string }[] {
  const ports: { port: number; protocol: string; state: string; service: string; version: string }[] = []
  const lines = output.split('\n')

  for (const line of lines) {
    const m = line.match(/^(\d+)\/(tcp|udp)\s+(\S+)\s+(\S+)\s*(.*)$/)
    if (!m) continue
    const [, port, protocol, state, service, version] = m
    ports.push({ port: parseInt(port), protocol, state, service, version: version.trim() })
  }
  return ports
}
