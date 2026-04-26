import React from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { Titlebar } from './components/layout/Titlebar'
import { PrivilegeBanner } from './components/layout/PrivilegeBanner'
import { Onboarding } from './components/layout/Onboarding'
import { NotificationToast, ErrorBoundary } from './components/ui'
import { Dashboard } from './pages/Dashboard'
import { Discovery } from './pages/Discovery'
import { Diagnostics } from './pages/Diagnostics'
import { Ports } from './pages/Ports'
import { Speed } from './pages/Speed'
import { Settings } from './pages/Settings'
import { Reports } from './pages/Reports'
import { useAppStore } from './store/appStore'
import { useI18n } from './hooks/useI18n'

const PAGES = {
  dashboard:   Dashboard,
  discovery:   Discovery,
  diagnostics: Diagnostics,
  ports:       Ports,
  speed:       Speed,
  settings:    Settings,
  reports:     Reports,
} as const

export default function App() {
  const { page, notifications, removeNotification, onboardingDone } = useAppStore()
  const { isRtl } = useI18n()
  const PageComponent = PAGES[page as keyof typeof PAGES] ?? Dashboard

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: '#0D1117',
        color: '#E6EDF3',
      }}
    >
      {/* Custom titlebar */}
      <Titlebar />

      {/* Main layout (below titlebar) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', paddingTop: 36 }}>
        <Sidebar />

        <main style={{
          flex: 1,
          overflowY: 'auto',
          background: '#0D1117',
          padding: '24px 28px',
        }}>
          <PrivilegeBanner />
          <ErrorBoundary name={page}>
            <PageComponent />
          </ErrorBoundary>
        </main>
      </div>

      {/* First-run onboarding wizard */}
      {!onboardingDone && <Onboarding />}

      {/* Notification stack */}
      <div style={{
        position: 'fixed',
        bottom: 16,
        [isRtl ? 'left' : 'right']: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 1000,
      }}>
        {notifications.map((n) => (
          <NotificationToast
            key={n.id}
            type={n.type}
            title={n.title}
            message={n.message}
            onClose={() => removeNotification(n.id)}
          />
        ))}
      </div>
    </div>
  )
}
