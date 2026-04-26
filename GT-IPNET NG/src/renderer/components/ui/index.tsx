import React, { useState } from 'react'
import { clsx } from 'clsx'

// ─── Color palette (inline styles — avoids Tailwind arbitrary-value JIT issues) ───
const C = {
  amber:   '#F5B800',
  yellow:  '#E3B341',
  green:   '#3FB950',
  blue:    '#2B5FC4',
  cyan:    '#79C0FF',
  magenta: '#D2A8FF',
  red:     '#F85149',
  orange:  '#FFA657',
  muted:   '#6E7681',
} as const
type ColorKey = keyof typeof C

function hex(color: ColorKey | string): string {
  return (C as Record<string, string>)[color] ?? C.amber
}
function hexBg(color: ColorKey | string, alpha = 0.12): string {
  const h = hex(color)
  const r = parseInt(h.slice(1, 3), 16)
  const g = parseInt(h.slice(3, 5), 16)
  const b = parseInt(h.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// --- Badge ---
export function Badge({
  variant = 'default',
  children,
  className
}: {
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'muted'
  children: React.ReactNode
  className?: string
}) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: '#21262D', color: '#E6EDF3' },
    success: { background: 'rgba(63,185,80,0.1)', color: '#3FB950', border: '1px solid rgba(63,185,80,0.3)' },
    error:   { background: 'rgba(248,81,73,0.1)', color: '#F85149', border: '1px solid rgba(248,81,73,0.3)' },
    warning: { background: 'rgba(227,179,65,0.1)', color: '#E3B341', border: '1px solid rgba(227,179,65,0.3)' },
    info:    { background: 'rgba(121,192,255,0.1)', color: '#79C0FF', border: '1px solid rgba(121,192,255,0.3)' },
    muted:   { background: '#161B22', color: '#6E7681' }
  }
  return (
    <span
      className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', className)}
      style={styles[variant] ?? styles.default}
    >
      {children}
    </span>
  )
}

// --- Button ---
export function Btn({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  onClick,
  className,
  title
}: {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
  className?: string
  title?: string
}) {
  const [hover, setHover] = useState(false)
  const base = 'inline-flex items-center gap-2 font-medium rounded transition-all duration-150 cursor-pointer select-none border-0 outline-none'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' }

  const styles: Record<string, { normal: React.CSSProperties; hover: React.CSSProperties }> = {
    primary:   { normal: { background: '#F5B800', color: '#0D1117' }, hover: { background: '#FFD040', color: '#0D1117' } },
    secondary: { normal: { background: '#21262D', color: '#E6EDF3', border: '1px solid #30363D' }, hover: { background: '#2D333B', color: '#E6EDF3', border: '1px solid #30363D' } },
    ghost:     { normal: { background: 'transparent', color: '#B3BAC2', border: '1px solid transparent' }, hover: { background: '#21262D', color: '#E6EDF3', border: '1px solid transparent' } },
    danger:    { normal: { background: 'rgba(248,81,73,0.1)', color: '#F85149', border: '1px solid rgba(248,81,73,0.3)' }, hover: { background: 'rgba(248,81,73,0.2)', color: '#F85149', border: '1px solid rgba(248,81,73,0.4)' } },
  }

  const s = styles[variant] ?? styles.secondary
  const currentStyle = hover && !disabled && !loading ? s.hover : s.normal

  return (
    <button
      className={clsx(base, sizes[size], (disabled || loading) && 'opacity-50 cursor-not-allowed', className)}
      style={currentStyle}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {loading && (
        <span className="inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  )
}

// --- Card ---
export function Card({
  children,
  className,
  padding = true
}: {
  children: React.ReactNode
  className?: string
  padding?: boolean
}) {
  return (
    <div
      className={clsx(padding && 'p-4', className)}
      style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 8 }}
    >
      {children}
    </div>
  )
}

// --- Stat Card ---
export function StatCard({
  label,
  value,
  unit,
  icon,
  color = 'amber',
  trend
}: {
  label: string
  value: string | number
  unit?: string
  icon?: React.ReactNode
  color?: ColorKey | string
  trend?: number[]
}) {
  const colorHex = hex(color)
  const colorBg = hexBg(color)

  return (
    <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#6E7681', fontSize: 12 }}>{label}</span>
        {icon && (
          <span style={{ padding: 6, borderRadius: 6, background: colorBg, color: colorHex, display: 'flex', alignItems: 'center' }}>
            {icon}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)', color: colorHex, lineHeight: 1 }}>
          {value}
        </span>
        {unit && <span style={{ color: '#6E7681', fontSize: 11, marginBottom: 2 }}>{unit}</span>}
      </div>
      {trend && trend.length > 1 && <Sparkline data={trend} stroke={colorHex} />}
    </div>
  )
}

// --- Sparkline ---
export function Sparkline({
  data,
  stroke = '#F5B800',
  height = 32
}: {
  data: number[]
  stroke?: string
  height?: number
}) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 100
  const h = height
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h * 0.9}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
    </svg>
  )
}

// --- Spinner ---
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span className="animate-spin inline-block rounded-full border-2 border-t-transparent"
      style={{ width: size, height: size, borderColor: '#30363D', borderTopColor: '#F5B800', flexShrink: 0 }}
    />
  )
}

// --- Section Title ---
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <h2 style={{ fontSize: 11, fontWeight: 700, color: '#E6EDF3', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 3, height: 14, background: '#F5B800', borderRadius: 2, display: 'inline-block' }} />
        {children}
      </h2>
      {action}
    </div>
  )
}

// --- Progress ---
export function Progress({ value, max = 100, color = 'amber' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div style={{ height: 4, background: '#21262D', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: hex(color), transition: 'width 0.3s ease' }} />
    </div>
  )
}

// --- Table ---
export function Table({
  headers,
  rows,
  emptyMessage
}: {
  headers: string[]
  rows: (string | React.ReactNode)[][]
  emptyMessage?: string
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #30363D' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ textAlign: 'left', padding: '8px 12px', color: '#6E7681', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} style={{ textAlign: 'center', padding: '32px 0', color: '#6E7681', fontSize: 12 }}>
                {emptyMessage ?? 'No data'}
              </td>
            </tr>
          ) : (
            rows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid #21262D' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#1C2128')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#E6EDF3' }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

// --- Input ---
export function Input({
  value,
  onChange,
  placeholder,
  className,
  style,
  type = 'text'
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  type?: string
}) {
  const [focus, setFocus] = useState(false)
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      className={className}
      style={{
        background: '#0D1117',
        border: `1px solid ${focus ? '#F5B800' : '#30363D'}`,
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 13,
        color: '#E6EDF3',
        fontFamily: 'var(--font-mono)',
        outline: 'none',
        transition: 'border-color 0.15s',
        width: '100%',
        ...style
      }}
    />
  )
}

// --- Terminal Output ---
export function TerminalOutput({
  lines,
  maxLines = 300,
  className,
  style
}: {
  lines: { text: string; isError?: boolean }[]
  maxLines?: number
  className?: string
  style?: React.CSSProperties
}) {
  const visible = lines.slice(-maxLines)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [lines.length])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        background: '#0D1117',
        border: '1px solid #30363D',
        borderRadius: 8,
        padding: 16,
        overflowY: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        lineHeight: 1.6,
        maxHeight: 240,
        ...style
      }}
    >
      {visible.length === 0 ? (
        <span style={{ color: '#6E7681' }}>Waiting for output…</span>
      ) : (
        visible.map((l, i) => (
          <div key={i} style={{ color: l.isError ? '#F85149' : '#E6EDF3', wordBreak: 'break-all' }}>
            {l.text}
          </div>
        ))
      )}
    </div>
  )
}

// --- Copy Button ---
export function CopyBtn({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      style={{ fontSize: 12, color: copied ? '#3FB950' : '#6E7681', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 4 }}
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}

// --- Notification Toast ---
export function NotificationToast({
  type,
  title,
  message,
  onClose
}: {
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
  onClose: () => void
}) {
  const cfg = {
    success: { border: 'rgba(63,185,80,0.4)', icon: '✓', color: '#3FB950' },
    error:   { border: 'rgba(248,81,73,0.4)', icon: '✕', color: '#F85149' },
    info:    { border: 'rgba(121,192,255,0.4)', icon: 'ℹ', color: '#79C0FF' },
    warning: { border: 'rgba(227,179,65,0.4)', icon: '⚠', color: '#E3B341' }
  }
  const c = cfg[type]
  return (
    <div className="animate-slide" style={{
      background: '#161B22', border: `1px solid ${c.border}`, borderRadius: 8,
      padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10,
      minWidth: 240, maxWidth: 320, boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
    }}>
      <span style={{ color: c.color, fontSize: 14, marginTop: 1, flexShrink: 0 }}>{c.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#E6EDF3' }}>{title}</div>
        {message && <div style={{ fontSize: 11, color: '#6E7681', marginTop: 2 }}>{message}</div>}
      </div>
      <button onClick={onClose} style={{ color: '#6E7681', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, flexShrink: 0, lineHeight: 1 }}>✕</button>
    </div>
  )
}

// --- Error Boundary ---
interface EBState { error: Error | null }
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; name?: string }, EBState> {
  state: EBState = { error: null }
  static getDerivedStateFromError(error: Error): EBState { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, background: 'rgba(248,81,73,0.05)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 8, margin: 8 }}>
          <div style={{ color: '#F85149', fontWeight: 700, marginBottom: 8 }}>
            ⚠ {this.props.name ?? 'Component'} Error
          </div>
          <div style={{ color: '#6E7681', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 12, padding: '6px 14px', background: '#21262D', color: '#E6EDF3', border: '1px solid #30363D', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
