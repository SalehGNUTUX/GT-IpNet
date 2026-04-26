import { ipcMain, BrowserWindow } from 'electron'
import { runCommand, streamCommand, commandExists } from '../utils/exec'
import { saveReport } from '../utils/report'

export interface SpeedResult {
  download: number
  upload: number
  ping: number
  jitter?: number
  server?: string
  isp?: string
  tool: string
}

let stopSpeed: (() => void) | null = null

export function registerSpeedIPC(win: BrowserWindow): void {
  ipcMain.handle('speed:check-tools', async () => {
    const [hasSpeedtest, hasIperf3, hasCurl] = await Promise.all([
      commandExists('speedtest-cli'),
      commandExists('iperf3'),
      commandExists('curl')
    ])
    return { speedtest: hasSpeedtest, iperf3: hasIperf3, curl: hasCurl }
  })

  ipcMain.handle('speed:run', async () => {
    const hasSpeedtest = await commandExists('speedtest-cli')

    if (hasSpeedtest) {
      const { stdout, code } = await runCommand('speedtest-cli', ['--simple'])
      if (code === 0) {
        const result = parseSpeedtestSimple(stdout)
        const path = await saveReport('speed', `Speed Test (speedtest-cli)\n\n${stdout}`)
        return { ...result, path }
      }
    }

    // Fallback: curl-based download measurement
    const hasCurl = await commandExists('curl')
    if (hasCurl) {
      const result = await curlSpeedTest()
      const path = await saveReport('speed', `Speed Test (curl)\nDownload: ${result.download.toFixed(1)} Mbps`)
      return { ...result, path }
    }

    return { error: 'No speed test tool available. Install speedtest-cli.', tool: 'none' }
  })

  ipcMain.handle('speed:stream', async () => {
    if (stopSpeed) { stopSpeed(); stopSpeed = null }

    const hasSpeedtest = await commandExists('speedtest-cli')
    if (!hasSpeedtest) {
      win.webContents.send('speed:stream', { error: 'speedtest-cli not installed', done: true })
      return
    }

    stopSpeed = await streamCommand(win, 'speedtest-cli', [], {
      channel: 'speed:stream',
      timeout: 120000
    })
  })

  ipcMain.handle('speed:stop', () => {
    if (stopSpeed) { stopSpeed(); stopSpeed = null; return true }
    return false
  })

  ipcMain.handle('speed:run-full', async () => {
    const hasSpeedtest = await commandExists('speedtest-cli')
    if (!hasSpeedtest) return { error: 'speedtest-cli not installed' }

    const { stdout, code } = await runCommand('speedtest-cli', ['--json'])
    if (code !== 0) return { error: 'speedtest-cli failed' }

    try {
      const data = JSON.parse(stdout)
      const result: SpeedResult = {
        download: data.download / 1e6,
        upload: data.upload / 1e6,
        ping: data.ping,
        server: data.server?.name,
        isp: data.client?.isp,
        tool: 'speedtest-cli'
      }
      const path = await saveReport('speed', `Speed Test (speedtest-cli JSON)\n\n${stdout}`)
      return { ...result, path }
    } catch {
      const result = parseSpeedtestSimple(stdout)
      return result
    }
  })
}

function parseSpeedtestSimple(output: string): SpeedResult {
  const ping = output.match(/Ping:\s+([\d.]+)\s+ms/)
  const down = output.match(/Download:\s+([\d.]+)\s+Mbit\/s/)
  const up = output.match(/Upload:\s+([\d.]+)\s+Mbit\/s/)

  return {
    download: down ? parseFloat(down[1]) : 0,
    upload: up ? parseFloat(up[1]) : 0,
    ping: ping ? parseFloat(ping[1]) : 0,
    tool: 'speedtest-cli'
  }
}

async function curlSpeedTest(): Promise<SpeedResult> {
  const urls = [
    'https://speed.cloudflare.com/__down?bytes=25000000',
    'http://ipv4.download.thinkbroadband.com/25MB.zip'
  ]

  for (const url of urls) {
    const { stdout, code } = await runCommand('curl', [
      '-o', '/dev/null',
      '-s',
      '-w', '%{speed_download}',
      '--max-time', '30',
      url
    ])

    if (code === 0 && stdout.trim()) {
      const bytesPerSec = parseFloat(stdout.trim())
      const mbps = (bytesPerSec * 8) / 1e6
      return { download: mbps, upload: 0, ping: 0, tool: 'curl' }
    }
  }

  return { download: 0, upload: 0, ping: 0, tool: 'curl' }
}
