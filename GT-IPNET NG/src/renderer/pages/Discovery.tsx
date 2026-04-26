import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Card, SectionTitle, Badge, Btn, Progress, TerminalOutput, StatCard, ErrorBoundary } from '../components/ui'
import { ElevationRequired } from '../components/layout/PrivilegeBanner'
import { useI18n } from '../hooks/useI18n'
import { useAppStore, LastDiscovery, SavedHost } from '../store/appStore'

// ── Device type definitions ──────────────────────────────────────────────────

type DeviceType =
  | 'iphone' | 'ipad' | 'mac' | 'apple-tv' | 'apple-watch'
  | 'android' | 'windows' | 'linux'
  | 'router' | 'switch' | 'access-point'
  | 'printer' | 'tv' | 'smart-home' | 'iot' | 'unknown'

interface DeviceInfo {
  manufacturer: string
  deviceType: DeviceType
  deviceName: string
  modelId: string
  modelName: string
  os: string
  hostname: string
  source: string[]
  identifying?: boolean
}

interface Host {
  ip: string
  mac: string
  hostname: string
  vendor: string
  status: 'online' | 'filtered' | 'unknown'
  latency?: string
  device?: DeviceInfo
}

// Saved → runtime (strip identifying flag, cast deviceType)
function fromSaved(h: SavedHost): Host {
  return {
    ...h,
    device: h.device ? { ...h.device, deviceType: h.device.deviceType as DeviceType, identifying: false } : undefined,
  }
}

// Runtime → saved (strip identifying flag)
function toSaved(h: Host): SavedHost {
  return {
    ...h,
    device: h.device
      ? { manufacturer: h.device.manufacturer, deviceType: h.device.deviceType,
          deviceName: h.device.deviceName, modelId: h.device.modelId,
          modelName: h.device.modelName, os: h.device.os,
          hostname: h.device.hostname, source: h.device.source }
      : undefined,
  }
}

function formatDate(iso: string, lang: string): string {
  try {
    return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-MA' : 'en-GB', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return iso }
}

// ── Device icons ──────────────────────────────────────────────────────────────

function DeviceIcon({ type, size = 20 }: { type: DeviceType; size?: number }) {
  const icons: Record<DeviceType, string> = {
    iphone: '📱', ipad: '⬛', mac: '💻', 'apple-tv': '🖥️', 'apple-watch': '⌚',
    android: '📱', windows: '🖥️', linux: '🐧',
    router: '🌐', switch: '🔌', 'access-point': '📡',
    printer: '🖨️', tv: '📺', 'smart-home': '🏠', iot: '💡', unknown: '❓'
  }
  return <span style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }}>{icons[type] ?? '❓'}</span>
}

const TYPE_COLOR: Record<DeviceType, string> = {
  iphone: '#79C0FF', ipad: '#79C0FF', mac: '#B3BAC2', 'apple-tv': '#6E7681', 'apple-watch': '#79C0FF',
  android: '#3FB950', windows: '#79C0FF', linux: '#E3B341',
  router: '#F5B800', switch: '#F5B800', 'access-point': '#FFA657',
  printer: '#D2A8FF', tv: '#D2A8FF', 'smart-home': '#3FB950', iot: '#3FB950', unknown: '#6E7681'
}

const DEVICE_LABELS: Record<DeviceType, string> = {
  iphone: 'iPhone', ipad: 'iPad', mac: 'Mac', 'apple-tv': 'Apple TV', 'apple-watch': 'Apple Watch',
  android: 'Android', windows: 'Windows', linux: 'Linux',
  router: 'Router', switch: 'Switch', 'access-point': 'Access Point',
  printer: 'Printer', tv: 'Smart TV', 'smart-home': 'Smart Home', iot: 'IoT', unknown: 'Unknown'
}

// ── Cache Banner ──────────────────────────────────────────────────────────────

function CacheBanner({ discovery, lang, onRefresh, t }: {
  discovery: LastDiscovery; lang: string; onRefresh: () => void
  t: (k: string) => string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      background: 'rgba(245,184,0,0.05)',
      border: '1px solid rgba(245,184,0,0.18)',
      borderRadius: 8, padding: '10px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12 }}>
        <span style={{ fontSize: 15 }}>🕐</span>
        <span style={{ color: '#8B949E' }}>
          {lang === 'ar' ? 'نتائج محفوظة من' : 'Cached results from'}{' '}
          <strong style={{ color: '#E6EDF3' }}>{formatDate(discovery.date, lang)}</strong>
        </span>
        <span style={{ color: '#484F58' }}>·</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#79C0FF' }}>
          {discovery.iface}
        </span>
        <span style={{ color: '#484F58' }}>·</span>
        <span style={{ fontSize: 11, color: '#6E7681' }}>
          {discovery.mode === 'quick' ? t('quickScan') : t('fullScan')}
        </span>
        <span style={{ fontSize: 11, color: '#6E7681' }}>
          · {discovery.hosts.length} {lang === 'ar' ? 'جهاز' : 'devices'}
        </span>
      </div>
      <button
        onClick={onRefresh}
        style={{
          flexShrink: 0, padding: '5px 14px', borderRadius: 6,
          border: '1px solid rgba(245,184,0,0.3)', background: 'rgba(245,184,0,0.08)',
          color: '#F5B800', fontSize: 12, cursor: 'pointer', fontWeight: 600,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245,184,0,0.18)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(245,184,0,0.08)')}
      >
        {lang === 'ar' ? '↺ فحص جديد' : '↺ Rescan'}
      </button>
    </div>
  )
}

// ── Component ────────────────────────────────────────────────────────────────

export function Discovery() {
  const { t, lang } = useI18n()
  const { activeInterface, addNotification, lastDiscovery, saveDiscovery } = useAppStore()

  const [hosts, setHosts] = useState<Host[]>([])
  const [fromCache, setFromCache] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [mode, setMode] = useState<'quick' | 'full'>('quick')
  const [progress, setProgress] = useState(0)
  const [streamLines, setStreamLines] = useState<{ text: string; isError?: boolean }[]>([])
  const [subnet, setSubnet] = useState('192.168.1.0/24')
  const [showTerminal, setShowTerminal] = useState(false)
  const [elevationError, setElevationError] = useState<string | null>(null)
  const [selectedHost, setSelectedHost] = useState<Host | null>(null)
  const [filterType, setFilterType] = useState<DeviceType | 'all'>('all')
  const [identifyingAll, setIdentifyingAll] = useState(false)

  const stopRef = useRef<(() => void) | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hostsRef = useRef(hosts)
  hostsRef.current = hosts
  const nmapPendingRef = useRef<{ ip: string; hostname?: string; latency?: string } | null>(null)

  // ── Load cached results on mount ──────────────────────────────────────────
  useEffect(() => {
    window.api.discovery.preload().catch(() => {})
    if (lastDiscovery && lastDiscovery.hosts.length > 0) {
      setHosts(lastDiscovery.hosts.map(fromSaved))
      setFromCache(true)
    }
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeInterface) {
      window.api.discovery.getSubnet(activeInterface).then((s) => { if (s) setSubnet(s) })
    }
  }, [activeInterface])

  // ── OUI quick-enrich ──────────────────────────────────────────────────────
  const quickEnrich = useCallback(async (host: Host): Promise<Host> => {
    if (!host.mac || host.mac === '(unknown)') return host
    try {
      const info = await window.api.discovery.ouiLookup(host.mac)
      return {
        ...host,
        vendor: host.vendor || info.manufacturer,
        device: {
          manufacturer: info.manufacturer, deviceType: info.deviceType,
          deviceName: '', modelId: '', modelName: '', os: '',
          hostname: host.hostname, source: ['oui'], identifying: true
        }
      }
    } catch { return host }
  }, [])

  // ── nmap multi-line parser ─────────────────────────────────────────────────
  const parseNmapStreamLine = useCallback((line: string): Host[] => {
    const results: Host[] = []

    const reportMatch = line.match(/Nmap scan report for (.+)$/)
    if (reportMatch) {
      if (nmapPendingRef.current?.ip) {
        results.push({
          ip: nmapPendingRef.current.ip, mac: '', vendor: '',
          hostname: nmapPendingRef.current.hostname || '',
          status: 'online', latency: nmapPendingRef.current.latency,
        })
      }
      const raw = reportMatch[1].trim()
      const ipMatch = raw.match(/\((\d+\.\d+\.\d+\.\d+)\)/)
      const ip = ipMatch ? ipMatch[1] : raw
      const hostname = ipMatch ? raw.replace(/\s*\([^)]+\)$/, '').trim() : ''
      nmapPendingRef.current = { ip, hostname }
      return results
    }

    if (!nmapPendingRef.current) return results

    const latencyMatch = line.match(/Host is up \(([^)]+?)\s*latency\)/)
    if (latencyMatch) { nmapPendingRef.current.latency = latencyMatch[1]; return results }

    const macMatch = line.match(/MAC Address:\s+([0-9A-Fa-f:]+)\s+\(([^)]+)\)/)
    if (macMatch) {
      results.push({
        ip: nmapPendingRef.current.ip, mac: macMatch[1], vendor: macMatch[2],
        hostname: nmapPendingRef.current.hostname || '',
        status: 'online', latency: nmapPendingRef.current.latency,
      })
      nmapPendingRef.current = null
      return results
    }

    if (line.startsWith('Nmap done:') && nmapPendingRef.current?.ip) {
      results.push({
        ip: nmapPendingRef.current.ip, mac: '', vendor: '',
        hostname: nmapPendingRef.current.hostname || '',
        status: 'online', latency: nmapPendingRef.current.latency,
      })
      nmapPendingRef.current = null
    }

    return results
  }, [])

  const addHost = useCallback(async (host: Host) => {
    const enriched = await quickEnrich(host)
    setHosts((p) => {
      if (p.find((h) => h.ip === enriched.ip)) return p
      return [...p, enriched]
    })
  }, [quickEnrich])

  // ── Identification + save ─────────────────────────────────────────────────
  const identifyAllHosts = useCallback(async (
    currentHosts: Host[],
    onComplete?: (finalHosts: Host[]) => void
  ) => {
    const toEnrich = currentHosts
      .filter((h) => h.mac && h.mac !== '(unknown)')
      .map((h) => ({ ip: h.ip, mac: h.mac }))
    if (toEnrich.length === 0) { onComplete?.(currentHosts); return }

    setIdentifyingAll(true)
    try {
      const enriched = await window.api.discovery.enrich(toEnrich)
      let finalHosts: Host[] = currentHosts
      setHosts((prev) => {
        finalHosts = prev.map((h) => {
          const info = enriched[h.ip]
          if (!info) return h
          return { ...h, hostname: info.hostname || h.hostname, device: { ...info, identifying: false } }
        })
        return finalHosts
      })
      onComplete?.(finalHosts)
    } catch { onComplete?.(currentHosts) }
    finally { setIdentifyingAll(false) }
  }, [])

  // ── Scan ──────────────────────────────────────────────────────────────────
  const startScan = useCallback(async () => {
    if (!activeInterface) { addNotification({ type: 'warning', title: t('selectInterface') }); return }
    setScanning(true); setHosts([]); setStreamLines([]); setProgress(0)
    setShowTerminal(false); setElevationError(null); setFromCache(false)
    nmapPendingRef.current = null

    const maxTime = mode === 'quick' ? 20000 : 90000
    let elapsed = 0
    progressRef.current = setInterval(() => {
      elapsed += 300
      setProgress(Math.min(90, (elapsed / maxTime) * 100))
    }, 300)

    stopRef.current = window.api.discovery.onStream(async (data: any) => {
      if (data.line) {
        setStreamLines((p) => [...p, { text: data.line, isError: data.isError }])
        if (mode === 'quick') {
          const host = parseArpLine(data.line)
          if (host) addHost(host)
        } else {
          const hosts = parseNmapStreamLine(data.line)
          for (const h of hosts) addHost(h)
        }
      }
      if (data.done) {
        if (nmapPendingRef.current?.ip) {
          addHost({
            ip: nmapPendingRef.current.ip, mac: '', vendor: '',
            hostname: nmapPendingRef.current.hostname || '',
            status: 'online', latency: nmapPendingRef.current.latency,
          })
          nmapPendingRef.current = null
        }
        if (progressRef.current) clearInterval(progressRef.current)
        setProgress(100); setScanning(false)

        if (data.needsElevation) {
          setElevationError(mode === 'quick' ? 'arp-scan' : 'nmap')
        } else {
          const count = hostsRef.current.length
          addNotification({ type: 'success', title: t('success'), message: `${count} ${t('hostsFound')}` })

          // Identify + save to localStorage
          const snapIface = activeInterface
          const snapMode  = mode
          const snapSubnet = subnet
          identifyAllHosts(hostsRef.current, (finalHosts) => {
            saveDiscovery({
              hosts: finalHosts.map(toSaved),
              date: new Date().toISOString(),
              iface: snapIface,
              mode: snapMode,
              subnet: snapSubnet,
            })
          })
        }
        setTimeout(() => setProgress(0), 1500)
      }
    })

    await window.api.discovery.streamScan(activeInterface, mode, subnet)
  }, [activeInterface, mode, subnet, t, addNotification, addHost, parseNmapStreamLine, identifyAllHosts, saveDiscovery])

  const stopScan = async () => {
    await window.api.discovery.stop()
    if (stopRef.current) stopRef.current()
    if (progressRef.current) clearInterval(progressRef.current)
    setScanning(false); setProgress(0)
  }

  const runMdnsScan = async () => {
    setIdentifyingAll(true)
    addNotification({ type: 'info', title: 'mDNS scan started', message: 'Discovering device names…' })
    try {
      const devices = await window.api.discovery.mdnsScan()
      const deviceMap = devices as Record<string, any>
      let finalHosts: Host[] = []
      setHosts((prev) => {
        finalHosts = prev.map((h) => {
          const d = deviceMap[h.ip]
          if (!d) return h
          return {
            ...h, hostname: d.hostname || h.hostname,
            device: {
              ...(h.device ?? {}),
              deviceName: d.name || d.hostname || h.device?.deviceName || '',
              hostname: d.hostname || h.device?.hostname || '',
              modelId: d.modelId || '', modelName: d.modelName || '',
              os: d.os || '',
              deviceType: d.deviceType !== 'unknown' ? d.deviceType : (h.device?.deviceType ?? 'unknown'),
              source: [...new Set([...(h.device?.source ?? []), 'mdns'])],
              identifying: false,
            } as DeviceInfo
          }
        })
        return finalHosts
      })
      // Persist updated results
      if (lastDiscovery) {
        saveDiscovery({ ...lastDiscovery, hosts: finalHosts.map(toSaved), date: new Date().toISOString() })
      }
      addNotification({ type: 'success', title: 'mDNS complete' })
    } finally { setIdentifyingAll(false) }
  }

  const deepIdentify = async (host: Host) => {
    setHosts((prev) => prev.map((h) =>
      h.ip === host.ip ? { ...h, device: { ...(h.device as DeviceInfo), identifying: true } } : h
    ))
    try {
      const info = await window.api.discovery.identifyHost(host.ip, host.mac)
      let finalHosts: Host[] = []
      setHosts((prev) => {
        finalHosts = prev.map((h) =>
          h.ip === host.ip ? { ...h, hostname: info.hostname || h.hostname, device: { ...info, identifying: false } } : h
        )
        return finalHosts
      })
      // Persist updated single host
      if (lastDiscovery) {
        saveDiscovery({ ...lastDiscovery, hosts: finalHosts.map(toSaved), date: new Date().toISOString() })
      }
    } catch { /* ignore */ }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const displayHosts = filterType === 'all' ? hosts : hosts.filter((h) => h.device?.deviceType === filterType)
  const mobileCount = hosts.filter((h) => ['iphone', 'ipad', 'android'].includes(h.device?.deviceType ?? '')).length
  const pcCount     = hosts.filter((h) => ['mac', 'windows', 'linux'].includes(h.device?.deviceType ?? '')).length
  const netCount    = hosts.filter((h) => ['router', 'switch', 'access-point'].includes(h.device?.deviceType ?? '')).length
  const deviceTypes = [...new Set(hosts.map((h) => h.device?.deviceType).filter(Boolean))] as DeviceType[]

  return (
    <ErrorBoundary name="Discovery">
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: '#E6EDF3', margin: 0 }}>{t('discovery')}</h1>
          <p style={{ fontSize: 11, color: '#6E7681', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{subnet}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SegmentedControl
            options={[{ value: 'quick', label: t('quickScan') }, { value: 'full', label: t('fullScan') }]}
            value={mode} onChange={(v) => setMode(v as any)} disabled={scanning}
          />
          <Btn variant="ghost" size="sm" onClick={runMdnsScan}
            loading={identifyingAll} disabled={scanning || hosts.length === 0}
            title="Scan for device names via mDNS">
            mDNS
          </Btn>
          {scanning
            ? <Btn variant="danger" onClick={stopScan}>{t('stopScan')}</Btn>
            : <Btn variant="primary" onClick={startScan}>{t('scanNetwork')}</Btn>
          }
        </div>
      </div>

      {/* ── Cache Banner ────────────────────────────────────────── */}
      {fromCache && lastDiscovery && (
        <CacheBanner discovery={lastDiscovery} lang={lang} onRefresh={startScan} t={t} />
      )}

      {/* ── Stats ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
        <StatCard label={lang === 'ar' ? 'الإجمالي' : 'Total'} value={hosts.length} color="amber" />
        <StatCard label="📱 Mobile" value={mobileCount} color="cyan" />
        <StatCard label="💻 PC / Mac" value={pcCount} color="blue" />
        <StatCard label="🌐 Network" value={netCount} color="yellow" />
      </div>

      {/* ── Elevation error ─────────────────────────────────────── */}
      {elevationError && <ElevationRequired command={elevationError} />}

      {/* ── Progress ────────────────────────────────────────────── */}
      {(scanning || progress > 0) && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#E6EDF3', fontWeight: 500 }}>{t('scanning')}</span>
            <span style={{ fontSize: 11, color: '#6E7681', fontFamily: 'var(--font-mono)' }}>{Math.round(progress)}%</span>
            {identifyingAll && (
              <span style={{ fontSize: 11, color: '#79C0FF', marginInlineStart: 'auto' }}>
                {lang === 'ar' ? 'جارٍ التعرف على الأجهزة…' : 'Identifying devices…'}
              </span>
            )}
          </div>
          <Progress value={progress} color="amber" />
        </Card>
      )}

      {/* ── Device type filter ──────────────────────────────────── */}
      {deviceTypes.length > 1 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <FilterChip
            label={lang === 'ar' ? 'الكل' : 'All'}
            value="all" active={filterType === 'all'} count={hosts.length}
            onClick={() => setFilterType('all')}
          />
          {deviceTypes.map((dt) => (
            <FilterChip
              key={dt} label={DEVICE_LABELS[dt]} value={dt}
              active={filterType === dt}
              count={hosts.filter((h) => h.device?.deviceType === dt).length}
              onClick={() => setFilterType(filterType === dt ? 'all' : dt)}
            />
          ))}
        </div>
      )}

      {/* ── Results table ───────────────────────────────────────── */}
      <Card padding={false}>
        <div style={{ padding: '14px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SectionTitle>
            {displayHosts.length} {t('activeHosts')}
            {fromCache && !scanning && (
              <span style={{ fontSize: 10, color: '#6E7681', fontWeight: 400, marginInlineStart: 8 }}>
                {lang === 'ar' ? '(محفوظة)' : '(cached)'}
              </span>
            )}
          </SectionTitle>
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            style={{ fontSize: 11, color: '#6E7681', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {showTerminal ? '▲ Hide' : '▼ Raw output'}
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #30363D' }}>
                {['', t('ipAddress'), 'Device', t('hostname'), t('macAddress'), t('vendor'), t('latency'), ''].map((h, i) => (
                  <th key={i} style={{
                    textAlign: 'left', padding: '8px 10px', color: '#6E7681',
                    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.06em', whiteSpace: 'nowrap'
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayHosts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: '#6E7681' }}>
                    {scanning ? t('scanning') : t('noData')}
                  </td>
                </tr>
              ) : displayHosts.map((host) => (
                <HostRow
                  key={host.ip}
                  host={host}
                  onSelect={() => setSelectedHost(host)}
                  onDeepScan={() => deepIdentify(host)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Terminal ────────────────────────────────────────────── */}
      {showTerminal && streamLines.length > 0 && (
        <TerminalOutput lines={streamLines} style={{ maxHeight: 180 }} />
      )}

      {/* ── Detail modal ────────────────────────────────────────── */}
      {selectedHost && (
        <HostDetailModal
          host={selectedHost}
          onClose={() => setSelectedHost(null)}
          onDeepScan={() => deepIdentify(selectedHost)}
        />
      )}
    </div>
    </ErrorBoundary>
  )
}

// ── Host Row ──────────────────────────────────────────────────────────────────

function HostRow({ host, onSelect, onDeepScan }: {
  host: Host; onSelect: () => void; onDeepScan: () => void
}) {
  const dt = host.device?.deviceType ?? 'unknown'
  const color = TYPE_COLOR[dt]
  const displayName = host.device?.modelName || host.device?.deviceName || host.device?.manufacturer || ''

  return (
    <tr
      style={{ borderBottom: '1px solid #21262D', transition: 'background 0.1s' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#1C2128')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <td style={{ padding: '8px 10px', width: 36 }}>
        <DeviceIcon type={dt} size={18} />
      </td>
      <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', color: '#79C0FF', whiteSpace: 'nowrap' }}>
        {host.ip}
      </td>
      <td style={{ padding: '8px 10px', minWidth: 160 }}>
        {host.device?.identifying ? (
          <span style={{ color: '#6E7681', fontSize: 11, fontStyle: 'italic' }}>Identifying…</span>
        ) : displayName ? (
          <div>
            <div style={{ color, fontWeight: 600, fontSize: 12 }}>{displayName}</div>
            <div style={{ color: '#6E7681', fontSize: 11 }}>{DEVICE_LABELS[dt]}</div>
          </div>
        ) : (
          <div style={{ color: '#6E7681', fontSize: 11 }}>{DEVICE_LABELS[dt]}</div>
        )}
      </td>
      <td style={{ padding: '8px 10px', color: '#E6EDF3', maxWidth: 140 }}>
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {host.device?.deviceName || host.hostname || '—'}
        </span>
        {host.device?.os && (
          <span style={{ color: '#6E7681', fontSize: 10 }}>{host.device.os}</span>
        )}
      </td>
      <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', color: '#6E7681', whiteSpace: 'nowrap' }}>
        {host.mac || '—'}
      </td>
      <td style={{ padding: '8px 10px', color: '#B3BAC2', maxWidth: 120 }}>
        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {host.device?.manufacturer || host.vendor || '—'}
        </span>
      </td>
      <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', color: '#E3B341', whiteSpace: 'nowrap' }}>
        {host.latency || '—'}
      </td>
      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
        <button onClick={onSelect}
          style={{ fontSize: 11, color: '#6E7681', background: 'none', border: 'none', cursor: 'pointer', marginInlineEnd: 8 }}>
          Info
        </button>
        {!host.device?.identifying && (
          <button onClick={onDeepScan}
            style={{ fontSize: 11, color: '#79C0FF', background: 'none', border: 'none', cursor: 'pointer' }}>
            Identify
          </button>
        )}
      </td>
    </tr>
  )
}

// ── Host Detail Modal ─────────────────────────────────────────────────────────

function HostDetailModal({ host, onClose, onDeepScan }: {
  host: Host; onClose: () => void; onDeepScan: () => void
}) {
  const d = host.device
  const dt = d?.deviceType ?? 'unknown'
  const color = TYPE_COLOR[dt]

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: '#161B22', border: '1px solid #30363D', borderRadius: 12,
        padding: 24, width: 520, maxHeight: '75vh', overflow: 'auto', animation: 'fadeIn 0.2s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}><DeviceIcon type={dt} size={40} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color, marginBottom: 2 }}>
              {d?.modelName || d?.deviceName || d?.manufacturer || host.ip}
            </div>
            <div style={{ fontSize: 12, color: '#6E7681' }}>{DEVICE_LABELS[dt]}{d?.os ? ` · ${d.os}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6E7681', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <DetailItem icon="🌐" label="IP Address" value={host.ip} mono />
          <DetailItem icon="🔌" label="MAC Address" value={host.mac || '—'} mono />
          {(d?.hostname || host.hostname) && <DetailItem icon="💬" label="Hostname" value={d?.hostname || host.hostname} />}
          {d?.manufacturer && <DetailItem icon="🏭" label="Manufacturer" value={d.manufacturer} />}
          {d?.modelId && <DetailItem icon="🔖" label="Model ID" value={d.modelId} mono />}
          {d?.modelName && <DetailItem icon="📋" label="Model" value={d.modelName} />}
          {d?.os && <DetailItem icon="⚙️" label="OS" value={d.os} />}
          {host.latency && <DetailItem icon="⏱️" label="Latency" value={host.latency} mono />}
        </div>

        {d?.source && d.source.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: '#6E7681' }}>Sources:</span>
            {d.source.map((s) => (
              <span key={s} style={{
                fontSize: 11, background: '#21262D', color: '#79C0FF',
                padding: '2px 8px', borderRadius: 4, fontFamily: 'var(--font-mono)'
              }}>{s}</span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid #21262D' }}>
          <Btn variant="secondary" size="sm" onClick={onDeepScan}>Deep Identify (nmap)</Btn>
        </div>
      </div>
    </div>
  )
}

function DetailItem({ icon, label, value, mono }: { icon: string; label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ background: '#0D1117', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: '#6E7681', marginBottom: 3 }}>{icon} {label}</div>
      <div style={{ fontSize: 12, color: '#E6EDF3', fontFamily: mono ? 'var(--font-mono)' : 'inherit', wordBreak: 'break-all' }}>
        {value}
      </div>
    </div>
  )
}

// ── Filter Chip ───────────────────────────────────────────────────────────────

function FilterChip({ label, value, active, count, onClick }: {
  label: string; value: string; active: boolean; count: number; onClick: () => void
}) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
      border: active ? '1px solid #F5B800' : '1px solid #30363D',
      background: active ? 'rgba(245,184,0,0.1)' : '#21262D',
      color: active ? '#F5B800' : '#8B949E',
      transition: 'all 0.1s',
    }}>
      {label}
      <span style={{ fontSize: 11, opacity: 0.7 }}>{count}</span>
    </button>
  )
}

// ── Segmented Control ─────────────────────────────────────────────────────────

function SegmentedControl({ options, value, onChange, disabled }: {
  options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #30363D' }}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} disabled={disabled}
          style={{
            padding: '7px 14px', fontSize: 12, border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            background: value === o.value ? '#F5B800' : '#21262D',
            color: value === o.value ? '#0D1117' : '#8B949E',
            fontWeight: value === o.value ? 700 : 400,
          }}
        >{o.label}</button>
      ))}
    </div>
  )
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseArpLine(line: string): Host | null {
  const arp = line.match(/^(\d+\.\d+\.\d+\.\d+)\t([0-9a-fA-F:]{17})\t(.*)$/)
  if (arp) return { ip: arp[1], mac: arp[2], vendor: arp[3].trim(), hostname: '', status: 'online' }

  const arpSpace = line.match(/^(\d+\.\d+\.\d+\.\d+)\s{2,}([0-9a-fA-F:]{17})\s+(.*)$/)
  if (arpSpace) return { ip: arpSpace[1], mac: arpSpace[2], vendor: arpSpace[3].trim(), hostname: '', status: 'online' }

  return null
}
