import React, { useState, useEffect } from 'react'
import { Card, SectionTitle, Badge, Btn, Spinner } from '../components/ui'
import { useI18n } from '../hooks/useI18n'
import { useAppStore } from '../store/appStore'

export function Settings() {
  const { t, lang } = useI18n()
  const { setLang, addNotification } = useAppStore()
  const [deps, setDeps] = useState<any[]>([])
  const [distro, setDistro] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState<string | null>(null)
  const [version, setVersion] = useState('')
  const [isRoot, setIsRoot] = useState(false)

  const loadDeps = async () => {
    setLoading(true)
    try {
      const [depsData, versionData, rootData] = await Promise.all([
        window.api.system.checkDeps(),
        window.api.system.appVersion(),
        window.api.system.isRoot()
      ])
      setDeps(depsData.tools || [])
      setDistro(depsData.distro)
      setVersion(versionData)
      setIsRoot(rootData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDeps() }, [])

  const install = async (toolCommand: string) => {
    setInstalling(toolCommand)
    try {
      const result = await window.api.system.installTool(toolCommand)
      if (result.success) {
        addNotification({ type: 'success', title: t('installed'), message: toolCommand })
        await loadDeps()
      } else {
        addNotification({ type: 'error', title: t('error'), message: result.output })
      }
    } finally {
      setInstalling(null)
    }
  }

  const required = deps.filter((d) => d.tool.required)
  const optional = deps.filter((d) => !d.tool.required)

  return (
    <div className="flex flex-col gap-6 animate-fade">
      <div>
        <h1 className="text-lg font-bold text-[#E6EDF3]">{t('settings')}</h1>
        <p className="text-xs text-[#6E7681] mt-0.5">GT-IpNet v{version} · GPLv2 · GNU/Linux</p>
      </div>

      {/* Language */}
      <Card>
        <SectionTitle>{t('language')}</SectionTitle>
        <div className="flex items-center gap-3">
          {(['ar', 'en'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-4 py-2 rounded text-sm transition-all border ${
                lang === l
                  ? 'bg-[#F5B800] text-[#0D1117] border-transparent font-bold'
                  : 'bg-[#21262D] text-[#6E7681] border-[#30363D] hover:text-[#E6EDF3]'
              }`}
            >
              {l === 'ar' ? `🇲🇦 ${t('arabic')}` : `🇺🇸 ${t('english')}`}
            </button>
          ))}
        </div>
      </Card>

      {/* System Info */}
      {distro && (
        <Card>
          <SectionTitle>{t('systemSection')}</SectionTitle>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <InfoRow label={t('distro')} value={distro.name} />
            <InfoRow label={t('version')} value={distro.version} />
            <InfoRow label={t('packageManager')} value={distro.pm.toUpperCase()} mono />
            <InfoRow label={t('author')} value="GNUTUX" />
            <InfoRow label={t('license')} value="GPLv2" />
            <InfoRow label={t('platformLabel')} value="GNU/Linux" />
            <InfoRow label={t('rootLabel')}
              value={isRoot ? t('yesRoot') : t('noRoot')}
              color={isRoot ? 'text-[#E3B341]' : 'text-[#3FB950]'}
            />
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #21262D' }}>
            <button
              onClick={() => window.api.system.openExternal('https://github.com/SalehGNUTUX/GT-IpNet')}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontSize: 11, color: '#79C0FF', cursor: 'pointer',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              🔗 github.com/SalehGNUTUX/GT-IpNet
            </button>
          </div>
        </Card>
      )}

      {/* Dependencies */}
      <Card padding={false}>
        <div className="px-4 pt-4 pb-2">
          <SectionTitle>{t('dependencies')}</SectionTitle>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size={24} />
          </div>
        ) : (
          <>
            <DepGroup
              title={t('required')}
              color="text-[#F85149]"
              deps={required}
              installing={installing}
              onInstall={install}
              t={t}
            />
            <DepGroup
              title={t('optional')}
              color="text-[#E3B341]"
              deps={optional}
              installing={installing}
              onInstall={install}
              t={t}
            />
          </>
        )}
        <div className="px-4 pb-4">
          <Btn variant="secondary" onClick={loadDeps} loading={loading}>{t('refresh')}</Btn>
        </div>
      </Card>
    </div>
  )
}

function DepGroup({ title, color, deps, installing, onInstall, t }: {
  title: string
  color: string
  deps: any[]
  installing: string | null
  onInstall: (cmd: string) => void
  t: (k: any) => string
}) {
  return (
    <div className="mb-2">
      <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wide ${color}`}>{title}</div>
      {deps.map((d, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-2.5 border-b border-[#21262D] hover:bg-[#1C2128] transition-colors"
        >
          <Badge variant={d.installed ? 'success' : 'error'}>
            {d.installed ? t('installed') : t('notInstalled')}
          </Badge>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[#E6EDF3]">{d.tool.name}</div>
            <div className="text-xs text-[#6E7681] truncate">{d.tool.description}</div>
          </div>
          {d.installCmd && (
            <div className="shrink-0 flex items-center gap-2">
              <span className="text-xs font-mono text-[#6E7681] hidden lg:block truncate max-w-[200px]">{d.installCmd}</span>
              {!d.installed && (
                <Btn
                  size="sm"
                  variant="secondary"
                  onClick={() => onInstall(d.tool.command)}
                  loading={installing === d.tool.command}
                >
                  {t('install')}
                </Btn>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function InfoRow({ label, value, mono, color }: {
  label: string
  value: string
  mono?: boolean
  color?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#6E7681] text-xs w-28 shrink-0">{label}</span>
      <span className={`text-xs ${mono ? 'font-mono text-[#79C0FF]' : color || 'text-[#E6EDF3]'}`}>
        {value}
      </span>
    </div>
  )
}
