import React, { useState } from 'react'
import { useAppStore, type Page } from '../../store/appStore'
import { useI18n } from '../../hooks/useI18n'

interface NavItem { id: Page; labelKey: string; icon: React.ReactNode }

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',   labelKey: 'dashboard',   icon: <IconDashboard /> },
  { id: 'discovery',   labelKey: 'discovery',   icon: <IconDiscovery /> },
  { id: 'diagnostics', labelKey: 'diagnostics', icon: <IconDiag /> },
  { id: 'ports',       labelKey: 'ports',       icon: <IconPorts /> },
  { id: 'speed',       labelKey: 'speed',       icon: <IconSpeed /> },
  { id: 'reports',     labelKey: 'reports',     icon: <IconReports /> },
  { id: 'settings',    labelKey: 'settings',    icon: <IconSettings /> },
]

export function Sidebar() {
  const { page, setPage } = useAppStore()
  const { t, isRtl } = useI18n()

  return (
    <nav
      className="titlebar-drag"
      style={{
        width: 220,
        minWidth: 220,
        maxWidth: 220,
        display: 'flex',
        flexDirection: 'column',
        background: '#0D1117',
        borderRight: isRtl ? 'none' : '1px solid #30363D',
        borderLeft:  isRtl ? '1px solid #30363D' : 'none',
        height: '100%',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Logo Row — sits inside the titlebar area */}
      <div style={{ height: 36, display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', flexShrink: 0 }}>
        <AppIcon />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#E6EDF3', letterSpacing: '-0.01em' }}>GT‑IpNet</span>
      </div>

      {/* Separator */}
      <div style={{ height: 1, background: '#1C2128', marginBottom: 4, flexShrink: 0 }} />

      {/* Nav Items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
        {NAV_ITEMS.map(({ id, icon }) => (
          <NavBtn
            key={id}
            label={t(id as any)}
            icon={icon}
            active={page === id}
            isRtl={isRtl}
            onClick={() => setPage(id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 16px 12px', borderTop: '1px solid #1C2128', flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#30363D' }}>v1.0.0 · GPLv2</div>
        <div style={{ fontSize: 11, color: '#30363D', marginTop: 2 }}>by gnutux</div>
      </div>
    </nav>
  )
}

function NavBtn({ label, icon, active, isRtl, onClick }: {
  label: string; icon: React.ReactNode; active: boolean; isRtl: boolean; onClick: () => void
}) {
  const [hover, setHover] = useState(false)

  const bg = active ? 'rgba(245,184,0,0.08)' : hover ? '#161B22' : 'transparent'
  const color = active ? '#F5B800' : hover ? '#E6EDF3' : '#8B949E'

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="no-drag"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexDirection: isRtl ? 'row-reverse' : 'row',
        padding: '9px 10px',
        borderRadius: 6,
        border: 'none',
        background: bg,
        color,
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'background 0.1s, color 0.1s',
        outline: 'none',
        textAlign: isRtl ? 'right' : 'left',
        position: 'relative',
        marginBottom: 2,
        borderLeft: !isRtl && active ? '2px solid #F5B800' : !isRtl ? '2px solid transparent' : 'none',
        borderRight: isRtl && active ? '2px solid #F5B800' : isRtl ? '2px solid transparent' : 'none',
      }}
    >
      <span style={{ color, width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  )
}

function AppIcon() {
  return (
    <div style={{
      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
      background: 'linear-gradient(135deg, #3B2D9C, #2B5FC4)',
      boxShadow: '0 0 0 1.5px #F5B800',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <svg viewBox="0 0 16 16" style={{ width: 12, height: 12 }} fill="white">
        <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0M1 8a7 7 0 1 1 14 0A7 7 0 0 1 1 8"/>
        <circle cx="8" cy="8" r="2.5" fill="white" />
      </svg>
    </div>
  )
}

// ── SVG Icons ──────────────────────────────────────────────

function IconDashboard() {
  return <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 15, height: 15 }}>
    <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5zm8 0A1.5 1.5 0 0 1 10.5 9h3A1.5 1.5 0 0 1 15 10.5v3A1.5 1.5 0 0 1 13.5 15h-3A1.5 1.5 0 0 1 9 13.5z"/>
  </svg>
}

function IconDiscovery() {
  return <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 15, height: 15 }}>
    <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8"/>
    <path d="M5.5 8a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0m2.5-1a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>
  </svg>
}

function IconDiag() {
  return <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 15, height: 15 }}>
    <path d="M5 4a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1zm0 2a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1zm0 2a.5.5 0 0 0 0 1h2a.5.5 0 0 0 0-1z"/>
    <path d="M1.5 0A1.5 1.5 0 0 0 0 1.5v13A1.5 1.5 0 0 0 1.5 16h13a1.5 1.5 0 0 0 1.5-1.5V1.5A1.5 1.5 0 0 0 14.5 0zM1 1.5a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5z"/>
  </svg>
}

function IconPorts() {
  return <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 15, height: 15 }}>
    <path d="M1 1v14h14V1zm1 1h12v12H2zm2 2v8h8V4zm1 1h6v6H5z"/>
  </svg>
}

function IconSpeed() {
  return <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 15, height: 15 }}>
    <path d="M8 4a.5.5 0 0 1 .5.5v3.362l2.552 1.313a.5.5 0 0 1-.448.894L7.5 8.58V4.5A.5.5 0 0 1 8 4"/>
    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0m0 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1"/>
  </svg>
}

function IconReports() {
  return <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 15, height: 15 }}>
    <path d="M5 4a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1zm-.5 2.5A.5.5 0 0 1 5 6h6a.5.5 0 0 1 0 1H5a.5.5 0 0 1-.5-.5M5 8a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1zm0 2a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1z"/>
    <path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zm10-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1"/>
  </svg>
}

function IconSettings() {
  return <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 15, height: 15 }}>
    <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
  </svg>
}
