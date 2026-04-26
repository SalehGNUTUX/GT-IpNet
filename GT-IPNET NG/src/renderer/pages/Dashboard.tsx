import React, { useEffect, useState, useCallback } from 'react'
import { StatCard, Card, SectionTitle, Badge, Spinner, ErrorBoundary } from '../components/ui'
import { useI18n } from '../hooks/useI18n'
import { useAppStore } from '../store/appStore'

export function Dashboard() {
  const { t } = useI18n()
  const { activeInterface, setActiveInterface, addNotification } = useAppStore()
  const [interfaces, setInterfaces] = useState<any[]>([])
  const [ifaceDetails, setIfaceDetails] = useState<any>(null)
  const [systemStats, setSystemStats] = useState<any>(null)
  const [routeTable, setRouteTable] = useState('')
  const [arpTable, setArpTable] = useState('')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const ifaces = await window.api.network.listInterfaces()
      setInterfaces(ifaces)
      const iface = activeInterface || ifaces[0]?.name
      if (iface) {
        if (!activeInterface) setActiveInterface(iface)
        const [details, stats, route, arp] = await Promise.all([
          window.api.network.interfaceDetails(iface),
          window.api.network.systemStats(),
          window.api.network.routingTable(),
          window.api.network.arpTable()
        ])
        setIfaceDetails(details)
        setSystemStats(stats)
        setRouteTable(route)
        setArpTable(arp)
      }
    } catch (e: any) {
      addNotification({ type: 'error', title: t('error'), message: e.message })
    } finally {
      setLoading(false)
    }
  }, [activeInterface])

  useEffect(() => { loadData() }, [activeInterface])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.2s ease' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: '#E6EDF3', margin: 0 }}>{t('dashboard')}</h1>
          <p style={{ fontSize: 11, color: '#6E7681', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            {ifaceDetails?.ipv4 || '—'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={activeInterface}
            onChange={(e) => setActiveInterface(e.target.value)}
            style={{
              background: '#21262D', border: '1px solid #30363D', borderRadius: 6,
              padding: '6px 10px', fontSize: 13, color: '#E6EDF3', outline: 'none', cursor: 'pointer'
            }}
          >
            {interfaces.length === 0 && <option value="">{t('noInterface')}</option>}
            {interfaces.map((i) => <option key={i.name} value={i.name}>{i.name}</option>)}
          </select>
          <button
            onClick={loadData}
            title={t('refresh')}
            style={{
              width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#21262D', border: '1px solid #30363D', borderRadius: 6, cursor: 'pointer',
              color: '#6E7681'
            }}
          >
            {loading ? <Spinner size={14} /> : <RefreshIcon />}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <StatCard label={t('interface')} value={activeInterface || '—'} color="amber" />
        <StatCard
          label={t('status')}
          value={ifaceDetails?.state === 'up' ? t('online') : t('offline')}
          color={ifaceDetails?.state === 'up' ? 'green' : 'red'}
        />
        <StatCard label="RX" value={ifaceDetails?.rxBytes || '—'} color="cyan" />
        <StatCard label="TX" value={ifaceDetails?.txBytes || '—'} color="magenta" />
      </div>

      {/* System Stats */}
      {systemStats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <Card>
            <div style={{ fontSize: 11, color: '#6E7681', marginBottom: 6 }}>Uptime</div>
            <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#E6EDF3' }}>{systemStats.uptime}</div>
          </Card>
          <Card>
            <div style={{ fontSize: 11, color: '#6E7681', marginBottom: 6 }}>Load Average</div>
            <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: '#79C0FF' }}>
              {systemStats.loadAvg.one.toFixed(2)} · {systemStats.loadAvg.five.toFixed(2)} · {systemStats.loadAvg.fifteen.toFixed(2)}
            </div>
          </Card>
          <Card>
            <div style={{ fontSize: 11, color: '#6E7681', marginBottom: 6 }}>Memory — {systemStats.memory.percent}%</div>
            <div style={{ height: 4, background: '#21262D', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{
                height: '100%', borderRadius: 2,
                width: `${systemStats.memory.percent}%`,
                background: systemStats.memory.percent > 80 ? '#F85149' : systemStats.memory.percent > 60 ? '#E3B341' : '#3FB950',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ fontSize: 11, color: '#6E7681', fontFamily: 'var(--font-mono)' }}>
              {systemStats.memory.used} / {systemStats.memory.total}
            </div>
          </Card>
        </div>
      )}

      {/* Interface Details */}
      {ifaceDetails && (
        <Card>
          <SectionTitle>{t('interface')} — {ifaceDetails.name}</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            <InfoRow label="IPv4" value={ifaceDetails.ipv4 || '—'} mono />
            <InfoRow label="MAC"  value={ifaceDetails.mac  || '—'} mono />
            <InfoRow label="MTU"  value={ifaceDetails.mtu  || '—'} mono />
            <InfoRow label="State">
              <Badge variant={ifaceDetails.state === 'up' ? 'success' : 'error'}>{ifaceDetails.state}</Badge>
            </InfoRow>
          </div>
        </Card>
      )}

      {/* Routing Table */}
      {routeTable && (
        <Card padding={false}>
          <div style={{ padding: '14px 16px 8px' }}><SectionTitle>Routing Table</SectionTitle></div>
          <div style={{ overflowX: 'auto', padding: '0 16px 14px' }}>
            <pre style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#79C0FF', margin: 0, lineHeight: 1.6 }}>
              {routeTable}
            </pre>
          </div>
        </Card>
      )}

      {/* ARP Table */}
      {arpTable && (
        <Card padding={false}>
          <div style={{ padding: '14px 16px 8px' }}><SectionTitle>ARP Neighbors</SectionTitle></div>
          <div style={{ overflowX: 'auto', padding: '0 16px 14px', maxHeight: 180 }}>
            <pre style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: '#E6EDF3', margin: 0, lineHeight: 1.6 }}>
              {arpTable}
            </pre>
          </div>
        </Card>
      )}
    </div>
  )
}

function InfoRow({ label, value, mono, children }: {
  label: string; value?: string; mono?: boolean; children?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 11, color: '#6E7681', width: 48, flexShrink: 0 }}>{label}</span>
      {children || (
        <span style={{ fontSize: 12, color: mono ? '#79C0FF' : '#E6EDF3', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>
          {value}
        </span>
      )}
    </div>
  )
}

const RefreshIcon = () => (
  <svg viewBox="0 0 16 16" style={{ width: 14, height: 14 }} fill="currentColor">
    <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/>
    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>
  </svg>
)
