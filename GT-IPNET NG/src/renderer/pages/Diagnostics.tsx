import React, { useState, useRef } from 'react'
import { Card, SectionTitle, Badge, Btn, StatCard, TerminalOutput, Input, Progress } from '../components/ui'
import { ElevationRequired } from '../components/layout/PrivilegeBanner'
import { useI18n } from '../hooks/useI18n'
import { useAppStore } from '../store/appStore'

type ActiveTest = 'dns' | 'trace' | 'ping' | null

// ── Tooltip — uses fixed positioning to escape any overflow:hidden parent ─────

function HelpTip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const btnRef = useRef<HTMLSpanElement>(null)

  const show = () => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ x: r.left + r.width / 2, y: r.top - 10 })
  }

  return (
    <>
      <span
        ref={btnRef}
        onMouseEnter={show}
        onMouseLeave={() => setPos(null)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
          background: '#21262D', border: '1px solid #3D444D',
          color: '#8B949E', fontSize: 9.5, cursor: 'help',
          fontWeight: 700, userSelect: 'none',
        }}
      >?</span>

      {pos && (
        <div style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          transform: 'translate(-50%, -100%)',
          background: '#1C2128',
          border: '1px solid #3D444D',
          borderRadius: 8,
          padding: '10px 14px',
          width: 270,
          fontSize: 12,
          color: '#C9D1D9',
          lineHeight: 1.65,
          wordBreak: 'break-word',
          zIndex: 9999,
          pointerEvents: 'none',
          boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
        }}>
          {text}
          {/* Arrow pointing down */}
          <div style={{
            position: 'absolute', top: '100%', left: '50%',
            transform: 'translateX(-50%)',
            borderWidth: '6px 6px 0',
            borderStyle: 'solid',
            borderColor: '#3D444D transparent transparent',
          }}/>
          <div style={{
            position: 'absolute', top: 'calc(100% - 1px)', left: '50%',
            transform: 'translateX(-50%)',
            borderWidth: '6px 6px 0',
            borderStyle: 'solid',
            borderColor: '#1C2128 transparent transparent',
          }}/>
        </div>
      )}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function Diagnostics() {
  const { t, isRtl } = useI18n()
  const { addNotification } = useAppStore()
  const [activeTest, setActiveTest] = useState<ActiveTest>(null)
  const [loading, setLoading] = useState(false)

  const [dnsResults, setDnsResults] = useState<any>(null)
  const [traceResult, setTraceResult] = useState<any>(null)
  const [pingResult, setPingResult] = useState<any>(null)

  const [dnsTarget, setDnsTarget] = useState('example.com')
  const [traceTarget, setTraceTarget] = useState('8.8.8.8')
  const [pingTarget, setPingTarget] = useState('8.8.8.8')
  const [pingCount, setPingCount] = useState('8')

  const [traceLines, setTraceLines] = useState<{ text: string }[]>([])
  const [pingLines, setPingLines] = useState<{ text: string }[]>([])
  const [showPingOutput, setShowPingOutput] = useState(false)

  const runDns = async () => {
    setLoading(true); setActiveTest('dns'); setDnsResults(null)
    try {
      const result = await window.api.diag.dnsTest(dnsTarget)
      setDnsResults(result)
      if (result.error) addNotification({ type: 'error', title: t('dnsTest'), message: result.error })
      else addNotification({ type: 'success', title: t('dnsTest') })
    } finally { setLoading(false) }
  }

  const runTrace = async () => {
    setLoading(true); setActiveTest('trace'); setTraceResult(null); setTraceLines([])
    try {
      const result = await window.api.diag.trace(traceTarget)
      setTraceResult(result)
      if (result.error) addNotification({ type: 'error', title: t('traceroute'), message: result.error })
      else addNotification({ type: 'success', title: t('traceroute') })
    } finally { setLoading(false) }
  }

  const runPing = async () => {
    setLoading(true); setActiveTest('ping'); setPingResult(null); setPingLines([])
    setShowPingOutput(true)
    const offStream = window.api.diag.onPingStream((data: any) => {
      if (data.line) setPingLines((p) => [...p, { text: data.line }])
    })
    try {
      await window.api.diag.pingStream(pingTarget, parseInt(pingCount) || 8)
      await new Promise<void>((resolve) => {
        const check = window.api.diag.onPingStream((data: any) => {
          if (data.done) { check(); resolve() }
        })
      })
      const result = await window.api.diag.ping(pingTarget, parseInt(pingCount) || 8)
      setPingResult(result)
    } finally { offStream(); setLoading(false) }
  }

  return (
    <div className="flex flex-col gap-6 animate-fade">
      <div>
        <h1 className="text-lg font-bold text-[#E6EDF3]">{t('diagnostics')}</h1>
        <p className="text-xs text-[#6E7681] mt-0.5">DNS · Traceroute · Ping</p>
      </div>

      {/* ── DNS ─────────────────────────────────────────────────── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6E7681', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <span style={{ color: '#79C0FF' }}>⬡</span> {t('dnsTest')}
          </span>
          <HelpTip text={t('dnsHelp')} />
        </div>
        <div style={{ height: 1, background: '#21262D', marginBottom: 16 }} />
        <div className="flex items-center gap-3 mb-4">
          <div style={{ flex: 1, position: 'relative' }}>
            <Input
              value={dnsTarget}
              onChange={setDnsTarget}
              placeholder={t('targetHelp')}
            />
          </div>
          <HelpTip text={t('targetHelp')} />
          <Btn variant="primary" onClick={runDns}
            loading={loading && activeTest === 'dns'}
            disabled={loading && activeTest !== 'dns'}>
            {t('runTest')}
          </Btn>
        </div>
        {dnsResults?.results && (
          <div className="space-y-2">
            {dnsResults.results.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-4 bg-[#0D1117] rounded px-3 py-2">
                <Badge variant={r.resolved ? 'success' : 'error'}>
                  {r.resolved ? t('resolved') : t('failed')}
                </Badge>
                <span className="font-mono text-xs text-[#79C0FF]">{r.server}</span>
                {r.ip && <span className="font-mono text-xs text-[#E3B341]">{r.ip}</span>}
                <span className="font-mono text-xs text-[#6E7681] ms-auto">{r.responseTime}</span>
                {r.error && <span className="text-xs text-[#F85149]">{r.error}</span>}
              </div>
            ))}
          </div>
        )}
        {dnsResults?.error && (
          <div className="text-xs text-[#F85149] bg-[#2D0F0F] border border-[#F85149]/30 rounded px-3 py-2">
            {dnsResults.error}
          </div>
        )}
      </Card>

      {/* ── Traceroute ──────────────────────────────────────────── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6E7681', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <span style={{ color: '#E3B341' }}>⤳</span> {t('traceroute')}
          </span>
          <HelpTip text={t('traceHelp')} />
        </div>
        <div style={{ height: 1, background: '#21262D', marginBottom: 16 }} />
        <div className="flex items-center gap-3 mb-4">
          <Input value={traceTarget} onChange={setTraceTarget}
            placeholder={t('targetHelp')} className="flex-1" />
          <HelpTip text={t('targetHelp')} />
          <Btn variant="primary" onClick={runTrace}
            loading={loading && activeTest === 'trace'}
            disabled={loading && activeTest !== 'trace'}>
            {t('runTest')}
          </Btn>
        </div>
        {traceResult?.hops && traceResult.hops.length > 0 && (
          <div className="overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#30363D]">
                  {[t('hop'), t('hostname'), 'IP', 'RTT 1', 'RTT 2', 'RTT 3'].map((h, i) => (
                    <th key={i} className="text-left px-3 py-2 text-[#6E7681] font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {traceResult.hops.map((hop: any, i: number) => (
                  <tr key={i} className="border-b border-[#21262D] hover:bg-[#1C2128]">
                    <td className="px-3 py-2 font-mono text-[#F5B800]">{hop.hop}</td>
                    <td className="px-3 py-2 text-[#E6EDF3] max-w-[120px] truncate">{hop.host || '—'}</td>
                    <td className="px-3 py-2 font-mono text-[#79C0FF]">{hop.ip}</td>
                    <td className="px-3 py-2 font-mono text-[#3FB950]">{hop.rtt1}</td>
                    <td className="px-3 py-2 font-mono text-[#3FB950]">{hop.rtt2}</td>
                    <td className="px-3 py-2 font-mono text-[#3FB950]">{hop.rtt3}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {traceResult?.error && (
          <div className="text-xs text-[#F85149] bg-[#2D0F0F] border border-[#F85149]/30 rounded px-3 py-2">
            {traceResult.error}
          </div>
        )}
        {traceResult?.raw && (!traceResult.hops || traceResult.hops.length === 0) && (
          <pre className="text-xs font-mono text-[#E6EDF3] bg-[#0D1117] rounded p-3 overflow-auto max-h-48">
            {traceResult.raw}
          </pre>
        )}
      </Card>

      {/* ── Ping ────────────────────────────────────────────────── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6E7681', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <span style={{ color: '#3FB950' }}>◉</span> {t('pingTest')}
          </span>
          <HelpTip text={t('pingHelp')} />
        </div>
        <div style={{ height: 1, background: '#21262D', marginBottom: 16 }} />
        <div className="flex items-center gap-3 mb-4">
          <Input value={pingTarget} onChange={setPingTarget}
            placeholder={t('targetHelp')} className="flex-1" />
          <HelpTip text={t('targetHelp')} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Input value={pingCount} onChange={setPingCount}
              placeholder="8" className="w-20" type="number" />
            <HelpTip text={t('pingCountHelp')} />
          </div>
          <Btn variant="primary" onClick={runPing}
            loading={loading && activeTest === 'ping'}
            disabled={loading && activeTest !== 'ping'}>
            {t('runTest')}
          </Btn>
        </div>

        {pingResult && !pingResult.error && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
            <PingCard label={t('sent')} value={String(pingResult.transmitted)} color="#F5B800" />
            <PingCard label={t('received')} value={String(pingResult.received)} color="#3FB950" />
            <PingCard
              label={t('loss')}
              value={`${pingResult.loss}%`}
              color={pingResult.loss === 0 ? '#3FB950' : pingResult.loss < 20 ? '#E3B341' : '#F85149'}
            />
            <PingCard label={t('avg')} value={pingResult.avgRtt} color="#79C0FF" />
          </div>
        )}

        {pingResult?.error && (
          <div className="text-xs text-[#F85149] bg-[#2D0F0F] border border-[#F85149]/30 rounded px-3 py-2 mb-3">
            {pingResult.error}
          </div>
        )}

        {/* Terminal toggle */}
        {pingLines.length > 0 && (
          <div>
            <button
              onClick={() => setShowPingOutput((s) => !s)}
              style={{
                background: 'none', border: '1px solid #30363D', borderRadius: 4,
                padding: '3px 10px', fontSize: 11, color: '#6E7681', cursor: 'pointer', marginBottom: 8
              }}
            >
              {showPingOutput ? '▲ إخفاء المخرجات' : '▼ إظهار المخرجات'}
            </button>
            {showPingOutput && <TerminalOutput lines={pingLines} className="max-h-40" />}
          </div>
        )}
      </Card>
    </div>
  )
}

function PingCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#0D1117] rounded-lg p-3 text-center">
      <div className="text-xs text-[#6E7681] mb-1">{label}</div>
      <div className="text-lg font-bold font-mono" style={{ color }}>{value}</div>
    </div>
  )
}
