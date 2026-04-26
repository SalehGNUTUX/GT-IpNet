import { ipcMain, BrowserWindow, shell, app } from 'electron'
import { checkAllTools, installTool, getDistroInfo, detectPackageManager } from '../utils/deps'
import { listReports, readReport, deleteReport, getReportsDir, ensureReportsDir, saveError, listErrors } from '../utils/report'
import { getElevationStatus, isRoot } from '../utils/exec'

export function registerSystemIPC(win: BrowserWindow): void {
  ipcMain.handle('system:check-deps', async () => {
    const [tools, distro] = await Promise.all([checkAllTools(), getDistroInfo()])
    return { tools, distro }
  })

  ipcMain.handle('system:install-tool', async (_, toolCommand: string) => {
    return installTool(toolCommand)
  })

  ipcMain.handle('system:distro-info', async () => {
    return getDistroInfo()
  })

  ipcMain.handle('system:reports-list', async () => {
    return listReports()
  })

  ipcMain.handle('system:report-read', async (_, path: string) => {
    return readReport(path)
  })

  ipcMain.handle('system:report-delete', async (_, path: string) => {
    await deleteReport(path)
    return true
  })

  ipcMain.handle('system:reports-dir', () => {
    return getReportsDir()
  })

  ipcMain.handle('system:open-reports-dir', async () => {
    await ensureReportsDir()
    await shell.openPath(getReportsDir())
  })

  ipcMain.handle('system:app-version', () => {
    return app.getVersion()
  })

  ipcMain.handle('system:is-root', () => {
    return isRoot()
  })

  ipcMain.handle('system:pm-info', async () => {
    const pm = await detectPackageManager()
    return { pm }
  })

  ipcMain.handle('system:elevation-status', async () => {
    return getElevationStatus()
  })

  ipcMain.handle('system:fix-reports-dir', async () => {
    try {
      await ensureReportsDir()
      return { success: true, path: getReportsDir() }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  // ── Error logs ──────────────────────────────────────────────────────────────

  ipcMain.handle('system:errors-list', async () => {
    return listErrors()
  })

  ipcMain.handle('system:log-error', async (_, title: string, detail: string) => {
    return saveError(title, detail)
  })

  // ── External links ──────────────────────────────────────────────────────────

  ipcMain.handle('system:open-external', async (_, url: string) => {
    // Only allow https:// URLs
    if (!url.startsWith('https://')) return false
    await shell.openExternal(url)
    return true
  })
}
