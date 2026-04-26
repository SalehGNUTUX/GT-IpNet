import { runCommand, commandExists, simpleExec } from './exec'

export type PackageManager = 'apt' | 'dnf' | 'pacman' | 'zypper' | 'unknown'

export interface ToolInfo {
  name: string
  command: string
  apt?: string
  dnf?: string
  pacman?: string
  zypper?: string
  description: string
  required: boolean
}

export const TOOLS: ToolInfo[] = [
  {
    name: 'iproute2 (ip)',
    command: 'ip',
    apt: 'iproute2',
    dnf: 'iproute',
    pacman: 'iproute2',
    zypper: 'iproute2',
    description: 'Network interface and routing information',
    required: true
  },
  {
    name: 'ping',
    command: 'ping',
    apt: 'iputils-ping',
    dnf: 'iputils',
    pacman: 'iputils',
    zypper: 'iputils',
    description: 'ICMP ping test',
    required: true
  },
  {
    name: 'nmap',
    command: 'nmap',
    apt: 'nmap',
    dnf: 'nmap',
    pacman: 'nmap',
    zypper: 'nmap',
    description: 'Advanced network scanner',
    required: false
  },
  {
    name: 'arp-scan',
    command: 'arp-scan',
    apt: 'arp-scan',
    dnf: 'arp-scan',
    pacman: 'arp-scan',
    zypper: 'arp-scan',
    description: 'Fast ARP device discovery',
    required: false
  },
  {
    name: 'dig',
    command: 'dig',
    apt: 'dnsutils',
    dnf: 'bind-utils',
    pacman: 'bind',
    zypper: 'bind-utils',
    description: 'DNS resolution tool',
    required: false
  },
  {
    name: 'nslookup',
    command: 'nslookup',
    apt: 'dnsutils',
    dnf: 'bind-utils',
    pacman: 'bind',
    zypper: 'bind-utils',
    description: 'DNS lookup tool',
    required: false
  },
  {
    name: 'mtr',
    command: 'mtr',
    apt: 'mtr',
    dnf: 'mtr',
    pacman: 'mtr',
    zypper: 'mtr',
    description: 'Network route tracer (mtr)',
    required: false
  },
  {
    name: 'traceroute',
    command: 'traceroute',
    apt: 'traceroute',
    dnf: 'traceroute',
    pacman: 'traceroute',
    zypper: 'traceroute',
    description: 'Route tracing tool',
    required: false
  },
  {
    name: 'ss',
    command: 'ss',
    apt: 'iproute2',
    dnf: 'iproute',
    pacman: 'iproute2',
    zypper: 'iproute2',
    description: 'Socket statistics',
    required: false
  },
  {
    name: 'speedtest-cli',
    command: 'speedtest-cli',
    apt: 'speedtest-cli',
    dnf: 'speedtest-cli',
    pacman: 'speedtest-cli',
    zypper: 'speedtest-cli',
    description: 'Internet speed test',
    required: false
  },
  {
    name: 'iperf3',
    command: 'iperf3',
    apt: 'iperf3',
    dnf: 'iperf3',
    pacman: 'iperf3',
    zypper: 'iperf3',
    description: 'Network bandwidth measurement',
    required: false
  },
  {
    name: 'curl',
    command: 'curl',
    apt: 'curl',
    dnf: 'curl',
    pacman: 'curl',
    zypper: 'curl',
    description: 'HTTP/HTTPS requests',
    required: false
  },
  {
    name: 'netstat',
    command: 'netstat',
    apt: 'net-tools',
    dnf: 'net-tools',
    pacman: 'net-tools',
    zypper: 'net-tools',
    description: 'Network statistics (legacy)',
    required: false
  },
  {
    name: 'sudo',
    command: 'sudo',
    apt: 'sudo',
    dnf: 'sudo',
    pacman: 'sudo',
    zypper: 'sudo',
    description: 'Privilege escalation (terminal)',
    required: false
  },
  {
    name: 'pkexec (polkit)',
    command: 'pkexec',
    apt: 'pkexec',
    dnf: 'polkit',
    pacman: 'polkit',
    zypper: 'polkit',
    description: 'Polkit privilege escalation (GUI dialog for root operations)',
    required: false
  },
  {
    name: 'avahi-utils',
    command: 'avahi-browse',
    apt: 'avahi-utils',
    dnf: 'avahi-tools',
    pacman: 'avahi',
    zypper: 'avahi',
    description: 'mDNS/Bonjour device discovery (real device names & models)',
    required: false
  }
]

let _detectedPM: PackageManager | null = null

export async function detectPackageManager(): Promise<PackageManager> {
  if (_detectedPM) return _detectedPM

  const checks: [string, PackageManager][] = [
    ['apt-get', 'apt'],
    ['dnf', 'dnf'],
    ['pacman', 'pacman'],
    ['zypper', 'zypper']
  ]

  for (const [cmd, pm] of checks) {
    if (await commandExists(cmd)) {
      _detectedPM = pm
      return pm
    }
  }

  _detectedPM = 'unknown'
  return 'unknown'
}

export interface ToolStatus {
  tool: ToolInfo
  installed: boolean
  installCmd?: string
}

export async function checkAllTools(): Promise<ToolStatus[]> {
  const pm = await detectPackageManager()
  const results: ToolStatus[] = []

  for (const tool of TOOLS) {
    const installed = await commandExists(tool.command)
    const pkg = pm !== 'unknown' ? tool[pm] : undefined

    let installCmd: string | undefined
    if (!installed && pkg) {
      switch (pm) {
        case 'apt':
          installCmd = `sudo apt-get install -y ${pkg}`
          break
        case 'dnf':
          installCmd = `sudo dnf install -y ${pkg}`
          break
        case 'pacman':
          installCmd = `sudo pacman -S --noconfirm ${pkg}`
          break
        case 'zypper':
          installCmd = `sudo zypper install -y ${pkg}`
          break
      }
    }

    results.push({ tool, installed, installCmd })
  }

  return results
}

export async function installTool(toolCommand: string): Promise<{ success: boolean; output: string }> {
  const pm = await detectPackageManager()
  const tool = TOOLS.find((t) => t.command === toolCommand)

  if (!tool) return { success: false, output: 'Unknown tool' }
  if (pm === 'unknown') return { success: false, output: 'No supported package manager found' }

  const pkg = tool[pm]
  if (!pkg) return { success: false, output: 'No package available for this distro' }

  // Use runCommand with sudo:true so it goes through the 3-tier elevation system
  // (root → sudo -n → pkexec GUI dialog). This works correctly in packaged GUI apps.
  let cmd: string
  let args: string[]
  switch (pm) {
    case 'apt':    cmd = 'apt-get'; args = ['install', '-y', pkg]; break
    case 'dnf':    cmd = 'dnf';     args = ['install', '-y', pkg]; break
    case 'pacman': cmd = 'pacman';  args = ['-S', '--noconfirm', pkg]; break
    case 'zypper': cmd = 'zypper';  args = ['install', '-y', pkg]; break
    default:       return { success: false, output: 'Unknown package manager' }
  }

  const { stdout, stderr, code, needsElevation } = await runCommand(cmd, args, true)

  if (needsElevation) {
    return {
      success: false,
      output: 'Elevation required. Install pkexec (polkit) for GUI privilege dialogs:\nsudo apt install polkitd pkexec'
    }
  }

  return { success: code === 0, output: stdout || stderr }
}

export async function getDistroInfo(): Promise<{ name: string; version: string; pm: PackageManager }> {
  const name = await simpleExec('lsb_release -si 2>/dev/null || cat /etc/os-release | grep ^NAME= | cut -d= -f2 | tr -d \'"\'')
  const version = await simpleExec('lsb_release -sr 2>/dev/null || cat /etc/os-release | grep ^VERSION_ID= | cut -d= -f2 | tr -d \'"\'')
  const pm = await detectPackageManager()
  return { name: name || 'Linux', version: version || '', pm }
}
