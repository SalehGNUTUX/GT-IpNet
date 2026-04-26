import { readFile } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import { commandExists } from './exec'

const execAsync = promisify(exec)

// Same PATH fix as exec.ts — desktop launchers provide a restricted environment
const _FULL_PATH = [
  '/usr/local/sbin', '/usr/local/bin',
  '/usr/sbin', '/usr/bin', '/sbin', '/bin',
  process.env.PATH || ''
].filter(Boolean).join(':')

function _env(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...process.env, PATH: _FULL_PATH, LANG: 'C', LC_ALL: 'C', ...extra }
}

// ── Types ───────────────────────────────────────────────────────────────────

export type DeviceType =
  | 'iphone' | 'ipad' | 'mac' | 'apple-tv' | 'apple-watch'
  | 'android' | 'windows' | 'linux'
  | 'router' | 'switch' | 'access-point'
  | 'printer' | 'tv' | 'smart-home' | 'iot'
  | 'unknown'

export interface DeviceInfo {
  mac: string
  ip: string
  manufacturer: string
  deviceType: DeviceType
  deviceName: string       // e.g. "John's iPhone"
  modelId: string          // e.g. "iPhone14,2"
  modelName: string        // e.g. "iPhone 13 Pro"
  os: string               // e.g. "iOS 17.2"
  hostname: string
  source: string[]         // methods used: 'oui', 'mdns', 'nbns', 'nmap'
}

// ── OUI Database ─────────────────────────────────────────────────────────────

const OUI_PATHS = [
  '/usr/share/nmap/nmap-mac-prefixes',
  '/usr/share/arp-scan/ieee-oui.txt',
]

// Manufacturer name → device category heuristic
const MFR_TYPE_MAP: Record<string, DeviceType> = {
  apple:     'iphone',    // refined later by mDNS
  samsung:   'android',
  xiaomi:    'android',
  huawei:    'android',
  oppo:      'android',
  vivo:      'android',
  oneplus:   'android',
  realme:    'android',
  google:    'android',
  motorola:  'android',
  lenovo:    'android',
  nokia:     'android',
  zte:       'android',
  alcatel:   'android',
  tcl:       'android',
  nothing:   'android',
  microsoft: 'windows',
  hp:        'printer',
  canon:     'printer',
  epson:     'printer',
  brother:   'printer',
  cisco:     'router',
  juniper:   'router',
  ubiquiti:  'access-point',
  netgear:   'router',
  'tp-link': 'router',
  asus:      'router',
  linksys:   'router',
  dlink:     'router',
  'd-link':  'router',
  aruba:     'access-point',
  meraki:    'access-point',
  amazon:    'smart-home',
  roku:      'tv',
  sharp:     'tv',
  lg:        'tv',          // LG exited phones in 2021; most LG MACs = smart TV
  hisense:   'tv',
  philips:   'tv',
  sony:      'android',     // Sony Xperia still active; TV detection via mDNS services
  raspberry: 'linux',
}

let _ouiCache: Map<string, string> | null = null

async function loadOui(): Promise<Map<string, string>> {
  if (_ouiCache) return _ouiCache
  const db = new Map<string, string>()

  for (const path of OUI_PATHS) {
    try {
      const content = await readFile(path, 'utf8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        // nmap format: "000393 Apple"
        const nmapMatch = trimmed.match(/^([0-9A-Fa-f]{6})\s+(.+)$/)
        if (nmapMatch) {
          db.set(nmapMatch[1].toUpperCase(), nmapMatch[2].trim())
          continue
        }
        // arp-scan format: "00:00:00\tXerox\tXerox Corporation"
        const arpMatch = trimmed.match(/^([0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2})\t([^\t]+)/)
        if (arpMatch) {
          db.set(arpMatch[1].replace(/:/g, '').toUpperCase(), arpMatch[2].trim())
        }
      }
      if (db.size > 0) break
    } catch { /* try next file */ }
  }

  _ouiCache = db
  return db
}

export function ouiLookup(mac: string, db: Map<string, string>): string {
  const prefix = mac.replace(/[:\-\.]/g, '').toUpperCase().slice(0, 6)
  return db.get(prefix) ?? ''
}

function mfrToType(mfr: string): DeviceType {
  const lower = mfr.toLowerCase()
  for (const [key, type] of Object.entries(MFR_TYPE_MAP)) {
    if (lower.includes(key)) return type
  }
  return 'unknown'
}

// ── Apple Model Database ─────────────────────────────────────────────────────

const APPLE_MODELS: Record<string, string> = {
  // iPhone 16 series
  'iPhone17,1': 'iPhone 16 Pro', 'iPhone17,2': 'iPhone 16 Pro Max',
  'iPhone17,3': 'iPhone 16', 'iPhone17,4': 'iPhone 16 Plus',
  // iPhone 15 series
  'iPhone16,1': 'iPhone 15 Pro', 'iPhone16,2': 'iPhone 15 Pro Max',
  'iPhone15,4': 'iPhone 15', 'iPhone15,5': 'iPhone 15 Plus',
  // iPhone 14 series
  'iPhone15,2': 'iPhone 14 Pro', 'iPhone15,3': 'iPhone 14 Pro Max',
  'iPhone14,7': 'iPhone 14', 'iPhone14,8': 'iPhone 14 Plus',
  // iPhone 13 series
  'iPhone14,2': 'iPhone 13 Pro', 'iPhone14,3': 'iPhone 13 Pro Max',
  'iPhone14,4': 'iPhone 13 mini', 'iPhone14,5': 'iPhone 13',
  // iPhone 12 series
  'iPhone13,1': 'iPhone 12 mini', 'iPhone13,2': 'iPhone 12',
  'iPhone13,3': 'iPhone 12 Pro', 'iPhone13,4': 'iPhone 12 Pro Max',
  // iPhone 11 series
  'iPhone12,1': 'iPhone 11', 'iPhone12,3': 'iPhone 11 Pro',
  'iPhone12,5': 'iPhone 11 Pro Max', 'iPhone12,8': 'iPhone SE (2nd gen)',
  // iPhone X/XR/XS
  'iPhone10,1': 'iPhone 8', 'iPhone10,2': 'iPhone 8 Plus',
  'iPhone10,3': 'iPhone X', 'iPhone10,4': 'iPhone 8',
  'iPhone10,5': 'iPhone 8 Plus', 'iPhone10,6': 'iPhone X',
  'iPhone11,2': 'iPhone XS', 'iPhone11,4': 'iPhone XS Max',
  'iPhone11,6': 'iPhone XS Max', 'iPhone11,8': 'iPhone XR',
  // iPhone 7/6s/6
  'iPhone9,1': 'iPhone 7', 'iPhone9,2': 'iPhone 7 Plus',
  'iPhone9,3': 'iPhone 7', 'iPhone9,4': 'iPhone 7 Plus',
  'iPhone8,1': 'iPhone 6s', 'iPhone8,2': 'iPhone 6s Plus',
  'iPhone8,4': 'iPhone SE (1st gen)',
  'iPhone7,1': 'iPhone 6 Plus', 'iPhone7,2': 'iPhone 6',
  // iPad Pro
  'iPad16,3': 'iPad Pro 11" (M4)', 'iPad16,4': 'iPad Pro 11" (M4)',
  'iPad16,5': 'iPad Pro 13" (M4)', 'iPad16,6': 'iPad Pro 13" (M4)',
  'iPad14,3': 'iPad Pro 11" (M2)', 'iPad14,4': 'iPad Pro 11" (M2)',
  'iPad14,5': 'iPad Pro 12.9" (M2)', 'iPad14,6': 'iPad Pro 12.9" (M2)',
  'iPad13,4': 'iPad Pro 11" (M1)', 'iPad13,5': 'iPad Pro 11" (M1)',
  'iPad13,6': 'iPad Pro 11" (M1)', 'iPad13,7': 'iPad Pro 11" (M1)',
  'iPad13,8': 'iPad Pro 12.9" (M1)', 'iPad13,9': 'iPad Pro 12.9" (M1)',
  'iPad13,10': 'iPad Pro 12.9" (M1)', 'iPad13,11': 'iPad Pro 12.9" (M1)',
  // iPad Air
  'iPad14,8': 'iPad Air 13" (M2)', 'iPad14,9': 'iPad Air 13" (M2)',
  'iPad14,10': 'iPad Air 11" (M2)', 'iPad14,11': 'iPad Air 11" (M2)',
  'iPad13,16': 'iPad Air (M1)', 'iPad13,17': 'iPad Air (M1)',
  'iPad13,1': 'iPad Air (4th gen)', 'iPad13,2': 'iPad Air (4th gen)',
  'iPad11,3': 'iPad Air (3rd gen)', 'iPad11,4': 'iPad Air (3rd gen)',
  // iPad (base)
  'iPad14,1': 'iPad (10th gen)', 'iPad14,2': 'iPad (10th gen)',
  'iPad12,1': 'iPad (9th gen)', 'iPad12,2': 'iPad (9th gen)',
  'iPad11,6': 'iPad (8th gen)', 'iPad11,7': 'iPad (8th gen)',
  'iPad7,11': 'iPad (7th gen)', 'iPad7,12': 'iPad (7th gen)',
  // iPad mini
  'iPad16,1': 'iPad mini (7th gen)', 'iPad16,2': 'iPad mini (7th gen)',
  'iPad14,7': 'iPad mini (6th gen)',
  'iPad11,1': 'iPad mini (5th gen)', 'iPad11,2': 'iPad mini (5th gen)',
  // Mac
  'Mac15,3': 'MacBook Air 15" (M3)', 'Mac15,4': 'MacBook Air 13" (M3)',
  'Mac14,15': 'MacBook Air 15" (M2)', 'Mac14,2': 'MacBook Air 13" (M2)',
  'Mac14,3': 'Mac mini (M2)', 'Mac14,12': 'Mac mini (M2 Pro)',
  'Mac14,5': 'MacBook Pro 14" (M2 Pro)', 'Mac14,6': 'MacBook Pro 16" (M2 Max)',
  'MacBookPro18,1': 'MacBook Pro 16" (M1 Pro)', 'MacBookPro18,2': 'MacBook Pro 16" (M1 Max)',
  'MacBookPro18,3': 'MacBook Pro 14" (M1 Pro)', 'MacBookPro18,4': 'MacBook Pro 14" (M1 Max)',
  'MacBookAir10,1': 'MacBook Air (M1)',
  // Apple TV
  'AppleTV6,2': 'Apple TV 4K (3rd gen)', 'AppleTV11,1': 'Apple TV 4K (2nd gen)',
  'AppleTV5,3': 'Apple TV 4K (1st gen)', 'AppleTV3,1': 'Apple TV (3rd gen)',
  // Apple Watch
  'Watch7,1': 'Apple Watch Series 10 40mm', 'Watch7,2': 'Apple Watch Series 10 42mm',
  'Watch6,6': 'Apple Watch Ultra 2', 'Watch6,7': 'Apple Watch Ultra 2',
  'Watch6,9': 'Apple Watch SE (2nd gen) 40mm', 'Watch6,10': 'Apple Watch SE (2nd gen) 44mm',
  'Watch6,14': 'Apple Watch Series 9 41mm', 'Watch6,15': 'Apple Watch Series 9 45mm',
}

export function appleModelName(modelId: string): string {
  if (!modelId) return ''
  const clean = modelId.replace(/\\\,/g, ',')
  return APPLE_MODELS[clean] ?? modelId
}

function appleDeviceType(modelId: string): DeviceType {
  if (!modelId) return 'apple-tv'
  const c = modelId.toLowerCase()
  if (c.startsWith('iphone')) return 'iphone'
  if (c.startsWith('ipad'))   return 'ipad'
  if (c.startsWith('appletv')) return 'apple-tv'
  if (c.startsWith('watch'))  return 'apple-watch'
  if (c.startsWith('mac') || c.startsWith('macbook') || c.startsWith('imac') || c.startsWith('macpro') || c.startsWith('macmini')) return 'mac'
  return 'mac'
}

// ── mDNS / Avahi ─────────────────────────────────────────────────────────────

export interface MdnsDevice {
  ip: string
  hostname: string
  name: string
  modelId: string
  modelName: string
  os: string
  deviceType: DeviceType
  services: string[]
}

// Cache mDNS results (valid for 60s)
let _mdnsCache: Map<string, MdnsDevice> | null = null
let _mdnsCacheTs = 0

export async function runMdnsScan(timeoutMs = 10000): Promise<Map<string, MdnsDevice>> {
  const now = Date.now()
  if (_mdnsCache && now - _mdnsCacheTs < 60000) return _mdnsCache

  const result = new Map<string, MdnsDevice>()
  const hasAvahi = await commandExists('avahi-browse')

  if (hasAvahi) {
    // Pass 1: parseable format (-p) — best for structured data and Apple model IDs
    try {
      const { stdout } = await execAsync(
        `avahi-browse -a -t -r -p 2>/dev/null`,
        { timeout: timeoutMs, env: _env() }
      )
      parseAvahiOutput(stdout, result)
    } catch { /* timeout or no devices */ }

    // Pass 2: human-readable format — catches device display names (e.g. "Ahmed's Phone")
    // that may not appear in parseable output
    try {
      const { stdout } = await execAsync(
        `avahi-browse -a -t -r 2>/dev/null`,
        { timeout: timeoutMs, env: _env({ LANG: "UTF-8", LC_ALL: "UTF-8" }) }
      )
      parseAvahiHuman(stdout, result)
    } catch { /* ignore */ }
  }

  // Fallback: nmap mDNS script
  if (result.size === 0) {
    const hasNmap = await commandExists('nmap')
    if (hasNmap) {
      try {
        const { stdout } = await execAsync(
          `nmap -sU -p 5353 --script=mdns-sd --open -T4 224.0.0.251 2>/dev/null`,
          { timeout: timeoutMs, env: _env() }
        )
        parseNmapMdns(stdout, result)
      } catch { /* ignore */ }
    }
  }

  _mdnsCache = result
  _mdnsCacheTs = now
  return result
}

/** Resolve a single IP to hostname via avahi-resolve (fast, no scanning) */
export async function avahiResolveIp(ip: string): Promise<string> {
  try {
    const hasAvahi = await commandExists('avahi-resolve')
    if (!hasAvahi) return ''
    const { stdout } = await execAsync(
      `avahi-resolve --address ${ip} 2>/dev/null`,
      { timeout: 3000, env: _env() }
    )
    // Output: "192.168.1.5 Johns-iPhone.local"
    const m = stdout.match(/\S+\s+(\S+)/)
    return m ? m[1].replace(/\.local$/, '') : ''
  } catch { return '' }
}

/** NetBIOS lookup for Windows / some Android devices */
export async function nmblookupIp(ip: string): Promise<string> {
  try {
    const hasNmb = await commandExists('nmblookup')
    if (!hasNmb) return ''
    const { stdout } = await execAsync(
      `nmblookup -A ${ip} 2>/dev/null`,
      { timeout: 3000, env: _env() }
    )
    // "DESKTOP-ABC123 <00> - B <ACTIVE>"
    const m = stdout.match(/^\t(\S+)\s+<00>\s+-\s+\S\s+<ACTIVE>/m)
    return m ? m[1] : ''
  } catch { return '' }
}

function parseAvahiOutput(output: string, result: Map<string, MdnsDevice>): void {
  // Parseable format lines starting with '=' are resolved entries
  // =;eth0;IPv4;name;type;domain;hostname;IP;port;"txt"
  const lines = output.split('\n')

  for (const line of lines) {
    if (!line.startsWith('=')) continue
    const parts = line.split(';')
    if (parts.length < 9) continue

    const [, iface, proto, name, type, , hostname, ip, , ...txtParts] = parts
    if (!ip || ip === '0.0.0.0' || ip === '::1') continue

    const txt = txtParts.join(';')
    const modelIdMatch = txt.match(/model=([^"\\]+(?:\\,[^"\\]*)?)/)
    const modelId = modelIdMatch ? modelIdMatch[1].replace(/\\\,/g, ',') : ''
    const osMatch = txt.match(/osxvers=(\d+)/)

    const existing = result.get(ip) ?? {
      ip, hostname: hostname?.replace(/\.local$/, '') || '',
      name: name || '', modelId: '', modelName: '', os: '',
      deviceType: 'unknown' as DeviceType, services: []
    }

    if (modelId) existing.modelId = modelId
    if (modelId) existing.modelName = appleModelName(modelId)
    if (modelId) existing.deviceType = appleDeviceType(modelId)
    if (osMatch) existing.os = osVersionLabel(parseInt(osMatch[1]))
    if (type && !existing.services.includes(type)) existing.services.push(type)
    if (name && !existing.name) existing.name = name

    result.set(ip, existing)
  }
}

/** Parse avahi-browse human-readable output to extract display names */
function parseAvahiHuman(output: string, result: Map<string, MdnsDevice>): void {
  // Human format "=" lines look like:
  //   eth0  IPv4  Ahmed's iPhone  _apple-mobdev2._tcp  local
  // Then indented lines:
  //   hostname = [Ahmeds-iPhone.local]
  //   address = [192.168.1.5]
  const lines = output.split('\n')
  let currentName = ''
  let currentHostname = ''

  for (const line of lines) {
    // Resolved entry line starting with "="
    const eqMatch = line.match(/^=\s+\S+\s+IPv[46]\s+(.+?)\s{2,}_\S+\._\S+/)
    if (eqMatch) {
      currentName = eqMatch[1].trim()
      currentHostname = ''
      continue
    }
    // hostname sub-line
    const hnMatch = line.match(/hostname\s*=\s*\[([^\]]+)\]/)
    if (hnMatch) { currentHostname = hnMatch[1].replace(/\.local$/, ''); continue }
    // address sub-line — this is where we associate IP
    const addrMatch = line.match(/address\s*=\s*\[([0-9a-fA-F:.]+)\]/)
    if (addrMatch && currentName) {
      const ip = addrMatch[1]
      if (!ip || ip === '0.0.0.0' || ip.startsWith('::')) { currentName = ''; continue }
      const existing = result.get(ip)
      if (existing) {
        // Prefer non-empty name over existing
        if (!existing.name && currentName) existing.name = currentName
        if (!existing.hostname && currentHostname) existing.hostname = currentHostname
      } else {
        result.set(ip, {
          ip, name: currentName, hostname: currentHostname,
          modelId: '', modelName: '', os: '',
          deviceType: 'unknown', services: []
        })
      }
      currentName = ''
    }
  }
}

function parseNmapMdns(output: string, result: Map<string, MdnsDevice>): void {
  const ipMatch = output.match(/Nmap scan report for (\S+)/)
  const ip = ipMatch ? ipMatch[1] : ''
  if (!ip) return

  const names = [...output.matchAll(/\|\s+([^\n]+)/g)].map((m) => m[1].trim())
  if (names.length > 0 && ip) {
    result.set(ip, {
      ip, hostname: names[0], name: names[0],
      modelId: '', modelName: '', os: '',
      deviceType: 'unknown', services: names
    })
  }
}

function osVersionLabel(version: number): string {
  // macOS build → name (approximate mapping)
  const map: Record<number, string> = {
    24: 'macOS 15 Sequoia', 23: 'macOS 14 Sonoma',
    22: 'macOS 13 Ventura', 21: 'macOS 12 Monterey',
    20: 'iOS/macOS 11+', 19: 'macOS 10.15 Catalina',
  }
  return map[version] ?? `macOS/iOS ${version}`
}

// ── Hostname resolution ───────────────────────────────────────────────────────

export async function resolveHostname(ip: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `getent hosts ${ip}`,
      { timeout: 2000, env: _env() }
    )
    const parts = stdout.trim().split(/\s+/)
    return parts[1] || ''
  } catch {
    try {
      const { stdout } = await execAsync(
        `dig +short +time=1 -x ${ip}`,
        { timeout: 2000, env: _env() }
      )
      return stdout.trim().replace(/\.$/, '')
    } catch {
      return ''
    }
  }
}

// ── NetBIOS (Windows/Android) ──────────────────────────────────────────────────

export async function resolveNetbios(ip: string): Promise<string> {
  const hasNmblookup = await commandExists('nmblookup')
  if (!hasNmblookup) return ''
  try {
    const { stdout } = await execAsync(
      `nmblookup -A ${ip}`,
      { timeout: 3000, env: _env() }
    )
    const m = stdout.match(/^\s+(\S+)\s+<00>/m)
    return m ? m[1].trim() : ''
  } catch {
    return ''
  }
}

// ── Main enrichment function ──────────────────────────────────────────────────

export async function enrichHost(
  ip: string,
  mac: string,
  ouiDb: Map<string, string>,
  mdnsDevices: Map<string, MdnsDevice>
): Promise<Partial<DeviceInfo>> {
  const manufacturer = ouiLookup(mac, ouiDb)
  let deviceType = mfrToType(manufacturer)
  let deviceName = ''
  let modelId = ''
  let modelName = ''
  let os = ''
  let hostname = ''
  const source: string[] = []

  if (manufacturer) source.push('oui')

  // mDNS lookup (already scanned)
  const mdns = mdnsDevices.get(ip)
  if (mdns) {
    source.push('mdns')
    deviceName = mdns.name || mdns.hostname
    hostname   = mdns.hostname || mdns.name
    modelId    = mdns.modelId
    modelName  = mdns.modelName
    os         = mdns.os
    if (mdns.deviceType !== 'unknown') deviceType = mdns.deviceType
  }

  // Hostname: try avahi-resolve first (fast, mDNS-based), then DNS
  if (!hostname) {
    const avahiName = await avahiResolveIp(ip)
    if (avahiName) { hostname = avahiName; source.push('avahi-resolve') }
  }
  if (!hostname) {
    const resolved = await resolveHostname(ip)
    if (resolved) { hostname = resolved; source.push('dns') }
  }

  // NetBIOS for Windows / some Android devices
  if (!deviceName) {
    const nb = await nmblookupIp(ip)
    if (nb) { deviceName = nb; source.push('nbns') }
  }

  // Derive display name from hostname if still unknown
  if (!deviceName && hostname) deviceName = hostname.replace(/\.local$/, '')

  // Refine Apple device type from mDNS services
  if (mdns?.services) {
    if (mdns.services.some(s => s.includes('_apple-mobdev') || s.includes('_ipp') && modelId?.startsWith('iPhone'))) {
      deviceType = 'iphone'
    }
    if (mdns.services.some(s => s.includes('_googlecast') || s.includes('_androidtvremote'))) {
      deviceType = 'android'
      if (!deviceName && mdns.name) deviceName = mdns.name
    }
  }

  return { manufacturer, deviceType, deviceName, modelId, modelName, os, hostname, source }
}

// ── Batch enrichment ──────────────────────────────────────────────────────────

export interface HostBasic {
  ip: string
  mac: string
}

export async function enrichHosts(hosts: HostBasic[]): Promise<Map<string, Partial<DeviceInfo>>> {
  const [ouiDb, mdnsDevices] = await Promise.all([
    loadOui(),
    runMdnsScan(),
  ])

  const results = new Map<string, Partial<DeviceInfo>>()

  await Promise.all(
    hosts.map(async ({ ip, mac }) => {
      const info = await enrichHost(ip, mac, ouiDb, mdnsDevices)
      results.set(ip, info)
    })
  )

  return results
}

// ── Quick OUI-only lookup (synchronous once loaded) ───────────────────────────

export async function quickOuiEnrich(mac: string): Promise<{ manufacturer: string; deviceType: DeviceType }> {
  const db = await loadOui()
  const manufacturer = ouiLookup(mac, db)
  return { manufacturer, deviceType: mfrToType(manufacturer) }
}

// ── Export loaded OUI db for reuse ───────────────────────────────────────────

export { loadOui }
