import React, { useState, useEffect } from 'react'
import { Card, SectionTitle, Btn, StatCard, Sparkline, TerminalOutput, Badge } from '../components/ui'
import { useI18n } from '../hooks/useI18n'
import { useAppStore, LastSpeedResult } from '../store/appStore'

interface SpeedResult {
  download: number
  upload: number
  ping: number
  jitter?: number
  server?: string
  isp?: string
  tool: string
  error?: string
}

// ── Speed Gauge (SVG arc) ─────────────────────────────────────────────────────

function SpeedGauge({
  value, max = 200, color, label, running, phase
}: {
  value: number; max?: number; color: string; label: string
  running: boolean; phase: string
}) {
  const R = 54
  const C = 2 * Math.PI * R          // ≈ 339.3
  const ARC_DEG = 240
  const arcLen = (ARC_DEG / 360) * C  // ≈ 226.2
  const gap = C - arcLen              // ≈ 113.1
  const pct = Math.min(1, value / max)
  const fillLen = pct * arcLen

  // Glow filter id must be unique per gauge
  const filterId = `glow-${label.replace(/\s+/g, '')}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg viewBox="0 0 140 130" width={150} height={140}>
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx="70" cy="72" r={R}
          fill="none" stroke="#21262D" strokeWidth="10"
          strokeDasharray={`${arcLen} ${gap}`}
          strokeLinecap="round"
          transform="rotate(150 70 72)"
        />
        {/* Fill — animated via CSS transition */}
        <circle cx="70" cy="72" r={R}
          fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${fillLen} ${C - fillLen}`}
          strokeLinecap="round"
          transform="rotate(150 70 72)"
          style={{
            transition: 'stroke-dasharray 1.4s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: value > 0 ? `drop-shadow(0 0 5px ${color}99)` : 'none'
          }}
        />
        {/* Pulse ring when this gauge is active */}
        {running && (
          <circle cx="70" cy="72" r={R + 7}
            fill="none" stroke={color} strokeWidth="1"
            style={{ animation: 'pulse 1.4s ease-in-out infinite', opacity: 0.35 }}
          />
        )}
        {/* Value */}
        <text x="70" y="68" textAnchor="middle"
          fill={value > 0 ? '#E6EDF3' : '#484F58'}
          fontSize="22" fontWeight="bold" fontFamily="monospace">
          {value > 0 ? value.toFixed(1) : running ? '…' : '—'}
        </text>
        <text x="70" y="83" textAnchor="middle" fill="#6E7681" fontSize="10">
          Mbps
        </text>
        <text x="70" y="97" textAnchor="middle" fill={color} fontSize="9.5" opacity="0.85">
          {label}
        </text>
      </svg>
    </div>
  )
}

// ── Phase indicator ───────────────────────────────────────────────────────────

function PhaseStep({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  const color = done ? '#3FB950' : active ? '#F5B800' : '#30363D'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%', background: color,
        boxShadow: active ? `0 0 8px ${color}` : 'none',
        animation: active ? 'pulse 1s ease-in-out infinite' : 'none',
        transition: 'background 0.3s',
      }}/>
      <span style={{
        fontSize: 11, fontWeight: active ? 600 : 400,
        color: done ? '#3FB950' : active ? '#F5B800' : '#484F58',
        transition: 'color 0.3s',
      }}>{label}</span>
    </div>
  )
}

// ── Date format (ar-MA = Western Arabic numerals) ─────────────────────────────

function formatDate(iso: string, lang: string): string {
  try {
    return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-MA' : 'en-GB', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch { return iso }
}

// ── Quality ───────────────────────────────────────────────────────────────────

const QUALITY = [
  { min: 0,   max: 5,        label: 'poor',      color: '#F85149' },
  { min: 5,   max: 25,       label: 'fair',       color: '#E3B341' },
  { min: 25,  max: 100,      label: 'good',       color: '#79C0FF' },
  { min: 100, max: Infinity, label: 'excellent',  color: '#3FB950' },
]
function getQuality(mbps: number) {
  return QUALITY.find((q) => mbps >= q.min && mbps < q.max) || QUALITY[0]
}

// Parse speed value from stream line (speedtest-cli format)
function parseStreamSpeed(line: string): { download?: number; upload?: number } {
  const dl = line.match(/Download:\s+([\d.]+)\s+([KMG])bit\/s/i)
  if (dl) {
    const v = parseFloat(dl[1])
    const u = dl[2].toUpperCase()
    return { download: u === 'G' ? v * 1000 : u === 'K' ? v / 1000 : v }
  }
  const ul = line.match(/Upload:\s+([\d.]+)\s+([KMG])bit\/s/i)
  if (ul) {
    const v = parseFloat(ul[1])
    const u = ul[2].toUpperCase()
    return { upload: u === 'G' ? v * 1000 : u === 'K' ? v / 1000 : v }
  }
  return {}
}

// ── Main Speed component ──────────────────────────────────────────────────────

export function Speed() {
  const { t, lang } = useI18n()
  const { addNotification, lastSpeedResult, saveSpeedResult } = useAppStore()

  const [result, setResult] = useState<SpeedResult | null>(null)
  const [running, setRunning] = useState(false)
  const [lines, setLines] = useState<{ text: string }[]>([])
  const [showOutput, setShowOutput] = useState(false)
  const [history, setHistory] = useState<SpeedResult[]>([])
  const [tools, setTools] = useState<any>(null)
  const [phase, setPhase] = useState<'idle' | 'ping' | 'download' | 'upload' | 'done'>('idle')

  // Live values extracted from stream
  const [liveDownload, setLiveDownload] = useState(0)
  const [liveUpload, setLiveUpload] = useState(0)
  const [livePing, setLivePing] = useState(0)

  useEffect(() => { window.api.speed.checkTools().then(setTools) }, [])

  const run = async () => {
    setRunning(true)
    setResult(null)
    setLines([])
    setLiveDownload(0); setLiveUpload(0); setLivePing(0)
    setPhase('ping')

    const offStream = window.api.speed.onStream((data: any) => {
      if (data.line) {
        setLines((p) => [...p, { text: data.line }])
        const l = data.line.toLowerCase()

        // Phase transitions
        if (l.includes('testing download') || l.includes('retrieving'))  setPhase('download')
        if (l.includes('testing upload'))  setPhase('upload')
        if (l.includes('ping') && phase === 'ping') setPhase('ping')

        // Extract intermediate speeds
        const { download, upload } = parseStreamSpeed(data.line)
        if (download !== undefined) { setLiveDownload(download); setPhase('upload') }
        if (upload !== undefined)   { setLiveUpload(upload);    setPhase('done') }

        // Ping line: "Hosted by ... [... km]: X.XXX ms"
        const pingLine = data.line.match(/\]:\s+([\d.]+)\s+ms/)
        if (pingLine) setLivePing(parseFloat(pingLine[1]))
      }
      if (data.done) setPhase('done')
    })

    try {
      await window.api.speed.stream()
      await new Promise<void>((resolve) => {
        const check = window.api.speed.onStream((data: any) => {
          if (data.done) { check(); resolve() }
        })
      })
      const res = await window.api.speed.run()
      if (res.error) {
        addNotification({ type: 'error', title: t('error'), message: res.error })
      } else {
        setResult(res)
        setHistory((prev) => [res, ...prev].slice(0, 5))
        saveSpeedResult(res)
        addNotification({ type: 'success', title: t('speedTest'), message: `↓ ${res.download.toFixed(1)} Mbps` })
      }
    } finally {
      offStream()
      setRunning(false)
    }
  }

  // Choose which values to display in the gauges
  const displayDl = result ? result.download : liveDownload
  const displayUl = result ? result.upload : liveUpload
  const displayPing = result ? result.ping : livePing
  const quality = result ? getQuality(result.download) : null

  const isDownloadPhase = running && (phase === 'download' || phase === 'ping')
  const isUploadPhase   = running && phase === 'upload'

  return (
    <div className="flex flex-col gap-6 animate-fade">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#E6EDF3]">{t('speedTest')}</h1>
          {tools && (
            <p className="text-xs text-[#6E7681] mt-0.5">
              {tools.speedtest ? 'speedtest-cli' : tools.curl ? 'curl fallback' : 'No speed tool installed'}
            </p>
          )}
        </div>
        {running
          ? <Btn variant="danger" onClick={() => window.api.speed.stop()}>Stop</Btn>
          : <Btn variant="primary" onClick={run} disabled={tools && !tools.speedtest && !tools.curl}>
              {t('startTest')}
            </Btn>
        }
      </div>

      {/* ── Live animation panel (shown while running or after result) ── */}
      {(running || result) && (
        <Card>
          {/* Phase steps */}
          {running && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginBottom: 20 }}>
              <PhaseStep label="Ping"     active={phase === 'ping'}     done={['download','upload','done'].includes(phase)} />
              <PhaseStep label="Download" active={phase === 'download'} done={['upload','done'].includes(phase)} />
              <PhaseStep label="Upload"   active={phase === 'upload'}   done={phase === 'done'} />
            </div>
          )}

          {/* Dual gauges */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap', marginBottom: 16 }}>
            <SpeedGauge
              value={displayDl} max={200}
              color="#79C0FF" label="Download"
              running={isDownloadPhase}
              phase={phase}
            />
            <SpeedGauge
              value={displayUl} max={200}
              color="#D2A8FF" label="Upload"
              running={isUploadPhase}
              phase={phase}
            />
          </div>

          {/* Ping + Quality row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
            {displayPing > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#6E7681', marginBottom: 3 }}>{t('pingMs')}</div>
                <div style={{
                  fontSize: 20, fontWeight: 700, fontFamily: 'monospace',
                  color: displayPing < 30 ? '#3FB950' : displayPing < 80 ? '#E3B341' : '#F85149'
                }}>
                  {displayPing.toFixed(0)} <span style={{ fontSize: 11, fontWeight: 400 }}>ms</span>
                </div>
              </div>
            )}
            {quality && !running && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#6E7681', marginBottom: 3 }}>Quality</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: quality.color }}>
                  {t(quality.label as any)}
                </div>
              </div>
            )}
            {(result?.isp || result?.server) && (
              <div style={{ textAlign: 'center', maxWidth: 200 }}>
                {result.isp && (
                  <div style={{ fontSize: 11, color: '#6E7681' }}>
                    {t('isp')}: <span style={{ color: '#B3BAC2', fontFamily: 'monospace' }}>{result.isp}</span>
                  </div>
                )}
                {result.server && (
                  <div style={{ fontSize: 11, color: '#6E7681', marginTop: 2 }}>
                    {t('server')}: <span style={{ color: '#B3BAC2', fontFamily: 'monospace' }}>{result.server}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Last saved result (shown when fully idle) ── */}
      {!running && !result && lastSpeedResult && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <SectionTitle>{t('lastTest')}</SectionTitle>
            <span style={{ fontSize: 11, color: '#6E7681' }}>{formatDate(lastSpeedResult.date, lang)}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <StatCard label={t('downloadSpeed')} value={lastSpeedResult.download.toFixed(1)} unit={t('mbps')} color="cyan" />
            <StatCard label={t('uploadSpeed')}
              value={lastSpeedResult.upload > 0 ? lastSpeedResult.upload.toFixed(1) : '—'}
              unit={lastSpeedResult.upload > 0 ? t('mbps') : ''} color="magenta" />
            <StatCard label={t('pingMs')}
              value={lastSpeedResult.ping > 0 ? lastSpeedResult.ping.toFixed(0) : '—'}
              unit={lastSpeedResult.ping > 0 ? t('ms') : ''}
              color={lastSpeedResult.ping < 30 ? 'green' : lastSpeedResult.ping < 80 ? 'amber' : 'red'} />
          </div>
          {(lastSpeedResult.isp || lastSpeedResult.server) && (
            <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 11, flexWrap: 'wrap' }}>
              {lastSpeedResult.isp && (
                <span style={{ color: '#6E7681' }}>{t('isp')}: <span style={{ color: '#E6EDF3', fontFamily: 'monospace' }}>{lastSpeedResult.isp}</span></span>
              )}
              {lastSpeedResult.server && (
                <span style={{ color: '#6E7681' }}>{t('server')}: <span style={{ color: '#E6EDF3', fontFamily: 'monospace' }}>{lastSpeedResult.server}</span></span>
              )}
              <Badge variant="muted">{lastSpeedResult.tool}</Badge>
            </div>
          )}
        </Card>
      )}

      {/* History chart */}
      {history.length > 1 && (
        <Card>
          <SectionTitle>History</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-[#6E7681] mb-2">Download (Mbps)</div>
              <Sparkline data={history.map((h) => h.download)} stroke="#79C0FF" height={40} />
            </div>
            <div>
              <div className="text-xs text-[#6E7681] mb-2">Upload (Mbps)</div>
              <Sparkline data={history.map((h) => h.upload)} stroke="#D2A8FF" height={40} />
            </div>
          </div>
        </Card>
      )}

      {/* Terminal output — hidden by default */}
      {lines.length > 0 && (
        <div>
          <button
            onClick={() => setShowOutput((s) => !s)}
            style={{
              background: 'none', border: '1px solid #30363D', borderRadius: 4,
              padding: '4px 12px', fontSize: 11, color: '#6E7681', cursor: 'pointer', marginBottom: 8
            }}
          >
            {showOutput ? '▲ إخفاء المخرجات' : '▼ إظهار مخرجات speedtest-cli'}
          </button>
          {showOutput && (
            <TerminalOutput lines={lines} className="max-h-48" />
          )}
        </div>
      )}

      {/* Tool warning */}
      {tools && !tools.speedtest && (
        <Card>
          <div className="text-xs text-[#E3B341]">
            ⚠ speedtest-cli not installed. Go to Settings → Dependencies to install it.
            {!tools.curl && ' curl fallback is also unavailable.'}
          </div>
        </Card>
      )}
    </div>
  )
}
