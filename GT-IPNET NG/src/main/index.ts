import { app, BrowserWindow, nativeTheme, ipcMain, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerNetworkIPC } from './ipc/network'
import { registerDiscoveryIPC } from './ipc/discovery'
import { registerDiagnosticsIPC } from './ipc/diagnostics'
import { registerPortsIPC } from './ipc/ports'
import { registerSpeedIPC } from './ipc/speed'
import { registerSystemIPC } from './ipc/system'
import { ensureReportsDir } from './utils/report'

nativeTheme.themeSource = 'dark'

let mainWindow: BrowserWindow | null = null

function setupCSP(): void {
  // Set a permissive-but-safe CSP for the renderer
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",       // needed for Vite dev HMR
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data:",
            "connect-src 'self' ws://localhost:* http://localhost:* https:",  // Vite WS + network tools
          ].join('; ')
        ]
      }
    })
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0D1117',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0D1117',
      symbolColor: '#E6EDF3',
      height: 36
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    icon: join(__dirname, '../../resources/icon.png')
  })

  mainWindow.on('ready-to-show', () => mainWindow!.show())
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    // Only open DevTools in dev
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Register all IPC handlers
  registerNetworkIPC(mainWindow)
  registerDiscoveryIPC(mainWindow)
  registerDiagnosticsIPC(mainWindow)
  registerPortsIPC(mainWindow)
  registerSpeedIPC(mainWindow)
  registerSystemIPC(mainWindow)

  // Window control IPC
  ipcMain.handle('window:minimize', () => mainWindow?.minimize())
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize()
    else mainWindow?.maximize()
    return mainWindow?.isMaximized()
  })
  ipcMain.handle('window:close', () => mainWindow?.close())
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false)

  mainWindow.on('maximize',   () => mainWindow?.webContents.send('window:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized', false))
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('org.gnutux.gt-ipnet')
  app.on('browser-window-created', (_, win) => optimizer.watchWindowShortcuts(win))

  setupCSP()

  // Fix reports directory permissions on every startup (handles stale root-owned dirs)
  await ensureReportsDir().catch((e) =>
    console.warn('[GT-IpNet] Could not prepare reports directory:', e.message)
  )

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
