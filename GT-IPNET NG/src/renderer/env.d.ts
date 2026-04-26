/// <reference types="vite/client" />

import type { Api } from '../preload/index'

declare global {
  interface Window {
    api: Api
    electron: import('@electron-toolkit/preload').ElectronAPI
  }
}
