import React, { useState, useEffect } from 'react'
import { Card, SectionTitle, Btn, Badge, CopyBtn } from '../components/ui'
import { useI18n } from '../hooks/useI18n'
import { useAppStore } from '../store/appStore'

interface ReportEntry {
  name: string
  path: string
  size: number
  date: Date
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(date: Date, lang: string): string {
  return new Date(date).toLocaleString(lang === 'ar' ? 'ar-MA' : 'en-GB')
}

function getReportType(name: string): { label: string; variant: 'info' | 'success' | 'warning' | 'error' | 'muted' } {
  if (name.includes('network'))   return { label: 'Network',   variant: 'info' }
  if (name.includes('dns'))       return { label: 'DNS',       variant: 'info' }
  if (name.includes('speed'))     return { label: 'Speed',     variant: 'success' }
  if (name.includes('discovery')) return { label: 'Discovery', variant: 'warning' }
  if (name.includes('ping'))      return { label: 'Ping',      variant: 'success' }
  if (name.includes('trace'))     return { label: 'Trace',     variant: 'warning' }
  if (name.includes('port'))      return { label: 'Ports',     variant: 'muted' }
  return { label: 'Report', variant: 'muted' }
}

// ── Tab button ────────────────────────────────────────────────────────────────

function Tab({ label, count, active, onClick, danger }: {
  label: string; count: number; active: boolean; onClick: () => void; danger?: boolean
}) {
  const color = active ? (danger ? '#F85149' : '#F5B800') : '#6E7681'
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', background: 'none', border: 'none',
        borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
        color, fontWeight: active ? 700 : 400, fontSize: 13,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {label}
      {count > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 700,
          background: active ? (danger ? 'rgba(248,81,73,0.15)' : 'rgba(245,184,0,0.15)') : '#21262D',
          color, padding: '1px 6px', borderRadius: 10,
        }}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── Report list ───────────────────────────────────────────────────────────────

function ReportList({ reports, selected, onSelect, onDelete, lang, loading, emptyLabel }: {
  reports: ReportEntry[]
  selected: ReportEntry | null
  onSelect: (r: ReportEntry) => void
  onDelete: (r: ReportEntry) => void
  lang: string
  loading: boolean
  emptyLabel: string
}) {
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: '#6E7681', fontSize: 12 }}>
      {lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}
    </div>
  )
  if (reports.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', color: '#484F58', fontSize: 12 }}>
      {emptyLabel}
    </div>
  )

  return (
    <div style={{ overflowY: 'auto', maxHeight: '60vh' }}>
      {reports.map((r, i) => {
        const { label, variant } = getReportType(r.name)
        const isActive = selected?.path === r.path
        return (
          <div
            key={i}
            onClick={() => onSelect(r)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px',
              borderBottom: '1px solid #21262D',
              cursor: 'pointer',
              background: isActive ? 'rgba(245,184,0,0.04)' : 'transparent',
              borderInlineStart: isActive ? '2px solid #F5B800' : '2px solid transparent',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#1C2128' }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
          >
            <Badge variant={variant}>{label}</Badge>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#E6EDF3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                {r.name}
              </div>
              <div style={{ fontSize: 10, color: '#6E7681', marginTop: 2 }}>
                {formatDate(r.date, lang)}
              </div>
            </div>
            <span style={{ fontSize: 10, color: '#6E7681', flexShrink: 0 }}>{formatSize(r.size)}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(r) }}
              style={{ background: 'none', border: 'none', color: '#484F58', cursor: 'pointer', fontSize: 14, padding: '0 4px', flexShrink: 0 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#F85149')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#484F58')}
              title={lang === 'ar' ? 'حذف' : 'Delete'}
            >✕</button>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function Reports() {
  const { t, lang } = useI18n()
  const { addNotification } = useAppStore()

  const [tab, setTab] = useState<'reports' | 'errors'>('reports')
  const [reports, setReports] = useState<ReportEntry[]>([])
  const [errors, setErrors] = useState<ReportEntry[]>([])
  const [selected, setSelected] = useState<ReportEntry | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingErrors, setLoadingErrors] = useState(true)

  const loadAll = async () => {
    setLoading(true); setLoadingErrors(true)
    const [r, e] = await Promise.all([
      window.api.system.reportsList(),
      window.api.system.errorsList(),
    ])
    setReports(r)
    setErrors(e)
    setLoading(false)
    setLoadingErrors(false)
  }

  useEffect(() => { loadAll() }, [])

  const view = async (report: ReportEntry) => {
    setSelected(report)
    const text = await window.api.system.reportRead(report.path)
    setContent(text)
  }

  const remove = async (report: ReportEntry) => {
    await window.api.system.reportDelete(report.path)
    if (tab === 'reports') setReports((p) => p.filter((r) => r.path !== report.path))
    else setErrors((p) => p.filter((r) => r.path !== report.path))
    if (selected?.path === report.path) { setSelected(null); setContent('') }
    addNotification({ type: 'success', title: lang === 'ar' ? 'تم الحذف' : 'Deleted' })
  }

  const currentList = tab === 'reports' ? reports : errors

  return (
    <div className="flex flex-col gap-4 animate-fade">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#E6EDF3]">{t('reports')}</h1>
          <p className="text-xs text-[#6E7681] mt-0.5">
            ~/GT-IpNet_Reports/
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="ghost" onClick={() => window.api.system.openReportsDir()}>
            {t('openFolder')}
          </Btn>
          <Btn variant="secondary" onClick={loadAll} loading={loading || loadingErrors}>
            {t('refresh')}
          </Btn>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #21262D' }}>
        <Tab
          label={lang === 'ar' ? 'التقارير' : 'Reports'}
          count={reports.length}
          active={tab === 'reports'}
          onClick={() => setTab('reports')}
        />
        <Tab
          label={lang === 'ar' ? 'سجلات الأخطاء' : 'Error Logs'}
          count={errors.length}
          active={tab === 'errors'}
          onClick={() => setTab('errors')}
          danger
        />
      </div>

      {/* Error tab hint */}
      {tab === 'errors' && errors.length > 0 && (
        <div style={{
          background: 'rgba(248,81,73,0.06)', border: '1px solid rgba(248,81,73,0.2)',
          borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#8B949E'
        }}>
          {lang === 'ar'
            ? 'هذه السجلات تساعدك على تشخيص الأخطاء. يمكنك مشاركتها مع المطور لحل المشاكل.'
            : 'These logs help diagnose issues. Share them with the developer to resolve problems.'}
          {' '}
          <button
            onClick={() => window.api.system.openExternal('https://github.com/SalehGNUTUX/GT-IpNet/issues')}
            style={{ background: 'none', border: 'none', color: '#79C0FF', cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }}
          >
            {lang === 'ar' ? 'فتح صفحة المشاكل' : 'Open issues page'}
          </button>
        </div>
      )}

      {/* Content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, minHeight: 0 }}>

        {/* List */}
        <Card padding={false}>
          <div style={{ padding: '12px 16px 6px' }}>
            <SectionTitle>
              {tab === 'reports'
                ? (lang === 'ar' ? 'قائمة التقارير' : 'Reports List')
                : (lang === 'ar' ? 'سجلات الأخطاء' : 'Error Logs')}
            </SectionTitle>
          </div>
          <ReportList
            reports={currentList}
            selected={selected}
            onSelect={view}
            onDelete={remove}
            lang={lang}
            loading={tab === 'reports' ? loading : loadingErrors}
            emptyLabel={tab === 'reports'
              ? (lang === 'ar' ? 'لا توجد تقارير' : 'No reports yet')
              : (lang === 'ar' ? 'لا توجد أخطاء' : 'No error logs')}
          />
        </Card>

        {/* Viewer */}
        <Card padding={false}>
          <div style={{ padding: '12px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SectionTitle>
              {selected ? selected.name : (lang === 'ar' ? 'عرض التقرير' : 'View Report')}
            </SectionTitle>
            {content && <CopyBtn text={content} label={t('copy')} />}
          </div>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#484F58', fontSize: 12 }}>
              {lang === 'ar' ? 'اختر تقريراً للعرض' : 'Select a report to view'}
            </div>
          ) : (
            <pre style={{
              overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11,
              color: tab === 'errors' ? '#FF9492' : '#E6EDF3',
              lineHeight: 1.6, padding: '0 16px 16px', maxHeight: '60vh', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {content}
            </pre>
          )}
        </Card>
      </div>
    </div>
  )
}
