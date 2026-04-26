# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GT-IpNet — Electron + React + TypeScript network diagnostic tool for GNU/Linux. Developer: **GNUTUX**. License: GPLv2. GitHub: https://github.com/SalehGNUTUX/GT-IpNet

## Commands

```bash
npm run dev           # Development mode (hot reload)
npm run build         # Build all three processes (main + preload + renderer)
npm run typecheck     # TypeScript check without emit (tsc --noEmit)
npm run build:all     # Full Linux packaging: AppImage + DEB + RPM (bash scripts/build-all.sh)
npm run build:appimage
npm run build:deb
npm run build:rpm
```

Build output goes to `out/` (not `dist/`). Packaged releases go to `release/`.

## Architecture

This is a **three-process Electron app** with strict context isolation:

```
src/main/       — Node.js main process (runs shell tools, manages files)
src/preload/    — Bridge (exposes typed window.api to renderer)
src/renderer/   — React UI (zero Node access, all data via window.api)
```

### IPC flow

Every feature follows this exact path:
1. **Renderer** calls `window.api.<namespace>.<method>(args)`
2. **Preload** (`src/preload/index.ts`) maps each call to `ipcRenderer.invoke('namespace:method', args)`
3. **Main IPC handler** (`src/main/ipc/<feature>.ts`) runs the actual shell command and returns data
4. **Streaming** uses `ipcRenderer.on('channel', cb)` + `win.webContents.send('channel', data)`

When adding a new IPC call, update all three: the handler in `src/main/ipc/`, the bridge in `src/preload/index.ts`, and the renderer call site.

### Privilege escalation (`src/main/utils/exec.ts`)

`runCommand(cmd, args, sudo=false)` and `streamCommand(win, cmd, args, opts)` implement a 3-tier elevation strategy:
1. Already root → run directly
2. `sudo -n` available (passwordless) → prefix with `sudo -n`
3. pkexec available → prefix with `pkexec env DISPLAY=... <cmd>`

`streamCommand` is **async** and returns `Promise<() => void>` (the stop function). Always `await` it.

### Device discovery (`src/main/utils/deviceInfo.ts`)

Identification pipeline for each discovered host:
- **OUI lookup**: reads `/usr/share/nmap/nmap-mac-prefixes` or `/usr/share/arp-scan/ieee-oui.txt` (cached after first load)
- **mDNS**: `avahi-browse -a -t -r -p` (falls back to nmap mdns-sd). Results cached 60 s.
- **Apple model DB**: 100+ `iPhone/iPad/Mac/...` model identifiers → human names (embedded in `APPLE_MODELS`)
- **nmap OS detection**: used only on explicit "deep identify" requests

In the renderer (`Discovery.tsx`), quick scan (arp-scan) parses single-line output; full scan (nmap -sn) parses **multi-line** output via `nmapPendingRef` that accumulates state across `Nmap scan report / Host is up / MAC Address` lines before emitting a host.

### State management

Zustand store (`src/renderer/store/appStore.ts`) with localStorage persistence. Persisted keys: `lang`, `activeInterface`, `onboardingDone`, `lastSpeedResult`. Non-persisted: `page`, `isScanning`, `notifications`.

### i18n

All strings live in `src/renderer/hooks/useI18n.ts` — a single `translations` object with `ar` and `en` keys. No external library. RTL is toggled via `dir={isRtl ? 'rtl' : 'ltr'}` on the root element. Arabic locale uses `ar-MA` (Moroccan/Western Arabic numerals) for date formatting, not `ar-SA`.

### Styling

**Tailwind v4** is used for utility classes, but **arbitrary color values (e.g. `text-[#79C0FF]`) are unreliable at runtime** due to JIT. All color-dependent styles use inline styles instead. The color palette is defined in `src/renderer/components/ui/index.tsx` as the `C` object with `hex()` / `hexBg()` helpers.

### Reports

Saved to `~/GT-IpNet_Reports/` in the real user's home (respects `$SUDO_USER` when running under sudo). `saveReport()` returns `null` instead of throwing on permission errors. `ensureReportsDir()` auto-fixes root-owned directories via pkexec/sudo chown.

## Key files

| File | Purpose |
|------|---------|
| `src/main/index.ts` | Window creation, IPC registration, CSP setup |
| `src/main/utils/exec.ts` | Shell execution + privilege escalation |
| `src/main/utils/deviceInfo.ts` | OUI / mDNS / Apple model identification |
| `src/main/utils/deps.ts` | Package manager detection, tool install commands |
| `src/preload/index.ts` | Complete typed API surface exposed to renderer |
| `src/renderer/store/appStore.ts` | Global state + persistence |
| `src/renderer/hooks/useI18n.ts` | All Arabic/English translations |
| `src/renderer/components/ui/index.tsx` | Shared UI component library |

## Packaging

`scripts/build-all.sh` (modelled on GT-SALAT) builds AppImage → DEB → RPM. RPM on Debian/Ubuntu uses `alien -g` + `rpmbuild`. The script accepts `all|appimage|deb|rpm` as argument.

## Common pitfalls

- **`streamCommand` is async** — always `await` the call to get the stop function back.
- **Tailwind arbitrary colors break at runtime** — use inline styles with `hex()` from `ui/index.tsx`.
- **nmap streams multi-line** — do not parse nmap output line-by-line like arp-scan; use the `nmapPendingRef` pattern in `Discovery.tsx`.
- **Icon/image imports** — place assets in `src/renderer/assets/` and import them as ES modules; Vite bundles them correctly.
- **Reports directory** — may be root-owned if the app was ever run as root; `saveReport()` handles this gracefully.
