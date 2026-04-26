import React, { useEffect, useState } from 'react'
import appIcon from '../../assets/icon.png'

export function Titlebar() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.api.window.isMaximized().then(setMaximized)
    const off = window.api.window.onMaximized(setMaximized)
    return off
  }, [])

  return (
    <div
      className="titlebar-drag"
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: 36,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 100,
        background: '#0D1117',
        borderBottom: '1px solid #21262D',
      }}
    >
      {/* App identity (left side, non-draggable only for icon) */}
      <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 12 }}>
        <img src={appIcon} alt="GT-IpNet" style={{ width: 18, height: 18, borderRadius: 3 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#8B949E', letterSpacing: '0.04em', userSelect: 'none' }}>
          GT-IpNet
        </span>
      </div>

      {/* Window controls (right side) */}
      <div className="no-drag" style={{ display: 'flex', height: '100%' }}>
        <WinBtn onClick={() => window.api.window.minimize()} title="Minimize" hoverBg="#3A3A3A">
          <svg viewBox="0 0 10 1" style={{ width: 10, height: 1 }} fill="currentColor">
            <rect width="10" height="1"/>
          </svg>
        </WinBtn>
        <WinBtn onClick={() => window.api.window.maximize().then(setMaximized)} title={maximized ? 'Restore' : 'Maximize'} hoverBg="#3A3A3A">
          {maximized ? (
            <svg viewBox="0 0 10 10" style={{ width: 10, height: 10 }} fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2.5" y="0.5" width="7" height="7"/>
              <polyline points="0.5,2.5 0.5,9.5 7.5,9.5"/>
            </svg>
          ) : (
            <svg viewBox="0 0 10 10" style={{ width: 10, height: 10 }} fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9"/>
            </svg>
          )}
        </WinBtn>
        <WinBtn onClick={() => window.api.window.close()} title="Close" hoverBg="#C42B1C">
          <svg viewBox="0 0 10 10" style={{ width: 10, height: 10 }} fill="currentColor">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </WinBtn>
      </div>
    </div>
  )
}

function WinBtn({ onClick, title, hoverBg, children }: {
  onClick: () => void; title: string; hoverBg: string; children: React.ReactNode
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 46, height: 36,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hover ? hoverBg : 'transparent',
        border: 'none',
        color: hover ? '#E6EDF3' : '#6E7681',
        cursor: 'pointer',
        transition: 'background 0.1s, color 0.1s',
        outline: 'none',
      }}
    >
      {children}
    </button>
  )
}
