import React, { useEffect, useState } from 'react'

interface ElevationStatus {
  isRoot: boolean
  sudoAvailable: boolean
  pkexecAvailable: boolean
  canElevate: boolean
}

export function PrivilegeBanner() {
  const [status, setStatus] = useState<ElevationStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    window.api.system.elevationStatus().then(setStatus).catch(() => {})
  }, [])

  if (!status || status.canElevate || dismissed) return null

  return (
    <div style={{
      background: 'rgba(227,179,65,0.08)',
      border: '1px solid rgba(227,179,65,0.35)',
      borderRadius: 8,
      padding: '10px 16px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚠</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#E3B341', marginBottom: 4 }}>
          Elevated privileges not available
        </div>
        <div style={{ fontSize: 12, color: '#B3BAC2', lineHeight: 1.5 }}>
          Operations like network scanning (arp-scan, nmap) and installing packages require root access.
          To enable them, either:
        </div>
        <div style={{ fontSize: 12, color: '#B3BAC2', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <code style={{ fontFamily: 'var(--font-mono)', background: '#0D1117', padding: '2px 8px', borderRadius: 4, color: '#79C0FF', display: 'inline-block' }}>
            sudo -E npm run dev
          </code>
          <span style={{ color: '#6E7681', fontSize: 11 }}>or install polkit for automatic GUI password prompts:</span>
          <code style={{ fontFamily: 'var(--font-mono)', background: '#0D1117', padding: '2px 8px', borderRadius: 4, color: '#79C0FF', display: 'inline-block' }}>
            sudo apt install polkitd pkexec
          </code>
        </div>
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: 'none', border: 'none', color: '#6E7681', cursor: 'pointer', fontSize: 16, flexShrink: 0, padding: 2 }}
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}

/**
 * Inline warning shown inside a tool's result area when an operation
 * failed because elevation was unavailable.
 */
export function ElevationRequired({ command }: { command: string }) {
  return (
    <div style={{
      background: 'rgba(248,81,73,0.06)',
      border: '1px solid rgba(248,81,73,0.3)',
      borderRadius: 8,
      padding: '12px 16px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#F85149', marginBottom: 6 }}>
        🔒 Root access required
      </div>
      <div style={{ fontSize: 12, color: '#B3BAC2', marginBottom: 8, lineHeight: 1.5 }}>
        <code style={{ fontFamily: 'var(--font-mono)', color: '#E3B341' }}>{command}</code> needs root privileges.
        Install <strong>polkitd + pkexec</strong> so GT-IpNet can request permission automatically, or run:
      </div>
      <code style={{ fontFamily: 'var(--font-mono)', background: '#0D1117', padding: '4px 10px', borderRadius: 4, color: '#79C0FF', fontSize: 12 }}>
        sudo -E npm run dev
      </code>
    </div>
  )
}
