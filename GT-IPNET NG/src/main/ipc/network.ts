import { ipcMain, BrowserWindow } from 'electron'
import { runCommand, streamCommand, simpleExec, commandExists } from '../utils/exec'
import { saveReport } from '../utils/report'

export interface NetworkInterface {
  name: string
  mac: string
  state: string
  type: string
}

export interface InterfaceDetails {
  name: string
  ipv4: string
  ipv6: string
  netmask: string
  broadcast: string
  mac: string
  mtu: string
  state: string
  rxBytes: string
  txBytes: string
}

export function registerNetworkIPC(win: BrowserWindow): void {
  ipcMain.handle('network:list-interfaces', async () => {
    const { stdout } = await runCommand('ip', ['-o', 'link', 'show'])
    const interfaces: NetworkInterface[] = []

    for (const line of stdout.split('\n').filter(Boolean)) {
      const m = line.match(/^\d+:\s+(\S+):.+<([^>]+)>.+link\/(\S+)\s+(\S+)/)
      if (!m) continue
      const [, name, flags, type, mac] = m
      if (name === 'lo') continue
      interfaces.push({
        name,
        mac,
        type,
        state: flags.includes('UP') ? 'up' : 'down'
      })
    }
    return interfaces
  })

  ipcMain.handle('network:interface-details', async (_, iface: string) => {
    const [addrOut, statOut] = await Promise.all([
      runCommand('ip', ['-o', 'addr', 'show', iface]),
      runCommand('ip', ['-s', 'link', 'show', iface])
    ])

    const details: Partial<InterfaceDetails> = { name: iface }

    const ipv4m = addrOut.stdout.match(/inet\s+(\S+)/)
    if (ipv4m) {
      const [addr, prefix] = ipv4m[1].split('/')
      details.ipv4 = addr
      details.netmask = prefix ? cidrToMask(parseInt(prefix)) : ''
    }

    const ipv6m = addrOut.stdout.match(/inet6\s+(\S+)/)
    if (ipv6m) details.ipv6 = ipv6m[1].split('/')[0]

    const macm = statOut.stdout.match(/link\/\S+\s+(\S+)/)
    if (macm) details.mac = macm[1]

    const mtu = statOut.stdout.match(/mtu\s+(\d+)/)
    if (mtu) details.mtu = mtu[1]

    const state = statOut.stdout.match(/state\s+(\S+)/)
    if (state) details.state = state[1].toLowerCase()

    const rxm = statOut.stdout.match(/RX:.*?\n\s+(\d+)/)
    if (rxm) details.rxBytes = formatBytes(parseInt(rxm[1]))
    const txm = statOut.stdout.match(/TX:.*?\n\s+(\d+)/)
    if (txm) details.txBytes = formatBytes(parseInt(txm[1]))

    const bcastm = addrOut.stdout.match(/brd\s+(\S+)/)
    if (bcastm) details.broadcast = bcastm[1]

    return details as InterfaceDetails
  })

  ipcMain.handle('network:routing-table', async () => {
    const { stdout } = await runCommand('ip', ['route', 'show'])
    return stdout.trim()
  })

  ipcMain.handle('network:full-report', async (_, iface: string) => {
    const [addr, route, link] = await Promise.all([
      runCommand('ip', ['-o', 'addr', 'show', iface]),
      runCommand('ip', ['route', 'show']),
      runCommand('ip', ['-s', 'link', 'show', iface])
    ])

    const content = [
      '--- Interface Details ---',
      addr.stdout,
      '',
      '--- Routing Table ---',
      route.stdout,
      '',
      '--- Link Statistics ---',
      link.stdout
    ].join('\n')

    const path = await saveReport('network', content)
    return { content, path }
  })

  ipcMain.handle('network:arp-table', async () => {
    const { stdout } = await runCommand('ip', ['neigh', 'show'])
    return stdout.trim()
  })

  ipcMain.handle('network:wifi-info', async () => {
    const hasIw = await commandExists('iwconfig')
    if (!hasIw) return null
    const { stdout } = await runCommand('iwconfig')
    return stdout.trim()
  })

  ipcMain.handle('network:system-stats', async () => {
    const [uptime, loadavg, mem] = await Promise.all([
      simpleExec('uptime -p'),
      simpleExec('cat /proc/loadavg'),
      simpleExec("free -b | awk 'NR==2{print $2,$3,$4}'")
    ])

    const [total, used, free] = mem.split(' ').map(Number)
    const [one, five, fifteen] = loadavg.split(' ').map(parseFloat)

    return {
      uptime: uptime || 'unknown',
      loadAvg: { one, five, fifteen },
      memory: {
        total: formatBytes(total),
        used: formatBytes(used),
        free: formatBytes(free),
        percent: total ? Math.round((used / total) * 100) : 0
      }
    }
  })
}

function cidrToMask(prefix: number): string {
  const mask = new Array(4)
  for (let i = 0; i < 4; i++) {
    const bits = Math.min(prefix, 8)
    mask[i] = 256 - Math.pow(2, 8 - bits)
    prefix -= bits
  }
  return mask.join('.')
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
