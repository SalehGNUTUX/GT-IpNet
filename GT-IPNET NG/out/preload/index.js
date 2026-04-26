"use strict";
const electron = require("electron");
const electronAPI = {
  ipcRenderer: {
    send(channel, ...args) {
      electron.ipcRenderer.send(channel, ...args);
    },
    sendTo(webContentsId, channel, ...args) {
      const electronVer = process.versions.electron;
      const electronMajorVer = electronVer ? parseInt(electronVer.split(".")[0]) : 0;
      if (electronMajorVer >= 28) {
        throw new Error('"sendTo" method has been removed since Electron 28.');
      } else {
        electron.ipcRenderer.sendTo(webContentsId, channel, ...args);
      }
    },
    sendSync(channel, ...args) {
      return electron.ipcRenderer.sendSync(channel, ...args);
    },
    sendToHost(channel, ...args) {
      electron.ipcRenderer.sendToHost(channel, ...args);
    },
    postMessage(channel, message, transfer) {
      electron.ipcRenderer.postMessage(channel, message, transfer);
    },
    invoke(channel, ...args) {
      return electron.ipcRenderer.invoke(channel, ...args);
    },
    on(channel, listener) {
      electron.ipcRenderer.on(channel, listener);
      return () => {
        electron.ipcRenderer.removeListener(channel, listener);
      };
    },
    once(channel, listener) {
      electron.ipcRenderer.once(channel, listener);
      return () => {
        electron.ipcRenderer.removeListener(channel, listener);
      };
    },
    removeListener(channel, listener) {
      electron.ipcRenderer.removeListener(channel, listener);
      return this;
    },
    removeAllListeners(channel) {
      electron.ipcRenderer.removeAllListeners(channel);
    }
  },
  webFrame: {
    insertCSS(css) {
      return electron.webFrame.insertCSS(css);
    },
    setZoomFactor(factor) {
      if (typeof factor === "number" && factor > 0) {
        electron.webFrame.setZoomFactor(factor);
      }
    },
    setZoomLevel(level) {
      if (typeof level === "number") {
        electron.webFrame.setZoomLevel(level);
      }
    }
  },
  webUtils: {
    getPathForFile(file) {
      return electron.webUtils.getPathForFile(file);
    }
  },
  process: {
    get platform() {
      return process.platform;
    },
    get versions() {
      return process.versions;
    },
    get env() {
      return { ...process.env };
    }
  }
};
const api = {
  // Network
  network: {
    listInterfaces: () => electron.ipcRenderer.invoke("network:list-interfaces"),
    interfaceDetails: (iface) => electron.ipcRenderer.invoke("network:interface-details", iface),
    routingTable: () => electron.ipcRenderer.invoke("network:routing-table"),
    fullReport: (iface) => electron.ipcRenderer.invoke("network:full-report", iface),
    arpTable: () => electron.ipcRenderer.invoke("network:arp-table"),
    wifiInfo: () => electron.ipcRenderer.invoke("network:wifi-info"),
    systemStats: () => electron.ipcRenderer.invoke("network:system-stats")
  },
  // Discovery
  discovery: {
    quickScan: (iface) => electron.ipcRenderer.invoke("discovery:quick-scan", iface),
    fullScan: (iface, subnet) => electron.ipcRenderer.invoke("discovery:full-scan", iface, subnet),
    streamScan: (iface, mode, subnet) => electron.ipcRenderer.invoke("discovery:stream-scan", iface, mode, subnet),
    stop: () => electron.ipcRenderer.invoke("discovery:stop"),
    hostDetails: (ip) => electron.ipcRenderer.invoke("discovery:host-details", ip),
    getSubnet: (iface) => electron.ipcRenderer.invoke("discovery:get-subnet", iface),
    enrich: (hosts) => electron.ipcRenderer.invoke("discovery:enrich", hosts),
    ouiLookup: (mac) => electron.ipcRenderer.invoke("discovery:oui-lookup", mac),
    mdnsScan: () => electron.ipcRenderer.invoke("discovery:mdns-scan"),
    identifyHost: (ip, mac) => electron.ipcRenderer.invoke("discovery:identify-host", ip, mac),
    preload: () => electron.ipcRenderer.invoke("discovery:preload"),
    onStream: (cb) => {
      electron.ipcRenderer.on("discovery:stream", (_, data) => cb(data));
      return () => electron.ipcRenderer.removeAllListeners("discovery:stream");
    }
  },
  // Diagnostics
  diag: {
    dnsTest: (domain) => electron.ipcRenderer.invoke("diag:dns-test", domain),
    resolvConf: () => electron.ipcRenderer.invoke("diag:resolv-conf"),
    trace: (target) => electron.ipcRenderer.invoke("diag:trace", target),
    traceStream: (target) => electron.ipcRenderer.invoke("diag:trace-stream", target),
    traceStop: () => electron.ipcRenderer.invoke("diag:trace-stop"),
    ping: (target, count) => electron.ipcRenderer.invoke("diag:ping", target, count),
    pingStream: (target, count) => electron.ipcRenderer.invoke("diag:ping-stream", target, count),
    pingStop: () => electron.ipcRenderer.invoke("diag:ping-stop"),
    systemInfo: () => electron.ipcRenderer.invoke("diag:system-info"),
    onTraceStream: (cb) => {
      electron.ipcRenderer.on("diag:trace-stream", (_, data) => cb(data));
      return () => electron.ipcRenderer.removeAllListeners("diag:trace-stream");
    },
    onPingStream: (cb) => {
      electron.ipcRenderer.on("diag:ping-stream", (_, data) => cb(data));
      return () => electron.ipcRenderer.removeAllListeners("diag:ping-stream");
    }
  },
  // Ports
  ports: {
    list: (filter) => electron.ipcRenderer.invoke("ports:list", filter),
    connections: () => electron.ipcRenderer.invoke("ports:connections"),
    scanHost: (ip, portRange) => electron.ipcRenderer.invoke("ports:scan-host", ip, portRange),
    processInfo: (port) => electron.ipcRenderer.invoke("ports:process-info", port)
  },
  // Speed
  speed: {
    checkTools: () => electron.ipcRenderer.invoke("speed:check-tools"),
    run: () => electron.ipcRenderer.invoke("speed:run"),
    runFull: () => electron.ipcRenderer.invoke("speed:run-full"),
    stream: () => electron.ipcRenderer.invoke("speed:stream"),
    stop: () => electron.ipcRenderer.invoke("speed:stop"),
    onStream: (cb) => {
      electron.ipcRenderer.on("speed:stream", (_, data) => cb(data));
      return () => electron.ipcRenderer.removeAllListeners("speed:stream");
    }
  },
  // System
  system: {
    checkDeps: () => electron.ipcRenderer.invoke("system:check-deps"),
    installTool: (toolCommand) => electron.ipcRenderer.invoke("system:install-tool", toolCommand),
    distroInfo: () => electron.ipcRenderer.invoke("system:distro-info"),
    reportsList: () => electron.ipcRenderer.invoke("system:reports-list"),
    reportRead: (path) => electron.ipcRenderer.invoke("system:report-read", path),
    reportDelete: (path) => electron.ipcRenderer.invoke("system:report-delete", path),
    reportsDir: () => electron.ipcRenderer.invoke("system:reports-dir"),
    openReportsDir: () => electron.ipcRenderer.invoke("system:open-reports-dir"),
    appVersion: () => electron.ipcRenderer.invoke("system:app-version"),
    isRoot: () => electron.ipcRenderer.invoke("system:is-root"),
    pmInfo: () => electron.ipcRenderer.invoke("system:pm-info"),
    elevationStatus: () => electron.ipcRenderer.invoke("system:elevation-status"),
    fixReportsDir: () => electron.ipcRenderer.invoke("system:fix-reports-dir"),
    errorsList: () => electron.ipcRenderer.invoke("system:errors-list"),
    logError: (title, detail) => electron.ipcRenderer.invoke("system:log-error", title, detail),
    openExternal: (url) => electron.ipcRenderer.invoke("system:open-external", url)
  },
  // Window controls
  window: {
    minimize: () => electron.ipcRenderer.invoke("window:minimize"),
    maximize: () => electron.ipcRenderer.invoke("window:maximize"),
    close: () => electron.ipcRenderer.invoke("window:close"),
    isMaximized: () => electron.ipcRenderer.invoke("window:is-maximized"),
    onMaximized: (cb) => {
      electron.ipcRenderer.on("window:maximized", (_, val) => cb(val));
      return () => electron.ipcRenderer.removeAllListeners("window:maximized");
    }
  }
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = electronAPI;
  window.api = api;
}
