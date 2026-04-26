import React, { useState, useEffect } from 'react'
import { Card, SectionTitle, Badge, Btn, Input, StatCard } from '../components/ui'
import { useI18n } from '../hooks/useI18n'
import { useAppStore } from '../store/appStore'

type FilterType = 'all' | 'tcp' | 'udp'
type ViewMode = 'listening' | 'connections'

interface Port {
  protocol: string
  localAddr: string
  localPort: number
  remoteAddr: string
  remotePort: number
  state: string
  pid: string
  program: string
}

export function Ports() {
  const { t } = useI18n()
  const { addNotification } = useAppStore()
  const [ports, setPorts] = useState<Port[]>([])
  const [connections, setConnections] = useState<Port[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterType>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('listening')
  const [search, setSearch] = useState('')
  const [tool, setTool] = useState('')
  const [scanIp, setScanIp] = useState('')
  const [scanRange, setScanRange] = useState('1-1000')
  const [scanResult, setScanResult] = useState<any>(null)
  const [scanning, setScanning] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const f = filter === 'all' ? undefined : filter
      const [portsData, connData] = await Promise.all([
        window.api.ports.list(f),
        window.api.ports.connections()
      ])
      if (portsData.error) {
        addNotification({ type: 'error', title: t('error'), message: portsData.error })
      } else {
        setPorts(portsData.ports || [])
        setTool(portsData.tool || '')
      }
      if (!connData.error) setConnections(connData.connections || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  const doHostScan = async () => {
    if (!scanIp.trim()) return
    setScanning(true)
    setScanResult(null)
    try {
      const result = await window.api.ports.scanHost(scanIp.trim(), scanRange)
      setScanResult(result)
    } finally {
      setScanning(false)
    }
  }

  const displayed = (viewMode === 'listening' ? ports : connections).filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.localAddr.includes(q) ||
      String(p.localPort).includes(q) ||
      p.program.toLowerCase().includes(q) ||
      p.protocol.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex flex-col gap-6 animate-fade">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#E6EDF3]">{t('ports')}</h1>
          {tool && <p className="text-xs text-[#6E7681] mt-0.5">via {tool}</p>}
        </div>
        <Btn variant="secondary" onClick={load} loading={loading}>{t('refresh')}</Btn>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label={t('openPorts')} value={ports.length} color="amber" />
        <StatCard label={t('connections')} value={connections.length} color="cyan" />
        <StatCard label="TCP" value={ports.filter((p) => p.protocol.includes('tcp')).length} color="blue" />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded overflow-hidden border border-[#30363D]">
          {(['listening', 'connections'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-3 py-1.5 text-xs transition-colors capitalize ${
                viewMode === m
                  ? 'bg-[#F5B800] text-[#0D1117] font-bold'
                  : 'bg-[#21262D] text-[#6E7681] hover:text-[#E6EDF3]'
              }`}
            >
              {m === 'listening' ? t('openPorts') : t('connections')}
            </button>
          ))}
        </div>

        <div className="flex rounded overflow-hidden border border-[#30363D]">
          {(['all', 'tcp', 'udp'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs transition-colors uppercase ${
                filter === f
                  ? 'bg-[#21262D] text-[#79C0FF] font-bold'
                  : 'bg-[#161B22] text-[#6E7681] hover:text-[#E6EDF3]'
              }`}
            >
              {f === 'all' ? t('filterAll') : f === 'tcp' ? t('filterTcp') : t('filterUdp')}
            </button>
          ))}
        </div>

        <Input
          value={search}
          onChange={setSearch}
          placeholder="Filter by port, program, address..."
          className="flex-1 min-w-[200px]"
        />
      </div>

      {/* Port Table */}
      <Card padding={false}>
        <div className="overflow-auto max-h-80">
          <table className="w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-[#161B22]">
              <tr className="border-b border-[#30363D]">
                {[t('protocol'), t('localPort'), t('remoteAddr'), t('state'), t('process'), t('pid')].map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 text-[#6E7681] font-medium uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[#6E7681]">
                    {loading ? t('loading') : t('noData')}
                  </td>
                </tr>
              ) : (
                displayed.map((p, i) => (
                  <tr key={i} className="border-b border-[#21262D] hover:bg-[#1C2128] transition-colors">
                    <td className="px-3 py-2">
                      <Badge variant={p.protocol.includes('tcp') ? 'info' : 'warning'}>
                        {p.protocol.replace('tcp6', 'TCPv6').replace('udp6', 'UDPv6').replace('tcp', 'TCP').replace('udp', 'UDP').toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-[#79C0FF]">
                      {p.localAddr}:<span className="text-[#F5B800]">{p.localPort}</span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[#6E7681]">
                      {p.remoteAddr && p.remoteAddr !== '0.0.0.0' ? `${p.remoteAddr}:${p.remotePort}` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={
                        p.state === 'LISTEN' ? 'info' :
                        p.state === 'ESTABLISHED' ? 'success' :
                        p.state === 'TIME_WAIT' ? 'warning' : 'muted'
                      }>
                        {p.state}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-[#E6EDF3]">{p.program || '—'}</td>
                    <td className="px-3 py-2 font-mono text-[#6E7681]">{p.pid || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Remote Host Scan */}
      <Card>
        <SectionTitle>Remote Port Scan</SectionTitle>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Input
            value={scanIp}
            onChange={setScanIp}
            placeholder="Target IP (e.g. 192.168.1.100)"
            className="flex-1 min-w-[180px]"
          />
          <Input
            value={scanRange}
            onChange={setScanRange}
            placeholder="Port range"
            className="w-32"
          />
          <Btn variant="primary" onClick={doHostScan} loading={scanning} disabled={!scanIp}>
            Scan
          </Btn>
        </div>
        {scanResult?.error && (
          <div className="text-xs text-[#F85149] bg-[#2D0F0F] border border-[#F85149]/30 rounded px-3 py-2">
            {scanResult.error}
          </div>
        )}
        {scanResult?.ports && (
          <div className="overflow-auto max-h-60">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#30363D]">
                  {['Port', 'Protocol', 'State', 'Service', 'Version'].map((h, i) => (
                    <th key={i} className="text-left px-3 py-1.5 text-[#6E7681]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scanResult.ports.map((p: any, i: number) => (
                  <tr key={i} className="border-b border-[#21262D]">
                    <td className="px-3 py-1.5 font-mono text-[#79C0FF]">{p.port}</td>
                    <td className="px-3 py-1.5 text-[#6E7681] uppercase">{p.protocol}</td>
                    <td className="px-3 py-1.5"><Badge variant="success">{p.state}</Badge></td>
                    <td className="px-3 py-1.5 text-[#E6EDF3]">{p.service}</td>
                    <td className="px-3 py-1.5 text-[#6E7681]">{p.version}</td>
                  </tr>
                ))}
                {scanResult.ports.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-4 text-[#6E7681]">No open ports found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
