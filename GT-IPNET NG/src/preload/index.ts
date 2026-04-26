import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // Network
  network: {
    listInterfaces: () => ipcRenderer.invoke('network:list-interfaces'),
    interfaceDetails: (iface: string) => ipcRenderer.invoke('network:interface-details', iface),
    routingTable: () => ipcRenderer.invoke('network:routing-table'),
    fullReport: (iface: string) => ipcRenderer.invoke('network:full-report', iface),
    arpTable: () => ipcRenderer.invoke('network:arp-table'),
    wifiInfo: () => ipcRenderer.invoke('network:wifi-info'),
    systemStats: () => ipcRenderer.invoke('network:system-stats')
  },

  // Discovery
  discovery: {
    quickScan: (iface: string) => ipcRenderer.invoke('discovery:quick-scan', iface),
    fullScan: (iface: string, subnet?: string) => ipcRenderer.invoke('discovery:full-scan', iface, subnet),
    streamScan: (iface: string, mode: 'quick' | 'full', subnet?: string) =>
      ipcRenderer.invoke('discovery:stream-scan', iface, mode, subnet),
    stop: () => ipcRenderer.invoke('discovery:stop'),
    hostDetails: (ip: string) => ipcRenderer.invoke('discovery:host-details', ip),
    getSubnet: (iface: string) => ipcRenderer.invoke('discovery:get-subnet', iface),
    enrich: (hosts: { ip: string; mac: string }[]) => ipcRenderer.invoke('discovery:enrich', hosts),
    ouiLookup: (mac: string) => ipcRenderer.invoke('discovery:oui-lookup', mac),
    mdnsScan: () => ipcRenderer.invoke('discovery:mdns-scan'),
    identifyHost: (ip: string, mac: string) => ipcRenderer.invoke('discovery:identify-host', ip, mac),
    preload: () => ipcRenderer.invoke('discovery:preload'),
    onStream: (cb: (data: any) => void) => {
      ipcRenderer.on('discovery:stream', (_, data) => cb(data))
      return () => ipcRenderer.removeAllListeners('discovery:stream')
    }
  },

  // Diagnostics
  diag: {
    dnsTest: (domain?: string) => ipcRenderer.invoke('diag:dns-test', domain),
    resolvConf: () => ipcRenderer.invoke('diag:resolv-conf'),
    trace: (target?: string) => ipcRenderer.invoke('diag:trace', target),
    traceStream: (target?: string) => ipcRenderer.invoke('diag:trace-stream', target),
    traceStop: () => ipcRenderer.invoke('diag:trace-stop'),
    ping: (target?: string, count?: number) => ipcRenderer.invoke('diag:ping', target, count),
    pingStream: (target?: string, count?: number) => ipcRenderer.invoke('diag:ping-stream', target, count),
    pingStop: () => ipcRenderer.invoke('diag:ping-stop'),
    systemInfo: () => ipcRenderer.invoke('diag:system-info'),
    onTraceStream: (cb: (data: any) => void) => {
      ipcRenderer.on('diag:trace-stream', (_, data) => cb(data))
      return () => ipcRenderer.removeAllListeners('diag:trace-stream')
    },
    onPingStream: (cb: (data: any) => void) => {
      ipcRenderer.on('diag:ping-stream', (_, data) => cb(data))
      return () => ipcRenderer.removeAllListeners('diag:ping-stream')
    }
  },

  // Ports
  ports: {
    list: (filter?: 'tcp' | 'udp' | 'all') => ipcRenderer.invoke('ports:list', filter),
    connections: () => ipcRenderer.invoke('ports:connections'),
    scanHost: (ip: string, portRange?: string) => ipcRenderer.invoke('ports:scan-host', ip, portRange),
    processInfo: (port: number) => ipcRenderer.invoke('ports:process-info', port)
  },

  // Speed
  speed: {
    checkTools: () => ipcRenderer.invoke('speed:check-tools'),
    run: () => ipcRenderer.invoke('speed:run'),
    runFull: () => ipcRenderer.invoke('speed:run-full'),
    stream: () => ipcRenderer.invoke('speed:stream'),
    stop: () => ipcRenderer.invoke('speed:stop'),
    onStream: (cb: (data: any) => void) => {
      ipcRenderer.on('speed:stream', (_, data) => cb(data))
      return () => ipcRenderer.removeAllListeners('speed:stream')
    }
  },

  // System
  system: {
    checkDeps: () => ipcRenderer.invoke('system:check-deps'),
    installTool: (toolCommand: string) => ipcRenderer.invoke('system:install-tool', toolCommand),
    distroInfo: () => ipcRenderer.invoke('system:distro-info'),
    reportsList: () => ipcRenderer.invoke('system:reports-list'),
    reportRead: (path: string) => ipcRenderer.invoke('system:report-read', path),
    reportDelete: (path: string) => ipcRenderer.invoke('system:report-delete', path),
    reportsDir: () => ipcRenderer.invoke('system:reports-dir'),
    openReportsDir: () => ipcRenderer.invoke('system:open-reports-dir'),
    appVersion: () => ipcRenderer.invoke('system:app-version'),
    isRoot: () => ipcRenderer.invoke('system:is-root'),
    pmInfo: () => ipcRenderer.invoke('system:pm-info'),
    elevationStatus: () => ipcRenderer.invoke('system:elevation-status'),
    fixReportsDir: () => ipcRenderer.invoke('system:fix-reports-dir'),
    errorsList: () => ipcRenderer.invoke('system:errors-list'),
    logError: (title: string, detail: string) => ipcRenderer.invoke('system:log-error', title, detail),
    openExternal: (url: string) => ipcRenderer.invoke('system:open-external', url)
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximized: (cb: (maximized: boolean) => void) => {
      ipcRenderer.on('window:maximized', (_, val) => cb(val))
      return () => ipcRenderer.removeAllListeners('window:maximized')
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}

export type Api = typeof api
