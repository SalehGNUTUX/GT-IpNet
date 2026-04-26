"use strict";
const electron = require("electron");
const path = require("path");
const child_process = require("child_process");
const util = require("util");
const promises = require("fs/promises");
const fs = require("fs");
const os = require("os");
const is = {
  dev: !electron.app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      electron.app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return electron.app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      electron.app.setLoginItemSettings({
        openAtLogin: auto,
        path: process.execPath
      });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return electron.session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    electron.ipcMain.on("win:invoke", (event, action) => {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
const execAsync$2 = util.promisify(child_process.exec);
const STANDARD_DIRS = [
  "/usr/local/sbin",
  "/usr/local/bin",
  "/usr/sbin",
  "/usr/bin",
  "/sbin",
  "/bin"
];
function buildPath() {
  const existing = (process.env.PATH || "").split(":").filter(Boolean);
  const merged = [.../* @__PURE__ */ new Set([...STANDARD_DIRS, ...existing])];
  return merged.join(":");
}
const FULL_PATH = buildPath();
let _sudoAvailable = null;
let _pkexecAvailable = null;
function isRoot() {
  return process.getuid?.() === 0;
}
async function checkSudoNoPass() {
  if (_sudoAvailable !== null) return _sudoAvailable;
  const result = await _spawn("sudo", ["-n", "true"]);
  _sudoAvailable = result.code === 0;
  return _sudoAvailable;
}
async function checkPkexec() {
  if (_pkexecAvailable !== null) return _pkexecAvailable;
  const result = await _spawn("which", ["pkexec"]);
  _pkexecAvailable = result.code === 0;
  return _pkexecAvailable;
}
async function elevatedArgs(cmd, args) {
  if (isRoot()) return [cmd, ...args];
  if (await checkSudoNoPass()) {
    return ["sudo", "-n", cmd, ...args];
  }
  if (await checkPkexec()) {
    const display = process.env.DISPLAY || ":0";
    const xauth = process.env.XAUTHORITY || "";
    return [
      "pkexec",
      "env",
      `DISPLAY=${display}`,
      ...xauth ? [`XAUTHORITY=${xauth}`] : [],
      "LANG=C",
      "LC_ALL=C",
      cmd,
      ...args
    ];
  }
  return [cmd, ...args];
}
function _spawn(binary, args, extraEnv = {}) {
  return new Promise((resolve) => {
    const proc = child_process.spawn(binary, args, {
      env: { ...process.env, PATH: FULL_PATH, LANG: "C", LC_ALL: "C", ...extraEnv }
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => stdout += d.toString());
    proc.stderr.on("data", (d) => stderr += d.toString());
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));
    proc.on("error", (err) => resolve({ stdout: "", stderr: err.message, code: 1 }));
  });
}
async function runCommand(cmd, args = [], sudo = false) {
  if (!sudo) return _spawn(cmd, args);
  if (isRoot()) return _spawn(cmd, args);
  const sudoOk = await checkSudoNoPass();
  if (sudoOk) return _spawn("sudo", ["-n", cmd, ...args]);
  const pkOk = await checkPkexec();
  if (pkOk) {
    const display = process.env.DISPLAY || ":0";
    const xauth = process.env.XAUTHORITY || "";
    return _spawn("pkexec", [
      "env",
      `DISPLAY=${display}`,
      ...xauth ? [`XAUTHORITY=${xauth}`] : [],
      cmd,
      ...args
    ]);
  }
  return {
    stdout: "",
    stderr: `"${cmd}" requires root privileges.
Run GT-IpNet with: sudo -E npm run dev
or install polkit (pkexec).`,
    code: 126,
    needsElevation: true
  };
}
async function streamCommand(win, cmd, args, opts) {
  const { channel, sudo = false, env = {}, timeout } = opts;
  const send = (payload) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  };
  const finalArgs = sudo ? await elevatedArgs(cmd, args) : [cmd, ...args];
  if (sudo && !isRoot() && !await checkSudoNoPass() && !await checkPkexec()) {
    send({
      done: true,
      code: 126,
      error: `"${cmd}" requires root privileges. Install polkit or run app with sudo.`,
      needsElevation: true
    });
    return () => {
    };
  }
  const [binary, ...rest] = finalArgs;
  const proc = child_process.spawn(binary, rest, {
    env: { ...process.env, PATH: FULL_PATH, LANG: "C", LC_ALL: "C", ...env }
  });
  let timer = null;
  if (timeout) {
    timer = setTimeout(() => {
      proc.kill("SIGTERM");
      send({ error: "Operation timed out", done: true, code: -1 });
    }, timeout);
  }
  proc.stdout.on("data", (d) => {
    d.toString().split("\n").filter(Boolean).forEach((line) => send({ line }));
  });
  proc.stderr.on("data", (d) => {
    d.toString().split("\n").filter(Boolean).forEach((line) => send({ line, isError: true }));
  });
  proc.on("close", (code) => {
    if (timer) clearTimeout(timer);
    send({ done: true, code: code ?? 0 });
  });
  proc.on("error", (err) => {
    if (timer) clearTimeout(timer);
    send({ error: err.message, done: true, code: 1 });
  });
  return () => proc.kill("SIGTERM");
}
async function commandExists(cmd) {
  const { code } = await _spawn("which", [cmd]);
  return code === 0;
}
async function simpleExec(cmd) {
  try {
    const { stdout } = await execAsync$2(cmd, {
      env: { ...process.env, PATH: FULL_PATH, LANG: "C", LC_ALL: "C" }
    });
    return stdout.trim();
  } catch {
    return "";
  }
}
async function getElevationStatus() {
  const root = isRoot();
  const sudo = root || await checkSudoNoPass();
  const pk = !sudo && await checkPkexec();
  return {
    isRoot: root,
    sudoAvailable: await checkSudoNoPass(),
    pkexecAvailable: await checkPkexec(),
    canElevate: root || sudo || pk
  };
}
const execAsync$1 = util.promisify(child_process.exec);
const _SYS_PATH = [
  "/usr/local/sbin",
  "/usr/local/bin",
  "/usr/sbin",
  "/usr/bin",
  "/sbin",
  "/bin",
  process.env.PATH || ""
].filter(Boolean).join(":");
const _execOpts = { env: { ...process.env, PATH: _SYS_PATH } };
function getRealHome() {
  const sudoUser = process.env.SUDO_USER;
  if (sudoUser && process.getuid?.() === 0) {
    return path.join("/home", sudoUser);
  }
  return os.homedir();
}
function buildReportsDir() {
  return path.join(getRealHome(), "GT-IpNet_Reports");
}
function getReportsDir() {
  return buildReportsDir();
}
async function ensureReportsDir() {
  const dir = buildReportsDir();
  try {
    await promises.mkdir(dir, { recursive: true });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
  try {
    await promises.access(dir, fs.constants.W_OK);
    return dir;
  } catch {
    await fixDirOwnership(dir);
    return dir;
  }
}
async function fixDirOwnership(dir) {
  const uid = process.getuid?.() ?? -1;
  process.getgid?.() ?? -1;
  if (uid === 0) {
    const targetUser = process.env.SUDO_USER;
    if (targetUser) {
      try {
        await execAsync$1(`chown -R ${targetUser}:${targetUser} "${dir}"`, _execOpts);
      } catch {
      }
    }
    return;
  }
  try {
    const user = process.env.USER || process.env.LOGNAME || String(uid);
    await execAsync$1(`pkexec chown -R ${user}:${user} "${dir}"`, _execOpts);
    return;
  } catch {
  }
  try {
    const user = process.env.USER || process.env.LOGNAME || String(uid);
    await execAsync$1(`sudo -n chown -R ${user}:${user} "${dir}"`, _execOpts);
    return;
  } catch {
  }
}
function getReportPath(tool) {
  const ts = (/* @__PURE__ */ new Date()).toISOString().replace("T", "_").replace(/:/g, "-").slice(0, 19);
  return path.join(buildReportsDir(), `${tool}_${ts}.txt`);
}
async function saveReport(tool, content) {
  try {
    await ensureReportsDir();
    const path2 = getReportPath(tool);
    const header = [
      "=".repeat(60),
      `GT-IpNet Report — ${tool}`,
      `Generated: ${(/* @__PURE__ */ new Date()).toLocaleString()}`,
      `System: ${process.platform} ${process.arch}`,
      "=".repeat(60),
      ""
    ].join("\n");
    await promises.writeFile(path2, header + content, "utf8");
    return path2;
  } catch (e) {
    console.warn(`[GT-IpNet] Could not save report for "${tool}": ${e.message}`);
    return null;
  }
}
async function listReports() {
  try {
    await ensureReportsDir();
    const dir = buildReportsDir();
    const files = await promises.readdir(dir);
    const reports = await Promise.all(
      files.filter((f) => f.endsWith(".txt")).map(async (f) => {
        const path$1 = path.join(dir, f);
        try {
          const s = await promises.stat(path$1);
          return { name: f, path: path$1, size: s.size, date: s.mtime };
        } catch {
          return null;
        }
      })
    );
    return reports.filter(Boolean).sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch {
    return [];
  }
}
async function readReport(path2) {
  return promises.readFile(path2, "utf8");
}
async function deleteReport(path2) {
  await promises.unlink(path2);
}
function getErrorsDir() {
  return path.join(buildReportsDir(), "errors");
}
async function saveError(title, detail) {
  try {
    const dir = getErrorsDir();
    await promises.mkdir(dir, { recursive: true });
    const ts = (/* @__PURE__ */ new Date()).toISOString().replace("T", "_").replace(/:/g, "-").slice(0, 19);
    const path$1 = path.join(dir, `error_${ts}.txt`);
    const content = [
      "=".repeat(60),
      `GT-IpNet Error Log`,
      `Date: ${(/* @__PURE__ */ new Date()).toLocaleString()}`,
      `Title: ${title}`,
      "=".repeat(60),
      "",
      detail,
      ""
    ].join("\n");
    await promises.writeFile(path$1, content, "utf8");
    return path$1;
  } catch (e) {
    console.warn(`[GT-IpNet] Could not save error log: ${e.message}`);
    return null;
  }
}
async function listErrors() {
  try {
    const dir = getErrorsDir();
    await promises.mkdir(dir, { recursive: true });
    const files = await promises.readdir(dir);
    const entries = await Promise.all(
      files.filter((f) => f.endsWith(".txt")).map(async (f) => {
        const path$1 = path.join(dir, f);
        try {
          const s = await promises.stat(path$1);
          return { name: f, path: path$1, size: s.size, date: s.mtime };
        } catch {
          return null;
        }
      })
    );
    return entries.filter(Boolean).sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch {
    return [];
  }
}
function registerNetworkIPC(win) {
  electron.ipcMain.handle("network:list-interfaces", async () => {
    const { stdout } = await runCommand("ip", ["-o", "link", "show"]);
    const interfaces = [];
    for (const line of stdout.split("\n").filter(Boolean)) {
      const m = line.match(/^\d+:\s+(\S+):.+<([^>]+)>.+link\/(\S+)\s+(\S+)/);
      if (!m) continue;
      const [, name, flags, type, mac] = m;
      if (name === "lo") continue;
      interfaces.push({
        name,
        mac,
        type,
        state: flags.includes("UP") ? "up" : "down"
      });
    }
    return interfaces;
  });
  electron.ipcMain.handle("network:interface-details", async (_, iface) => {
    const [addrOut, statOut] = await Promise.all([
      runCommand("ip", ["-o", "addr", "show", iface]),
      runCommand("ip", ["-s", "link", "show", iface])
    ]);
    const details = { name: iface };
    const ipv4m = addrOut.stdout.match(/inet\s+(\S+)/);
    if (ipv4m) {
      const [addr, prefix] = ipv4m[1].split("/");
      details.ipv4 = addr;
      details.netmask = prefix ? cidrToMask(parseInt(prefix)) : "";
    }
    const ipv6m = addrOut.stdout.match(/inet6\s+(\S+)/);
    if (ipv6m) details.ipv6 = ipv6m[1].split("/")[0];
    const macm = statOut.stdout.match(/link\/\S+\s+(\S+)/);
    if (macm) details.mac = macm[1];
    const mtu = statOut.stdout.match(/mtu\s+(\d+)/);
    if (mtu) details.mtu = mtu[1];
    const state = statOut.stdout.match(/state\s+(\S+)/);
    if (state) details.state = state[1].toLowerCase();
    const rxm = statOut.stdout.match(/RX:.*?\n\s+(\d+)/);
    if (rxm) details.rxBytes = formatBytes(parseInt(rxm[1]));
    const txm = statOut.stdout.match(/TX:.*?\n\s+(\d+)/);
    if (txm) details.txBytes = formatBytes(parseInt(txm[1]));
    const bcastm = addrOut.stdout.match(/brd\s+(\S+)/);
    if (bcastm) details.broadcast = bcastm[1];
    return details;
  });
  electron.ipcMain.handle("network:routing-table", async () => {
    const { stdout } = await runCommand("ip", ["route", "show"]);
    return stdout.trim();
  });
  electron.ipcMain.handle("network:full-report", async (_, iface) => {
    const [addr, route, link] = await Promise.all([
      runCommand("ip", ["-o", "addr", "show", iface]),
      runCommand("ip", ["route", "show"]),
      runCommand("ip", ["-s", "link", "show", iface])
    ]);
    const content = [
      "--- Interface Details ---",
      addr.stdout,
      "",
      "--- Routing Table ---",
      route.stdout,
      "",
      "--- Link Statistics ---",
      link.stdout
    ].join("\n");
    const path2 = await saveReport("network", content);
    return { content, path: path2 };
  });
  electron.ipcMain.handle("network:arp-table", async () => {
    const { stdout } = await runCommand("ip", ["neigh", "show"]);
    return stdout.trim();
  });
  electron.ipcMain.handle("network:wifi-info", async () => {
    const hasIw = await commandExists("iwconfig");
    if (!hasIw) return null;
    const { stdout } = await runCommand("iwconfig");
    return stdout.trim();
  });
  electron.ipcMain.handle("network:system-stats", async () => {
    const [uptime, loadavg, mem] = await Promise.all([
      simpleExec("uptime -p"),
      simpleExec("cat /proc/loadavg"),
      simpleExec("free -b | awk 'NR==2{print $2,$3,$4}'")
    ]);
    const [total, used, free] = mem.split(" ").map(Number);
    const [one, five, fifteen] = loadavg.split(" ").map(parseFloat);
    return {
      uptime: uptime || "unknown",
      loadAvg: { one, five, fifteen },
      memory: {
        total: formatBytes(total),
        used: formatBytes(used),
        free: formatBytes(free),
        percent: total ? Math.round(used / total * 100) : 0
      }
    };
  });
}
function cidrToMask(prefix) {
  const mask = new Array(4);
  for (let i = 0; i < 4; i++) {
    const bits = Math.min(prefix, 8);
    mask[i] = 256 - Math.pow(2, 8 - bits);
    prefix -= bits;
  }
  return mask.join(".");
}
function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
const execAsync = util.promisify(child_process.exec);
const _FULL_PATH = [
  "/usr/local/sbin",
  "/usr/local/bin",
  "/usr/sbin",
  "/usr/bin",
  "/sbin",
  "/bin",
  process.env.PATH || ""
].filter(Boolean).join(":");
function _env(extra = {}) {
  return { ...process.env, PATH: _FULL_PATH, LANG: "C", LC_ALL: "C", ...extra };
}
const OUI_PATHS = [
  "/usr/share/nmap/nmap-mac-prefixes",
  "/usr/share/arp-scan/ieee-oui.txt"
];
const MFR_TYPE_MAP = {
  apple: "iphone",
  // refined later by mDNS
  samsung: "android",
  xiaomi: "android",
  huawei: "android",
  oppo: "android",
  vivo: "android",
  oneplus: "android",
  realme: "android",
  google: "android",
  motorola: "android",
  lenovo: "android",
  nokia: "android",
  zte: "android",
  alcatel: "android",
  tcl: "android",
  nothing: "android",
  microsoft: "windows",
  hp: "printer",
  canon: "printer",
  epson: "printer",
  brother: "printer",
  cisco: "router",
  juniper: "router",
  ubiquiti: "access-point",
  netgear: "router",
  "tp-link": "router",
  asus: "router",
  linksys: "router",
  dlink: "router",
  "d-link": "router",
  aruba: "access-point",
  meraki: "access-point",
  amazon: "smart-home",
  roku: "tv",
  sharp: "tv",
  lg: "tv",
  // LG exited phones in 2021; most LG MACs = smart TV
  hisense: "tv",
  philips: "tv",
  sony: "android",
  // Sony Xperia still active; TV detection via mDNS services
  raspberry: "linux"
};
let _ouiCache = null;
async function loadOui() {
  if (_ouiCache) return _ouiCache;
  const db = /* @__PURE__ */ new Map();
  for (const path2 of OUI_PATHS) {
    try {
      const content = await promises.readFile(path2, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const nmapMatch = trimmed.match(/^([0-9A-Fa-f]{6})\s+(.+)$/);
        if (nmapMatch) {
          db.set(nmapMatch[1].toUpperCase(), nmapMatch[2].trim());
          continue;
        }
        const arpMatch = trimmed.match(/^([0-9A-Fa-f]{2}:[0-9A-Fa-f]{2}:[0-9A-Fa-f]{2})\t([^\t]+)/);
        if (arpMatch) {
          db.set(arpMatch[1].replace(/:/g, "").toUpperCase(), arpMatch[2].trim());
        }
      }
      if (db.size > 0) break;
    } catch {
    }
  }
  _ouiCache = db;
  return db;
}
function ouiLookup(mac, db) {
  const prefix = mac.replace(/[:\-\.]/g, "").toUpperCase().slice(0, 6);
  return db.get(prefix) ?? "";
}
function mfrToType(mfr) {
  const lower = mfr.toLowerCase();
  for (const [key, type] of Object.entries(MFR_TYPE_MAP)) {
    if (lower.includes(key)) return type;
  }
  return "unknown";
}
const APPLE_MODELS = {
  // iPhone 16 series
  "iPhone17,1": "iPhone 16 Pro",
  "iPhone17,2": "iPhone 16 Pro Max",
  "iPhone17,3": "iPhone 16",
  "iPhone17,4": "iPhone 16 Plus",
  // iPhone 15 series
  "iPhone16,1": "iPhone 15 Pro",
  "iPhone16,2": "iPhone 15 Pro Max",
  "iPhone15,4": "iPhone 15",
  "iPhone15,5": "iPhone 15 Plus",
  // iPhone 14 series
  "iPhone15,2": "iPhone 14 Pro",
  "iPhone15,3": "iPhone 14 Pro Max",
  "iPhone14,7": "iPhone 14",
  "iPhone14,8": "iPhone 14 Plus",
  // iPhone 13 series
  "iPhone14,2": "iPhone 13 Pro",
  "iPhone14,3": "iPhone 13 Pro Max",
  "iPhone14,4": "iPhone 13 mini",
  "iPhone14,5": "iPhone 13",
  // iPhone 12 series
  "iPhone13,1": "iPhone 12 mini",
  "iPhone13,2": "iPhone 12",
  "iPhone13,3": "iPhone 12 Pro",
  "iPhone13,4": "iPhone 12 Pro Max",
  // iPhone 11 series
  "iPhone12,1": "iPhone 11",
  "iPhone12,3": "iPhone 11 Pro",
  "iPhone12,5": "iPhone 11 Pro Max",
  "iPhone12,8": "iPhone SE (2nd gen)",
  // iPhone X/XR/XS
  "iPhone10,1": "iPhone 8",
  "iPhone10,2": "iPhone 8 Plus",
  "iPhone10,3": "iPhone X",
  "iPhone10,4": "iPhone 8",
  "iPhone10,5": "iPhone 8 Plus",
  "iPhone10,6": "iPhone X",
  "iPhone11,2": "iPhone XS",
  "iPhone11,4": "iPhone XS Max",
  "iPhone11,6": "iPhone XS Max",
  "iPhone11,8": "iPhone XR",
  // iPhone 7/6s/6
  "iPhone9,1": "iPhone 7",
  "iPhone9,2": "iPhone 7 Plus",
  "iPhone9,3": "iPhone 7",
  "iPhone9,4": "iPhone 7 Plus",
  "iPhone8,1": "iPhone 6s",
  "iPhone8,2": "iPhone 6s Plus",
  "iPhone8,4": "iPhone SE (1st gen)",
  "iPhone7,1": "iPhone 6 Plus",
  "iPhone7,2": "iPhone 6",
  // iPad Pro
  "iPad16,3": 'iPad Pro 11" (M4)',
  "iPad16,4": 'iPad Pro 11" (M4)',
  "iPad16,5": 'iPad Pro 13" (M4)',
  "iPad16,6": 'iPad Pro 13" (M4)',
  "iPad14,3": 'iPad Pro 11" (M2)',
  "iPad14,4": 'iPad Pro 11" (M2)',
  "iPad14,5": 'iPad Pro 12.9" (M2)',
  "iPad14,6": 'iPad Pro 12.9" (M2)',
  "iPad13,4": 'iPad Pro 11" (M1)',
  "iPad13,5": 'iPad Pro 11" (M1)',
  "iPad13,6": 'iPad Pro 11" (M1)',
  "iPad13,7": 'iPad Pro 11" (M1)',
  "iPad13,8": 'iPad Pro 12.9" (M1)',
  "iPad13,9": 'iPad Pro 12.9" (M1)',
  "iPad13,10": 'iPad Pro 12.9" (M1)',
  "iPad13,11": 'iPad Pro 12.9" (M1)',
  // iPad Air
  "iPad14,8": 'iPad Air 13" (M2)',
  "iPad14,9": 'iPad Air 13" (M2)',
  "iPad14,10": 'iPad Air 11" (M2)',
  "iPad14,11": 'iPad Air 11" (M2)',
  "iPad13,16": "iPad Air (M1)",
  "iPad13,17": "iPad Air (M1)",
  "iPad13,1": "iPad Air (4th gen)",
  "iPad13,2": "iPad Air (4th gen)",
  "iPad11,3": "iPad Air (3rd gen)",
  "iPad11,4": "iPad Air (3rd gen)",
  // iPad (base)
  "iPad14,1": "iPad (10th gen)",
  "iPad14,2": "iPad (10th gen)",
  "iPad12,1": "iPad (9th gen)",
  "iPad12,2": "iPad (9th gen)",
  "iPad11,6": "iPad (8th gen)",
  "iPad11,7": "iPad (8th gen)",
  "iPad7,11": "iPad (7th gen)",
  "iPad7,12": "iPad (7th gen)",
  // iPad mini
  "iPad16,1": "iPad mini (7th gen)",
  "iPad16,2": "iPad mini (7th gen)",
  "iPad14,7": "iPad mini (6th gen)",
  "iPad11,1": "iPad mini (5th gen)",
  "iPad11,2": "iPad mini (5th gen)",
  // Mac
  "Mac15,3": 'MacBook Air 15" (M3)',
  "Mac15,4": 'MacBook Air 13" (M3)',
  "Mac14,15": 'MacBook Air 15" (M2)',
  "Mac14,2": 'MacBook Air 13" (M2)',
  "Mac14,3": "Mac mini (M2)",
  "Mac14,12": "Mac mini (M2 Pro)",
  "Mac14,5": 'MacBook Pro 14" (M2 Pro)',
  "Mac14,6": 'MacBook Pro 16" (M2 Max)',
  "MacBookPro18,1": 'MacBook Pro 16" (M1 Pro)',
  "MacBookPro18,2": 'MacBook Pro 16" (M1 Max)',
  "MacBookPro18,3": 'MacBook Pro 14" (M1 Pro)',
  "MacBookPro18,4": 'MacBook Pro 14" (M1 Max)',
  "MacBookAir10,1": "MacBook Air (M1)",
  // Apple TV
  "AppleTV6,2": "Apple TV 4K (3rd gen)",
  "AppleTV11,1": "Apple TV 4K (2nd gen)",
  "AppleTV5,3": "Apple TV 4K (1st gen)",
  "AppleTV3,1": "Apple TV (3rd gen)",
  // Apple Watch
  "Watch7,1": "Apple Watch Series 10 40mm",
  "Watch7,2": "Apple Watch Series 10 42mm",
  "Watch6,6": "Apple Watch Ultra 2",
  "Watch6,7": "Apple Watch Ultra 2",
  "Watch6,9": "Apple Watch SE (2nd gen) 40mm",
  "Watch6,10": "Apple Watch SE (2nd gen) 44mm",
  "Watch6,14": "Apple Watch Series 9 41mm",
  "Watch6,15": "Apple Watch Series 9 45mm"
};
function appleModelName(modelId) {
  if (!modelId) return "";
  const clean = modelId.replace(/\\\,/g, ",");
  return APPLE_MODELS[clean] ?? modelId;
}
function appleDeviceType(modelId) {
  if (!modelId) return "apple-tv";
  const c = modelId.toLowerCase();
  if (c.startsWith("iphone")) return "iphone";
  if (c.startsWith("ipad")) return "ipad";
  if (c.startsWith("appletv")) return "apple-tv";
  if (c.startsWith("watch")) return "apple-watch";
  if (c.startsWith("mac") || c.startsWith("macbook") || c.startsWith("imac") || c.startsWith("macpro") || c.startsWith("macmini")) return "mac";
  return "mac";
}
let _mdnsCache = null;
let _mdnsCacheTs = 0;
async function runMdnsScan(timeoutMs = 1e4) {
  const now = Date.now();
  if (_mdnsCache && now - _mdnsCacheTs < 6e4) return _mdnsCache;
  const result = /* @__PURE__ */ new Map();
  const hasAvahi = await commandExists("avahi-browse");
  if (hasAvahi) {
    try {
      const { stdout } = await execAsync(
        `avahi-browse -a -t -r -p 2>/dev/null`,
        { timeout: timeoutMs, env: _env() }
      );
      parseAvahiOutput(stdout, result);
    } catch {
    }
    try {
      const { stdout } = await execAsync(
        `avahi-browse -a -t -r 2>/dev/null`,
        { timeout: timeoutMs, env: _env({ LANG: "UTF-8", LC_ALL: "UTF-8" }) }
      );
      parseAvahiHuman(stdout, result);
    } catch {
    }
  }
  if (result.size === 0) {
    const hasNmap = await commandExists("nmap");
    if (hasNmap) {
      try {
        const { stdout } = await execAsync(
          `nmap -sU -p 5353 --script=mdns-sd --open -T4 224.0.0.251 2>/dev/null`,
          { timeout: timeoutMs, env: _env() }
        );
        parseNmapMdns(stdout, result);
      } catch {
      }
    }
  }
  _mdnsCache = result;
  _mdnsCacheTs = now;
  return result;
}
async function avahiResolveIp(ip) {
  try {
    const hasAvahi = await commandExists("avahi-resolve");
    if (!hasAvahi) return "";
    const { stdout } = await execAsync(
      `avahi-resolve --address ${ip} 2>/dev/null`,
      { timeout: 3e3, env: _env() }
    );
    const m = stdout.match(/\S+\s+(\S+)/);
    return m ? m[1].replace(/\.local$/, "") : "";
  } catch {
    return "";
  }
}
async function nmblookupIp(ip) {
  try {
    const hasNmb = await commandExists("nmblookup");
    if (!hasNmb) return "";
    const { stdout } = await execAsync(
      `nmblookup -A ${ip} 2>/dev/null`,
      { timeout: 3e3, env: _env() }
    );
    const m = stdout.match(/^\t(\S+)\s+<00>\s+-\s+\S\s+<ACTIVE>/m);
    return m ? m[1] : "";
  } catch {
    return "";
  }
}
function parseAvahiOutput(output, result) {
  const lines = output.split("\n");
  for (const line of lines) {
    if (!line.startsWith("=")) continue;
    const parts = line.split(";");
    if (parts.length < 9) continue;
    const [, iface, proto, name, type, , hostname, ip, , ...txtParts] = parts;
    if (!ip || ip === "0.0.0.0" || ip === "::1") continue;
    const txt = txtParts.join(";");
    const modelIdMatch = txt.match(/model=([^"\\]+(?:\\,[^"\\]*)?)/);
    const modelId = modelIdMatch ? modelIdMatch[1].replace(/\\\,/g, ",") : "";
    const osMatch = txt.match(/osxvers=(\d+)/);
    const existing = result.get(ip) ?? {
      ip,
      hostname: hostname?.replace(/\.local$/, "") || "",
      name: name || "",
      modelId: "",
      modelName: "",
      os: "",
      deviceType: "unknown",
      services: []
    };
    if (modelId) existing.modelId = modelId;
    if (modelId) existing.modelName = appleModelName(modelId);
    if (modelId) existing.deviceType = appleDeviceType(modelId);
    if (osMatch) existing.os = osVersionLabel(parseInt(osMatch[1]));
    if (type && !existing.services.includes(type)) existing.services.push(type);
    if (name && !existing.name) existing.name = name;
    result.set(ip, existing);
  }
}
function parseAvahiHuman(output, result) {
  const lines = output.split("\n");
  let currentName = "";
  let currentHostname = "";
  for (const line of lines) {
    const eqMatch = line.match(/^=\s+\S+\s+IPv[46]\s+(.+?)\s{2,}_\S+\._\S+/);
    if (eqMatch) {
      currentName = eqMatch[1].trim();
      currentHostname = "";
      continue;
    }
    const hnMatch = line.match(/hostname\s*=\s*\[([^\]]+)\]/);
    if (hnMatch) {
      currentHostname = hnMatch[1].replace(/\.local$/, "");
      continue;
    }
    const addrMatch = line.match(/address\s*=\s*\[([0-9a-fA-F:.]+)\]/);
    if (addrMatch && currentName) {
      const ip = addrMatch[1];
      if (!ip || ip === "0.0.0.0" || ip.startsWith("::")) {
        currentName = "";
        continue;
      }
      const existing = result.get(ip);
      if (existing) {
        if (!existing.name && currentName) existing.name = currentName;
        if (!existing.hostname && currentHostname) existing.hostname = currentHostname;
      } else {
        result.set(ip, {
          ip,
          name: currentName,
          hostname: currentHostname,
          modelId: "",
          modelName: "",
          os: "",
          deviceType: "unknown",
          services: []
        });
      }
      currentName = "";
    }
  }
}
function parseNmapMdns(output, result) {
  const ipMatch = output.match(/Nmap scan report for (\S+)/);
  const ip = ipMatch ? ipMatch[1] : "";
  if (!ip) return;
  const names = [...output.matchAll(/\|\s+([^\n]+)/g)].map((m) => m[1].trim());
  if (names.length > 0 && ip) {
    result.set(ip, {
      ip,
      hostname: names[0],
      name: names[0],
      modelId: "",
      modelName: "",
      os: "",
      deviceType: "unknown",
      services: names
    });
  }
}
function osVersionLabel(version) {
  const map = {
    24: "macOS 15 Sequoia",
    23: "macOS 14 Sonoma",
    22: "macOS 13 Ventura",
    21: "macOS 12 Monterey",
    20: "iOS/macOS 11+",
    19: "macOS 10.15 Catalina"
  };
  return map[version] ?? `macOS/iOS ${version}`;
}
async function resolveHostname(ip) {
  try {
    const { stdout } = await execAsync(
      `getent hosts ${ip}`,
      { timeout: 2e3, env: _env() }
    );
    const parts = stdout.trim().split(/\s+/);
    return parts[1] || "";
  } catch {
    try {
      const { stdout } = await execAsync(
        `dig +short +time=1 -x ${ip}`,
        { timeout: 2e3, env: _env() }
      );
      return stdout.trim().replace(/\.$/, "");
    } catch {
      return "";
    }
  }
}
async function enrichHost(ip, mac, ouiDb, mdnsDevices) {
  const manufacturer = ouiLookup(mac, ouiDb);
  let deviceType = mfrToType(manufacturer);
  let deviceName = "";
  let modelId = "";
  let modelName = "";
  let os2 = "";
  let hostname = "";
  const source = [];
  if (manufacturer) source.push("oui");
  const mdns = mdnsDevices.get(ip);
  if (mdns) {
    source.push("mdns");
    deviceName = mdns.name || mdns.hostname;
    hostname = mdns.hostname || mdns.name;
    modelId = mdns.modelId;
    modelName = mdns.modelName;
    os2 = mdns.os;
    if (mdns.deviceType !== "unknown") deviceType = mdns.deviceType;
  }
  if (!hostname) {
    const avahiName = await avahiResolveIp(ip);
    if (avahiName) {
      hostname = avahiName;
      source.push("avahi-resolve");
    }
  }
  if (!hostname) {
    const resolved = await resolveHostname(ip);
    if (resolved) {
      hostname = resolved;
      source.push("dns");
    }
  }
  if (!deviceName) {
    const nb = await nmblookupIp(ip);
    if (nb) {
      deviceName = nb;
      source.push("nbns");
    }
  }
  if (!deviceName && hostname) deviceName = hostname.replace(/\.local$/, "");
  if (mdns?.services) {
    if (mdns.services.some((s) => s.includes("_apple-mobdev") || s.includes("_ipp") && modelId?.startsWith("iPhone"))) {
      deviceType = "iphone";
    }
    if (mdns.services.some((s) => s.includes("_googlecast") || s.includes("_androidtvremote"))) {
      deviceType = "android";
      if (!deviceName && mdns.name) deviceName = mdns.name;
    }
  }
  return { manufacturer, deviceType, deviceName, modelId, modelName, os: os2, hostname, source };
}
async function enrichHosts(hosts) {
  const [ouiDb, mdnsDevices] = await Promise.all([
    loadOui(),
    runMdnsScan()
  ]);
  const results = /* @__PURE__ */ new Map();
  await Promise.all(
    hosts.map(async ({ ip, mac }) => {
      const info = await enrichHost(ip, mac, ouiDb, mdnsDevices);
      results.set(ip, info);
    })
  );
  return results;
}
async function quickOuiEnrich(mac) {
  const db = await loadOui();
  const manufacturer = ouiLookup(mac, db);
  return { manufacturer, deviceType: mfrToType(manufacturer) };
}
let stopCurrentScan = null;
function registerDiscoveryIPC(win) {
  electron.ipcMain.handle("discovery:quick-scan", async (_, iface) => {
    if (stopCurrentScan) {
      stopCurrentScan();
      stopCurrentScan = null;
    }
    const hasArpScan = await commandExists("arp-scan");
    if (!hasArpScan) {
      return { error: "arp-scan not installed", hosts: [], method: "none" };
    }
    const { stdout, stderr, code } = await runCommand(
      "arp-scan",
      ["--interface", iface, "--localnet", "--retry=2"],
      true
    );
    if (code !== 0) {
      return { error: stderr, hosts: [], method: "arp-scan" };
    }
    const hosts = parseArpScanOutput(stdout);
    const content = `Quick Scan (arp-scan) on ${iface}

${stdout}`;
    const path2 = await saveReport("discovery_quick", content);
    return { hosts, method: "arp-scan", path: path2 };
  });
  electron.ipcMain.handle("discovery:full-scan", async (_, iface, subnet) => {
    const hasNmap = await commandExists("nmap");
    if (!hasNmap) {
      return { error: "nmap not installed", hosts: [], method: "none" };
    }
    const target = subnet || await getSubnet(iface) || "192.168.1.0/24";
    const { stdout, stderr, code } = await runCommand(
      "nmap",
      ["-sn", "-e", iface, "--open", "-T4", target],
      true
    );
    if (code !== 0) {
      return { error: stderr, hosts: [], method: "nmap" };
    }
    const hosts = parseNmapPingOutput(stdout);
    const content = `Full Scan (nmap) on ${iface} — ${target}

${stdout}`;
    const path2 = await saveReport("discovery_full", content);
    return { hosts, method: "nmap", path: path2 };
  });
  electron.ipcMain.handle("discovery:stream-scan", async (_, iface, mode, subnet) => {
    if (stopCurrentScan) {
      stopCurrentScan();
      stopCurrentScan = null;
    }
    if (mode === "quick") {
      const hasArp = await commandExists("arp-scan");
      if (!hasArp) {
        win.webContents.send("discovery:stream", { error: "arp-scan not installed", done: true });
        return;
      }
      stopCurrentScan = await streamCommand(win, "arp-scan", ["--interface", iface, "--localnet"], {
        channel: "discovery:stream",
        sudo: true,
        timeout: 3e4
      });
    } else {
      const hasNmap = await commandExists("nmap");
      if (!hasNmap) {
        win.webContents.send("discovery:stream", { error: "nmap not installed", done: true });
        return;
      }
      const target = subnet || await getSubnet(iface) || "192.168.1.0/24";
      stopCurrentScan = await streamCommand(win, "nmap", ["-sn", "-e", iface, "-T4", target], {
        channel: "discovery:stream",
        sudo: true,
        timeout: 12e4
      });
    }
  });
  electron.ipcMain.handle("discovery:stop", () => {
    if (stopCurrentScan) {
      stopCurrentScan();
      stopCurrentScan = null;
      return true;
    }
    return false;
  });
  electron.ipcMain.handle("discovery:host-details", async (_, ip) => {
    const hasNmap = await commandExists("nmap");
    if (!hasNmap) return { error: "nmap not installed" };
    const { stdout } = await runCommand("nmap", ["-sV", "-T4", "--open", ip], true);
    return { raw: stdout, ports: parseNmapPortOutput(stdout) };
  });
  electron.ipcMain.handle("discovery:get-subnet", async (_, iface) => {
    return getSubnet(iface);
  });
  electron.ipcMain.handle("discovery:enrich", async (_, hosts) => {
    if (!hosts || hosts.length === 0) return {};
    const enriched = await enrichHosts(hosts);
    return Object.fromEntries(enriched);
  });
  electron.ipcMain.handle("discovery:oui-lookup", async (_, mac) => {
    return quickOuiEnrich(mac);
  });
  electron.ipcMain.handle("discovery:mdns-scan", async () => {
    const devices = await runMdnsScan(1e4);
    return Object.fromEntries(devices);
  });
  electron.ipcMain.handle("discovery:identify-host", async (_, ip, mac) => {
    const [ouiDb, mdnsDevices] = await Promise.all([loadOui(), runMdnsScan(5e3)]);
    const manufacturer = ouiLookup(mac, ouiDb);
    const mdns = mdnsDevices.get(ip);
    let nmapOs = "";
    let nmapHostname = "";
    const hasNmap = await commandExists("nmap");
    if (hasNmap) {
      const { stdout } = await runCommand("nmap", ["-O", "--osscan-guess", "-T4", ip], true);
      const osMatch = stdout.match(/OS details:\s+(.+)/) || stdout.match(/Aggressive OS guesses:\s+(.+)/);
      if (osMatch) nmapOs = osMatch[1].split(",")[0].trim();
      const hnMatch = stdout.match(/Nmap scan report for (\S+) \(/);
      if (hnMatch) nmapHostname = hnMatch[1];
    }
    return {
      ip,
      mac,
      manufacturer,
      deviceName: mdns?.name || mdns?.hostname || nmapHostname || "",
      hostname: mdns?.hostname || nmapHostname || "",
      modelId: mdns?.modelId || "",
      modelName: mdns?.modelId ? appleModelName(mdns.modelId) : "",
      os: mdns?.os || nmapOs || "",
      deviceType: mdns?.deviceType || "unknown",
      services: mdns?.services || [],
      source: [
        manufacturer ? "oui" : "",
        mdns ? "mdns" : "",
        nmapOs ? "nmap-os" : ""
      ].filter(Boolean)
    };
  });
  electron.ipcMain.handle("discovery:preload", async () => {
    await loadOui();
    return true;
  });
}
async function getSubnet(iface) {
  const { stdout } = await runCommand("ip", ["-o", "addr", "show", iface]);
  const m = stdout.match(/inet\s+(\d+\.\d+\.\d+)\.\d+\/(\d+)/);
  if (!m) return null;
  const [, prefix, cidr] = m;
  return `${prefix}.0/${cidr}`;
}
function parseArpScanOutput(output) {
  const hosts = [];
  const lines = output.split("\n");
  for (const line of lines) {
    const m = line.match(/^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F:]{17})\s+(.*)$/);
    if (!m) continue;
    const [, ip, mac, vendor] = m;
    hosts.push({ ip, mac, vendor: vendor.trim(), hostname: "", status: "online" });
  }
  return hosts;
}
function parseNmapPingOutput(output) {
  const hosts = [];
  const blocks = output.split("Nmap scan report for ").slice(1);
  for (const block of blocks) {
    const firstLine = block.split("\n")[0];
    const ipMatch = firstLine.match(/\((\d+\.\d+\.\d+\.\d+)\)/);
    const hostname = ipMatch ? firstLine.split(" ")[0] : "";
    const ip = ipMatch ? ipMatch[1] : firstLine.trim();
    const macMatch = block.match(/MAC Address:\s+([0-9A-F:]+)\s+\(([^)]+)\)/);
    const mac = macMatch ? macMatch[1] : "";
    const vendor = macMatch ? macMatch[2] : "";
    const latencyMatch = block.match(/(\d+\.?\d*)\s*ms/);
    const latency = latencyMatch ? `${latencyMatch[1]}ms` : void 0;
    const status = block.includes("Host is up") ? "online" : "unknown";
    hosts.push({ ip, mac, hostname, vendor, status, latency });
  }
  return hosts;
}
function parseNmapPortOutput(output) {
  const ports = [];
  const lines = output.split("\n");
  for (const line of lines) {
    const m = line.match(/^(\d+)\/(tcp|udp)\s+(\S+)\s+(\S+)\s*(.*)$/);
    if (!m) continue;
    const [, port, protocol, state, service, version] = m;
    ports.push({ port: parseInt(port), protocol, state, service, version: version.trim() });
  }
  return ports;
}
let stopTrace = null;
let stopPing = null;
function registerDiagnosticsIPC(win) {
  electron.ipcMain.handle("diag:dns-test", async (_, domain = "example.com") => {
    const hasDig = await commandExists("dig");
    const hasNslookup = await commandExists("nslookup");
    const tool = hasDig ? "dig" : hasNslookup ? "nslookup" : null;
    if (!tool) {
      return { error: "No DNS tool available (install dnsutils)", results: [] };
    }
    const resolvers = await getConfiguredDNS();
    const results = [];
    for (const server of resolvers) {
      const start = Date.now();
      let resolved = false;
      let ip = "";
      let error;
      try {
        if (tool === "dig") {
          const { stdout, code } = await runCommand("dig", [`@${server}`, domain, "+short", "+time=3"]);
          resolved = code === 0 && stdout.trim().length > 0;
          ip = stdout.split("\n").find((l) => /^\d+\./.test(l)) || stdout.trim();
          if (!resolved) error = "No response";
        } else {
          const { stdout, code } = await runCommand("nslookup", [domain, server]);
          resolved = code === 0 && stdout.includes("Address");
          const m = stdout.match(/Address:\s+(\d+\.\d+\.\d+\.\d+)/);
          ip = m ? m[1] : "";
          if (!resolved) error = "No response";
        }
      } catch (e) {
        error = e.message;
      }
      const responseTime = `${Date.now() - start}ms`;
      results.push({ server, domain, resolved, ip, responseTime, error });
    }
    const content = results.map((r) => `${r.server}: ${r.resolved ? `OK (${r.ip}) ${r.responseTime}` : `FAIL — ${r.error}`}`).join("\n");
    await saveReport("dns", `DNS Test for ${domain}

${content}`);
    return { results, tool };
  });
  electron.ipcMain.handle("diag:resolv-conf", async () => {
    const { stdout } = await runCommand("cat", ["/etc/resolv.conf"]);
    return stdout;
  });
  electron.ipcMain.handle("diag:trace", async (_, target = "8.8.8.8") => {
    if (stopTrace) {
      stopTrace();
      stopTrace = null;
    }
    const hasMtr = await commandExists("mtr");
    const hasTraceroute = await commandExists("traceroute");
    const hasTracepath = await commandExists("tracepath");
    if (hasMtr) {
      const { stdout, code } = await runCommand("mtr", ["--report", "--report-cycles", "3", "--no-dns", target]);
      if (code === 0) {
        const path2 = await saveReport("trace", `Traceroute to ${target}

${stdout}`);
        return { raw: stdout, hops: parseMtrOutput(stdout), tool: "mtr", path: path2 };
      }
    }
    if (hasTraceroute) {
      const { stdout } = await runCommand("traceroute", ["-n", "-q", "1", "-w", "2", target]);
      const path2 = await saveReport("trace", `Traceroute to ${target}

${stdout}`);
      return { raw: stdout, hops: parseTracerouteOutput(stdout), tool: "traceroute", path: path2 };
    }
    if (hasTracepath) {
      const { stdout } = await runCommand("tracepath", ["-n", target]);
      const path2 = await saveReport("trace", `Traceroute to ${target}

${stdout}`);
      return { raw: stdout, hops: parseTracepathOutput(stdout), tool: "tracepath", path: path2 };
    }
    return { error: "No trace tool available (install mtr or traceroute)", hops: [] };
  });
  electron.ipcMain.handle("diag:trace-stream", async (_, target = "8.8.8.8") => {
    if (stopTrace) {
      stopTrace();
      stopTrace = null;
    }
    const hasMtr = await commandExists("mtr");
    const hasTraceroute = await commandExists("traceroute");
    if (hasMtr) {
      stopTrace = await streamCommand(win, "mtr", ["--report", "--report-cycles", "5", target], {
        channel: "diag:trace-stream",
        timeout: 6e4
      });
    } else if (hasTraceroute) {
      stopTrace = await streamCommand(win, "traceroute", ["-q", "1", "-w", "2", target], {
        channel: "diag:trace-stream",
        timeout: 6e4
      });
    } else {
      win.webContents.send("diag:trace-stream", { error: "No trace tool", done: true });
    }
  });
  electron.ipcMain.handle("diag:trace-stop", () => {
    if (stopTrace) {
      stopTrace();
      stopTrace = null;
      return true;
    }
    return false;
  });
  electron.ipcMain.handle("diag:ping", async (_, target = "8.8.8.8", count = 4) => {
    const { stdout, code } = await runCommand("ping", ["-c", String(count), "-W", "2", target]);
    if (code !== 0 && !stdout) {
      return { error: "Ping failed", target };
    }
    const result = parsePingOutput(stdout, target);
    const path2 = await saveReport("ping", `Ping to ${target}

${stdout}`);
    return { ...result, path: path2 };
  });
  electron.ipcMain.handle("diag:ping-stream", async (_, target = "8.8.8.8", count = 10) => {
    if (stopPing) {
      stopPing();
      stopPing = null;
    }
    stopPing = await streamCommand(win, "ping", ["-c", String(count), "-i", "0.5", target], {
      channel: "diag:ping-stream",
      timeout: 3e4
    });
  });
  electron.ipcMain.handle("diag:ping-stop", () => {
    if (stopPing) {
      stopPing();
      stopPing = null;
      return true;
    }
    return false;
  });
  electron.ipcMain.handle("diag:system-info", async () => {
    const [hostname, kernel, arch, cpuInfo] = await Promise.all([
      simpleExec("hostname"),
      simpleExec("uname -r"),
      simpleExec("uname -m"),
      simpleExec("cat /proc/cpuinfo | grep 'model name' | head -1 | cut -d: -f2")
    ]);
    return { hostname, kernel, arch, cpu: cpuInfo.trim() };
  });
}
async function getConfiguredDNS() {
  const { stdout } = await runCommand("cat", ["/etc/resolv.conf"]);
  const servers = stdout.split("\n").filter((l) => l.startsWith("nameserver")).map((l) => l.split(/\s+/)[1]).filter(Boolean);
  return servers.length > 0 ? servers.slice(0, 3) : ["8.8.8.8", "1.1.1.1", "9.9.9.9"];
}
function parseMtrOutput(output) {
  const hops = [];
  const lines = output.split("\n").slice(2);
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\.\|--\s+(\S+)\s+[\d.]+%\s+\d+\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (!m) continue;
    const [, hop, host, rtt1, rtt2, rtt3] = m;
    const ipMatch = host.match(/\((\d+\.\d+\.\d+\.\d+)\)/);
    hops.push({
      hop: parseInt(hop),
      host: ipMatch ? host.replace(/\(.*?\)/, "").trim() : host,
      ip: ipMatch ? ipMatch[1] : host,
      rtt1: `${rtt1}ms`,
      rtt2: `${rtt2}ms`,
      rtt3: `${rtt3}ms`
    });
  }
  return hops;
}
function parseTracerouteOutput(output) {
  const hops = [];
  const lines = output.split("\n").slice(1);
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s+(\S+)\s+(?:\((\S+)\)\s+)?(.+)$/);
    if (!m) continue;
    const [, hop, host, ip, rtts] = m;
    const rttValues = rtts.match(/([\d.]+)\s+ms/g) || [];
    hops.push({
      hop: parseInt(hop),
      host: ip ? host : host,
      ip: ip || host,
      rtt1: rttValues[0] || "* ms",
      rtt2: rttValues[1] || "* ms",
      rtt3: rttValues[2] || "* ms"
    });
  }
  return hops;
}
function parseTracepathOutput(output) {
  const hops = [];
  const lines = output.split("\n");
  for (const line of lines) {
    const m = line.match(/^\s*(\d+):\s+(\S+)\s+(?:\((\S+)\)\s+)?([\d.]+)ms/);
    if (!m) continue;
    const [, hop, host, ip, rtt] = m;
    hops.push({
      hop: parseInt(hop),
      host: ip ? host : host,
      ip: ip || host,
      rtt1: `${rtt}ms`,
      rtt2: "",
      rtt3: ""
    });
  }
  return hops;
}
function parsePingOutput(output, target) {
  const stats = output.match(/(\d+) packets transmitted,\s*(\d+) (?:packets )?received(?:,\s*([\d.]+)% packet loss)?/);
  const rtt = output.match(/rtt\s+min\/avg\/max\/mdev\s*=\s*([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+)/);
  return {
    target,
    transmitted: stats ? parseInt(stats[1]) : 0,
    received: stats ? parseInt(stats[2]) : 0,
    loss: stats && stats[3] ? parseFloat(stats[3]) : 100,
    minRtt: rtt ? `${rtt[1]}ms` : "N/A",
    avgRtt: rtt ? `${rtt[2]}ms` : "N/A",
    maxRtt: rtt ? `${rtt[3]}ms` : "N/A",
    jitter: rtt ? `${rtt[4]}ms` : "N/A",
    raw: output
  };
}
function registerPortsIPC(win) {
  electron.ipcMain.handle("ports:list", async (_, filter) => {
    const hasSS = await commandExists("ss");
    const hasNetstat = await commandExists("netstat");
    let stdout = "";
    let tool = "";
    if (hasSS) {
      tool = "ss";
      const args = ["-tulnp"];
      if (filter === "tcp") args.push("-t");
      else if (filter === "udp") args.push("-u");
      const result = await runCommand("ss", args);
      stdout = result.stdout;
    } else if (hasNetstat) {
      tool = "netstat";
      const { stdout: out } = await runCommand("netstat", ["-tulnp"]);
      stdout = out;
    } else {
      return { error: "No port tool (install iproute2 or net-tools)", ports: [], tool: "none" };
    }
    const ports = tool === "ss" ? parseSSOutput(stdout) : parseNetstatOutput(stdout);
    const path2 = await saveReport("ports", `Open Ports (${tool})

${stdout}`);
    return { ports, tool, path: path2, raw: stdout };
  });
  electron.ipcMain.handle("ports:connections", async () => {
    const hasSS = await commandExists("ss");
    if (!hasSS) {
      return { error: "ss not available", connections: [] };
    }
    const { stdout } = await runCommand("ss", ["-tunp", "state", "established"]);
    const connections = parseSSConnections(stdout);
    return { connections, raw: stdout };
  });
  electron.ipcMain.handle("ports:scan-host", async (_, ip, portRange = "1-1000") => {
    const hasNmap = await commandExists("nmap");
    if (!hasNmap) {
      return { error: "nmap not installed", ports: [] };
    }
    const { stdout, code } = await runCommand("nmap", ["-sV", "-T4", "--open", "-p", portRange, ip], true);
    const ports = parseNmapOutput(stdout);
    const path2 = await saveReport("port_scan", `Port Scan of ${ip}:${portRange}

${stdout}`);
    return { ports, raw: stdout, path: path2, success: code === 0 };
  });
  electron.ipcMain.handle("ports:process-info", async (_, port) => {
    const hasSS = await commandExists("ss");
    if (!hasSS) return { error: "ss not available" };
    const { stdout } = await runCommand("ss", ["-tulnp", `sport = :${port}`]);
    return { raw: stdout };
  });
}
function parseSSOutput(output) {
  const ports = [];
  const lines = output.split("\n").slice(1);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const [protocol, , , localFull, , , process2] = parts;
    const [localAddr, localPort] = splitAddrPort(localFull);
    const pidMatch = process2?.match(/pid=(\d+)/);
    const progMatch = process2?.match(/users:\(\("([^"]+)"/);
    ports.push({
      protocol: protocol.replace("UNCONN", "UDP"),
      localAddr,
      localPort: parseInt(localPort) || 0,
      remoteAddr: "0.0.0.0",
      remotePort: 0,
      state: "LISTEN",
      pid: pidMatch ? pidMatch[1] : "",
      program: progMatch ? progMatch[1] : ""
    });
  }
  return ports.filter((p) => p.localPort > 0);
}
function parseSSConnections(output) {
  const ports = [];
  const lines = output.split("\n").slice(1);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const [protocol, , , localFull, remoteFull, , process2] = parts;
    const [localAddr, localPort] = splitAddrPort(localFull);
    const [remoteAddr, remotePort] = splitAddrPort(remoteFull);
    const pidMatch = process2?.match(/pid=(\d+)/);
    const progMatch = process2?.match(/users:\(\("([^"]+)"/);
    ports.push({
      protocol,
      localAddr,
      localPort: parseInt(localPort) || 0,
      remoteAddr,
      remotePort: parseInt(remotePort) || 0,
      state: "ESTABLISHED",
      pid: pidMatch ? pidMatch[1] : "",
      program: progMatch ? progMatch[1] : ""
    });
  }
  return ports;
}
function parseNetstatOutput(output) {
  const ports = [];
  const lines = output.split("\n").slice(2);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 6) continue;
    const [protocol, , , localFull, remoteFull, state, pid_prog] = parts;
    const [localAddr, localPort] = splitAddrPort(localFull);
    const [remoteAddr, remotePort] = splitAddrPort(remoteFull);
    const pidParts = pid_prog?.split("/") || [];
    ports.push({
      protocol,
      localAddr,
      localPort: parseInt(localPort) || 0,
      remoteAddr,
      remotePort: parseInt(remotePort) || 0,
      state: state || "LISTEN",
      pid: pidParts[0] || "",
      program: pidParts[1] || ""
    });
  }
  return ports.filter((p) => p.localPort > 0);
}
function parseNmapOutput(output) {
  const ports = [];
  for (const line of output.split("\n")) {
    const m = line.match(/^(\d+)\/(tcp|udp)\s+(\S+)\s+(\S+)\s*(.*)$/);
    if (!m) continue;
    const [, port, protocol, state, service, version] = m;
    ports.push({ port: parseInt(port), protocol, state, service, version: version.trim() });
  }
  return ports;
}
function splitAddrPort(addrPort) {
  const lastColon = addrPort.lastIndexOf(":");
  if (lastColon === -1) return [addrPort, "0"];
  return [addrPort.slice(0, lastColon) || "0.0.0.0", addrPort.slice(lastColon + 1)];
}
let stopSpeed = null;
function registerSpeedIPC(win) {
  electron.ipcMain.handle("speed:check-tools", async () => {
    const [hasSpeedtest, hasIperf3, hasCurl] = await Promise.all([
      commandExists("speedtest-cli"),
      commandExists("iperf3"),
      commandExists("curl")
    ]);
    return { speedtest: hasSpeedtest, iperf3: hasIperf3, curl: hasCurl };
  });
  electron.ipcMain.handle("speed:run", async () => {
    const hasSpeedtest = await commandExists("speedtest-cli");
    if (hasSpeedtest) {
      const { stdout, code } = await runCommand("speedtest-cli", ["--simple"]);
      if (code === 0) {
        const result = parseSpeedtestSimple(stdout);
        const path2 = await saveReport("speed", `Speed Test (speedtest-cli)

${stdout}`);
        return { ...result, path: path2 };
      }
    }
    const hasCurl = await commandExists("curl");
    if (hasCurl) {
      const result = await curlSpeedTest();
      const path2 = await saveReport("speed", `Speed Test (curl)
Download: ${result.download.toFixed(1)} Mbps`);
      return { ...result, path: path2 };
    }
    return { error: "No speed test tool available. Install speedtest-cli.", tool: "none" };
  });
  electron.ipcMain.handle("speed:stream", async () => {
    if (stopSpeed) {
      stopSpeed();
      stopSpeed = null;
    }
    const hasSpeedtest = await commandExists("speedtest-cli");
    if (!hasSpeedtest) {
      win.webContents.send("speed:stream", { error: "speedtest-cli not installed", done: true });
      return;
    }
    stopSpeed = await streamCommand(win, "speedtest-cli", [], {
      channel: "speed:stream",
      timeout: 12e4
    });
  });
  electron.ipcMain.handle("speed:stop", () => {
    if (stopSpeed) {
      stopSpeed();
      stopSpeed = null;
      return true;
    }
    return false;
  });
  electron.ipcMain.handle("speed:run-full", async () => {
    const hasSpeedtest = await commandExists("speedtest-cli");
    if (!hasSpeedtest) return { error: "speedtest-cli not installed" };
    const { stdout, code } = await runCommand("speedtest-cli", ["--json"]);
    if (code !== 0) return { error: "speedtest-cli failed" };
    try {
      const data = JSON.parse(stdout);
      const result = {
        download: data.download / 1e6,
        upload: data.upload / 1e6,
        ping: data.ping,
        server: data.server?.name,
        isp: data.client?.isp,
        tool: "speedtest-cli"
      };
      const path2 = await saveReport("speed", `Speed Test (speedtest-cli JSON)

${stdout}`);
      return { ...result, path: path2 };
    } catch {
      const result = parseSpeedtestSimple(stdout);
      return result;
    }
  });
}
function parseSpeedtestSimple(output) {
  const ping = output.match(/Ping:\s+([\d.]+)\s+ms/);
  const down = output.match(/Download:\s+([\d.]+)\s+Mbit\/s/);
  const up = output.match(/Upload:\s+([\d.]+)\s+Mbit\/s/);
  return {
    download: down ? parseFloat(down[1]) : 0,
    upload: up ? parseFloat(up[1]) : 0,
    ping: ping ? parseFloat(ping[1]) : 0,
    tool: "speedtest-cli"
  };
}
async function curlSpeedTest() {
  const urls = [
    "https://speed.cloudflare.com/__down?bytes=25000000",
    "http://ipv4.download.thinkbroadband.com/25MB.zip"
  ];
  for (const url of urls) {
    const { stdout, code } = await runCommand("curl", [
      "-o",
      "/dev/null",
      "-s",
      "-w",
      "%{speed_download}",
      "--max-time",
      "30",
      url
    ]);
    if (code === 0 && stdout.trim()) {
      const bytesPerSec = parseFloat(stdout.trim());
      const mbps = bytesPerSec * 8 / 1e6;
      return { download: mbps, upload: 0, ping: 0, tool: "curl" };
    }
  }
  return { download: 0, upload: 0, ping: 0, tool: "curl" };
}
const TOOLS = [
  {
    name: "iproute2 (ip)",
    command: "ip",
    apt: "iproute2",
    dnf: "iproute",
    pacman: "iproute2",
    zypper: "iproute2",
    description: "Network interface and routing information",
    required: true
  },
  {
    name: "ping",
    command: "ping",
    apt: "iputils-ping",
    dnf: "iputils",
    pacman: "iputils",
    zypper: "iputils",
    description: "ICMP ping test",
    required: true
  },
  {
    name: "nmap",
    command: "nmap",
    apt: "nmap",
    dnf: "nmap",
    pacman: "nmap",
    zypper: "nmap",
    description: "Advanced network scanner",
    required: false
  },
  {
    name: "arp-scan",
    command: "arp-scan",
    apt: "arp-scan",
    dnf: "arp-scan",
    pacman: "arp-scan",
    zypper: "arp-scan",
    description: "Fast ARP device discovery",
    required: false
  },
  {
    name: "dig",
    command: "dig",
    apt: "dnsutils",
    dnf: "bind-utils",
    pacman: "bind",
    zypper: "bind-utils",
    description: "DNS resolution tool",
    required: false
  },
  {
    name: "nslookup",
    command: "nslookup",
    apt: "dnsutils",
    dnf: "bind-utils",
    pacman: "bind",
    zypper: "bind-utils",
    description: "DNS lookup tool",
    required: false
  },
  {
    name: "mtr",
    command: "mtr",
    apt: "mtr",
    dnf: "mtr",
    pacman: "mtr",
    zypper: "mtr",
    description: "Network route tracer (mtr)",
    required: false
  },
  {
    name: "traceroute",
    command: "traceroute",
    apt: "traceroute",
    dnf: "traceroute",
    pacman: "traceroute",
    zypper: "traceroute",
    description: "Route tracing tool",
    required: false
  },
  {
    name: "ss",
    command: "ss",
    apt: "iproute2",
    dnf: "iproute",
    pacman: "iproute2",
    zypper: "iproute2",
    description: "Socket statistics",
    required: false
  },
  {
    name: "speedtest-cli",
    command: "speedtest-cli",
    apt: "speedtest-cli",
    dnf: "speedtest-cli",
    pacman: "speedtest-cli",
    zypper: "speedtest-cli",
    description: "Internet speed test",
    required: false
  },
  {
    name: "iperf3",
    command: "iperf3",
    apt: "iperf3",
    dnf: "iperf3",
    pacman: "iperf3",
    zypper: "iperf3",
    description: "Network bandwidth measurement",
    required: false
  },
  {
    name: "curl",
    command: "curl",
    apt: "curl",
    dnf: "curl",
    pacman: "curl",
    zypper: "curl",
    description: "HTTP/HTTPS requests",
    required: false
  },
  {
    name: "netstat",
    command: "netstat",
    apt: "net-tools",
    dnf: "net-tools",
    pacman: "net-tools",
    zypper: "net-tools",
    description: "Network statistics (legacy)",
    required: false
  },
  {
    name: "sudo",
    command: "sudo",
    apt: "sudo",
    dnf: "sudo",
    pacman: "sudo",
    zypper: "sudo",
    description: "Privilege escalation (terminal)",
    required: false
  },
  {
    name: "pkexec (polkit)",
    command: "pkexec",
    apt: "pkexec",
    dnf: "polkit",
    pacman: "polkit",
    zypper: "polkit",
    description: "Polkit privilege escalation (GUI dialog for root operations)",
    required: false
  },
  {
    name: "avahi-utils",
    command: "avahi-browse",
    apt: "avahi-utils",
    dnf: "avahi-tools",
    pacman: "avahi",
    zypper: "avahi",
    description: "mDNS/Bonjour device discovery (real device names & models)",
    required: false
  }
];
let _detectedPM = null;
async function detectPackageManager() {
  if (_detectedPM) return _detectedPM;
  const checks = [
    ["apt-get", "apt"],
    ["dnf", "dnf"],
    ["pacman", "pacman"],
    ["zypper", "zypper"]
  ];
  for (const [cmd, pm] of checks) {
    if (await commandExists(cmd)) {
      _detectedPM = pm;
      return pm;
    }
  }
  _detectedPM = "unknown";
  return "unknown";
}
async function checkAllTools() {
  const pm = await detectPackageManager();
  const results = [];
  for (const tool of TOOLS) {
    const installed = await commandExists(tool.command);
    const pkg = pm !== "unknown" ? tool[pm] : void 0;
    let installCmd;
    if (!installed && pkg) {
      switch (pm) {
        case "apt":
          installCmd = `sudo apt-get install -y ${pkg}`;
          break;
        case "dnf":
          installCmd = `sudo dnf install -y ${pkg}`;
          break;
        case "pacman":
          installCmd = `sudo pacman -S --noconfirm ${pkg}`;
          break;
        case "zypper":
          installCmd = `sudo zypper install -y ${pkg}`;
          break;
      }
    }
    results.push({ tool, installed, installCmd });
  }
  return results;
}
async function installTool(toolCommand) {
  const pm = await detectPackageManager();
  const tool = TOOLS.find((t) => t.command === toolCommand);
  if (!tool) return { success: false, output: "Unknown tool" };
  if (pm === "unknown") return { success: false, output: "No supported package manager found" };
  const pkg = tool[pm];
  if (!pkg) return { success: false, output: "No package available for this distro" };
  let cmd;
  let args;
  switch (pm) {
    case "apt":
      cmd = "apt-get";
      args = ["install", "-y", pkg];
      break;
    case "dnf":
      cmd = "dnf";
      args = ["install", "-y", pkg];
      break;
    case "pacman":
      cmd = "pacman";
      args = ["-S", "--noconfirm", pkg];
      break;
    case "zypper":
      cmd = "zypper";
      args = ["install", "-y", pkg];
      break;
    default:
      return { success: false, output: "Unknown package manager" };
  }
  const { stdout, stderr, code, needsElevation } = await runCommand(cmd, args, true);
  if (needsElevation) {
    return {
      success: false,
      output: "Elevation required. Install pkexec (polkit) for GUI privilege dialogs:\nsudo apt install polkitd pkexec"
    };
  }
  return { success: code === 0, output: stdout || stderr };
}
async function getDistroInfo() {
  const name = await simpleExec(`lsb_release -si 2>/dev/null || cat /etc/os-release | grep ^NAME= | cut -d= -f2 | tr -d '"'`);
  const version = await simpleExec(`lsb_release -sr 2>/dev/null || cat /etc/os-release | grep ^VERSION_ID= | cut -d= -f2 | tr -d '"'`);
  const pm = await detectPackageManager();
  return { name: name || "Linux", version: version || "", pm };
}
function registerSystemIPC(win) {
  electron.ipcMain.handle("system:check-deps", async () => {
    const [tools, distro] = await Promise.all([checkAllTools(), getDistroInfo()]);
    return { tools, distro };
  });
  electron.ipcMain.handle("system:install-tool", async (_, toolCommand) => {
    return installTool(toolCommand);
  });
  electron.ipcMain.handle("system:distro-info", async () => {
    return getDistroInfo();
  });
  electron.ipcMain.handle("system:reports-list", async () => {
    return listReports();
  });
  electron.ipcMain.handle("system:report-read", async (_, path2) => {
    return readReport(path2);
  });
  electron.ipcMain.handle("system:report-delete", async (_, path2) => {
    await deleteReport(path2);
    return true;
  });
  electron.ipcMain.handle("system:reports-dir", () => {
    return getReportsDir();
  });
  electron.ipcMain.handle("system:open-reports-dir", async () => {
    await ensureReportsDir();
    await electron.shell.openPath(getReportsDir());
  });
  electron.ipcMain.handle("system:app-version", () => {
    return electron.app.getVersion();
  });
  electron.ipcMain.handle("system:is-root", () => {
    return isRoot();
  });
  electron.ipcMain.handle("system:pm-info", async () => {
    const pm = await detectPackageManager();
    return { pm };
  });
  electron.ipcMain.handle("system:elevation-status", async () => {
    return getElevationStatus();
  });
  electron.ipcMain.handle("system:fix-reports-dir", async () => {
    try {
      await ensureReportsDir();
      return { success: true, path: getReportsDir() };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  electron.ipcMain.handle("system:errors-list", async () => {
    return listErrors();
  });
  electron.ipcMain.handle("system:log-error", async (_, title, detail) => {
    return saveError(title, detail);
  });
  electron.ipcMain.handle("system:open-external", async (_, url) => {
    if (!url.startsWith("https://")) return false;
    await electron.shell.openExternal(url);
    return true;
  });
}
electron.nativeTheme.themeSource = "dark";
let mainWindow = null;
function setupCSP() {
  electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            // needed for Vite dev HMR
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data:",
            "connect-src 'self' ws://localhost:* http://localhost:* https:"
            // Vite WS + network tools
          ].join("; ")
        ]
      }
    });
  });
}
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0D1117",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0D1117",
      symbolColor: "#E6EDF3",
      height: 36
    },
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    icon: path.join(__dirname, "../../resources/icon.png")
  });
  mainWindow.on("ready-to-show", () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  registerNetworkIPC();
  registerDiscoveryIPC(mainWindow);
  registerDiagnosticsIPC(mainWindow);
  registerPortsIPC();
  registerSpeedIPC(mainWindow);
  registerSystemIPC();
  electron.ipcMain.handle("window:minimize", () => mainWindow?.minimize());
  electron.ipcMain.handle("window:maximize", () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
    return mainWindow?.isMaximized();
  });
  electron.ipcMain.handle("window:close", () => mainWindow?.close());
  electron.ipcMain.handle("window:is-maximized", () => mainWindow?.isMaximized() ?? false);
  mainWindow.on("maximize", () => mainWindow?.webContents.send("window:maximized", true));
  mainWindow.on("unmaximize", () => mainWindow?.webContents.send("window:maximized", false));
}
electron.app.whenReady().then(async () => {
  electronApp.setAppUserModelId("org.gnutux.gt-ipnet");
  electron.app.on("browser-window-created", (_, win) => optimizer.watchWindowShortcuts(win));
  setupCSP();
  await ensureReportsDir().catch(
    (e) => console.warn("[GT-IpNet] Could not prepare reports directory:", e.message)
  );
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
