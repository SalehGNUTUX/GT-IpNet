import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Lang = 'ar' | 'en'
export type Page = 'dashboard' | 'discovery' | 'diagnostics' | 'ports' | 'speed' | 'settings' | 'reports'

// ── Speed ─────────────────────────────────────────────────────────────────────

export interface LastSpeedResult {
  download: number
  upload: number
  ping: number
  jitter?: number
  server?: string
  isp?: string
  tool: string
  date: string
}

// ── Discovery ─────────────────────────────────────────────────────────────────

export interface SavedDeviceInfo {
  manufacturer: string
  deviceType: string
  deviceName: string
  modelId: string
  modelName: string
  os: string
  hostname: string
  source: string[]
}

export interface SavedHost {
  ip: string
  mac: string
  hostname: string
  vendor: string
  status: 'online' | 'filtered' | 'unknown'
  latency?: string
  device?: SavedDeviceInfo
}

export interface LastDiscovery {
  hosts: SavedHost[]
  date: string     // ISO
  iface: string
  mode: 'quick' | 'full'
  subnet: string
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface Notification {
  id: string
  ts: number
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message?: string
}

interface AppState {
  lang: Lang
  page: Page
  activeInterface: string
  isScanning: boolean
  notifications: Notification[]
  onboardingDone: boolean
  lastSpeedResult: LastSpeedResult | null
  lastDiscovery: LastDiscovery | null

  setLang: (lang: Lang) => void
  setPage: (page: Page) => void
  setActiveInterface: (iface: string) => void
  setScanning: (v: boolean) => void
  addNotification: (n: Omit<Notification, 'id' | 'ts'>) => void
  removeNotification: (id: string) => void
  setOnboardingDone: () => void
  saveSpeedResult: (r: Omit<LastSpeedResult, 'date'>) => void
  saveDiscovery: (r: Omit<LastDiscovery, 'date'> & { date?: string }) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      lang: 'ar',
      page: 'dashboard',
      activeInterface: '',
      isScanning: false,
      notifications: [],
      onboardingDone: false,
      lastSpeedResult: null,
      lastDiscovery: null,

      setLang: (lang) => set({ lang }),
      setPage: (page) => set({ page }),
      setActiveInterface: (activeInterface) => set({ activeInterface }),
      setScanning: (isScanning) => set({ isScanning }),

      addNotification: (n) => {
        const id = Math.random().toString(36).slice(2)
        const note: Notification = { ...n, id, ts: Date.now() }
        set((s) => ({ notifications: [note, ...s.notifications].slice(0, 5) }))
        setTimeout(() => get().removeNotification(id), 5000)
      },

      removeNotification: (id) =>
        set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

      setOnboardingDone: () => set({ onboardingDone: true }),

      saveSpeedResult: (r) =>
        set({ lastSpeedResult: { ...r, date: new Date().toISOString() } }),

      saveDiscovery: (r) =>
        set({ lastDiscovery: { ...r, date: r.date ?? new Date().toISOString() } }),
    }),
    {
      name: 'gt-ipnet-store',
      partialize: (s) => ({
        lang: s.lang,
        activeInterface: s.activeInterface,
        onboardingDone: s.onboardingDone,
        lastSpeedResult: s.lastSpeedResult,
        lastDiscovery: s.lastDiscovery,
      })
    }
  )
)
