import React, { useState, useEffect } from 'react'
import { useAppStore } from '../../store/appStore'
import { useI18n } from '../../hooks/useI18n'
import { Btn, Spinner } from '../ui'

// ── Slide definitions ────────────────────────────────────────────────────────

interface Slide {
  icon: string
  titleAr: string
  titleEn: string
  bodyAr: string
  bodyEn: string
}

const SLIDES: Slide[] = [
  {
    icon: '🌐',
    titleAr: 'مرحباً بك في GT-IpNet',
    titleEn: 'Welcome to GT-IpNet',
    bodyAr: 'أداة تشخيص وإدارة الشبكة المحلية لنظام GNU/Linux.\nصممها وطوّرها GNUTUX — مفتوحة المصدر بترخيص GPLv2.',
    bodyEn: 'A modern network diagnostic & management tool for GNU/Linux.\nBuilt by GNUTUX — open source under GPLv2.'
  },
  {
    icon: '🔍',
    titleAr: 'اكتشاف الأجهزة الذكي',
    titleEn: 'Smart Device Discovery',
    bodyAr: 'يكتشف البرنامج جميع الأجهزة على الشبكة ويعرض أسماءها الحقيقية وطرازاتها (iPhone، Android، أجهزة التوجيه...)\nيستخدم ARP + mDNS + OUI لتعريف دقيق.',
    bodyEn: 'Discovers all devices on your network with real names and model identifiers (iPhone, Android, routers…)\nUses ARP + mDNS + OUI for accurate identification.'
  },
  {
    icon: '📡',
    titleAr: 'أدوات تشخيص متكاملة',
    titleEn: 'Complete Diagnostic Suite',
    bodyAr: '• اختبار DNS\n• تتبع المسار (Traceroute)\n• اختبار Ping\n• فحص المنافذ\n• قياس سرعة الإنترنت',
    bodyEn: '• DNS lookup & test\n• Traceroute\n• Ping test\n• Port scanner\n• Internet speed test'
  },
  {
    icon: '📦',
    titleAr: 'إعداد التبعيات',
    titleEn: 'Setup Dependencies',
    bodyAr: 'يحتاج البرنامج بعض الأدوات لتعمل جميع الميزات.\nيمكنك تثبيتها الآن أو لاحقاً من صفحة الإعدادات.',
    bodyEn: 'Some features require external tools.\nYou can install them now or later from Settings → Dependencies.'
  }
]

// ── Deps Slide component ─────────────────────────────────────────────────────

function DepsSlide({ lang }: { lang: string }) {
  const [deps, setDeps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState<string | null>(null)

  useEffect(() => {
    window.api.system.checkDeps().then((d: any) => {
      setDeps(d.tools || [])
      setLoading(false)
    })
  }, [])

  const install = async (cmd: string) => {
    setInstalling(cmd)
    try {
      await window.api.system.installTool(cmd)
      const d = await window.api.system.checkDeps()
      setDeps(d.tools || [])
    } finally {
      setInstalling(null)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
      <Spinner size={28} />
    </div>
  )

  const missing = deps.filter((d: any) => !d.installed && d.installCmd)

  if (missing.length === 0) return (
    <div style={{ textAlign: 'center', padding: '24px 0', color: '#3FB950', fontSize: 14 }}>
      {lang === 'ar' ? '✅ جميع التبعيات مثبّتة!' : '✅ All dependencies installed!'}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
      {missing.map((d: any) => (
        <div key={d.tool.command} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', background: '#161B22', borderRadius: 6,
          border: '1px solid #21262D'
        }}>
          <span style={{ fontSize: 11, color: '#F85149', background: '#2D1B1B', padding: '2px 6px', borderRadius: 4 }}>
            {lang === 'ar' ? 'غير مثبّت' : 'Missing'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#E6EDF3', fontWeight: 600 }}>{d.tool.name}</div>
            <div style={{ fontSize: 10, color: '#6E7681' }}>{d.tool.description}</div>
          </div>
          <button
            onClick={() => install(d.tool.command)}
            disabled={installing === d.tool.command}
            style={{
              padding: '4px 10px', fontSize: 11, borderRadius: 4,
              border: '1px solid #30363D', background: '#21262D',
              color: '#E6EDF3', cursor: 'pointer', opacity: installing === d.tool.command ? 0.6 : 1
            }}
          >
            {installing === d.tool.command
              ? (lang === 'ar' ? 'جارٍ...' : '...')
              : (lang === 'ar' ? 'تثبيت' : 'Install')}
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Main Onboarding component ────────────────────────────────────────────────

export function Onboarding() {
  const { setOnboardingDone, setLang, lang: storeLang } = useAppStore()
  const { isRtl } = useI18n()
  const [step, setStep] = useState(0)
  const [lang, setLocalLang] = useState<'ar' | 'en'>(storeLang as 'ar' | 'en')
  const total = SLIDES.length
  const slide = SLIDES[step]
  const isDepsSlide = step === total - 1

  const chooseLang = (l: 'ar' | 'en') => {
    setLocalLang(l)
    setLang(l)
  }

  const finish = () => {
    window.api.discovery.preload().catch(() => {})
    setOnboardingDone()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(13,17,23,0.97)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        style={{
          width: '100%', maxWidth: 520,
          background: '#161B22',
          border: '1px solid #30363D',
          borderRadius: 14,
          padding: '36px 40px 28px',
          display: 'flex', flexDirection: 'column', gap: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)'
        }}
      >
        {/* Language selector (first slide only) */}
        {step === 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {(['ar', 'en'] as const).map((l) => (
              <button
                key={l}
                onClick={() => chooseLang(l)}
                style={{
                  padding: '4px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                  border: '1px solid',
                  borderColor: lang === l ? '#F5B800' : '#30363D',
                  background: lang === l ? '#F5B800' : '#21262D',
                  color: lang === l ? '#0D1117' : '#6E7681',
                  fontWeight: lang === l ? 700 : 400
                }}
              >
                {l === 'ar' ? '🇲🇦 العربية' : '🇺🇸 English'}
              </button>
            ))}
          </div>
        )}

        {/* Icon + Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>{slide.icon}</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#E6EDF3', margin: 0 }}>
            {lang === 'ar' ? slide.titleAr : slide.titleEn}
          </h2>
        </div>

        {/* Body */}
        {!isDepsSlide ? (
          <p style={{
            fontSize: 13, color: '#8B949E', lineHeight: 1.7, margin: 0,
            whiteSpace: 'pre-line', textAlign: lang === 'ar' ? 'right' : 'left'
          }}>
            {lang === 'ar' ? slide.bodyAr : slide.bodyEn}
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: '#8B949E', margin: '0 0 4px', lineHeight: 1.7 }}>
              {lang === 'ar' ? slide.bodyAr : slide.bodyEn}
            </p>
            <DepsSlide lang={lang} />
          </>
        )}

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 4 }}>
          {SLIDES.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 8,
                height: 8,
                borderRadius: 4,
                background: i === step ? '#F5B800' : '#30363D',
                transition: 'all 0.25s',
                cursor: 'pointer'
              }}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{
              background: 'none', border: '1px solid #30363D', borderRadius: 6,
              padding: '6px 16px', color: '#8B949E', fontSize: 12, cursor: step === 0 ? 'default' : 'pointer',
              opacity: step === 0 ? 0.3 : 1
            }}
          >
            {lang === 'ar' ? 'السابق' : 'Back'}
          </button>

          {step < total - 1 ? (
            <Btn variant="primary" onClick={() => setStep((s) => s + 1)}>
              {lang === 'ar' ? 'التالي' : 'Next'}
            </Btn>
          ) : (
            <Btn variant="primary" onClick={finish}>
              {lang === 'ar' ? 'ابدأ الاستخدام' : 'Get Started'}
            </Btn>
          )}
        </div>

        {/* Skip */}
        <button
          onClick={finish}
          style={{
            background: 'none', border: 'none', color: '#484F58',
            fontSize: 11, cursor: 'pointer', textAlign: 'center', padding: 0
          }}
        >
          {lang === 'ar' ? 'تخطي' : 'Skip'}
        </button>
      </div>
    </div>
  )
}
