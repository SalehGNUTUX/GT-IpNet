# GT-IpNet — ملف إقراني شامل

**المطور:** GNUTUX  
**الإصدار:** 1.0.0  
**الرخصة:** GPLv2  
**المنصة:** GNU/Linux حصراً  
**GitHub:** https://github.com/SalehGNUTUX/GT-IpNet  
**تاريخ التوثيق:** 2026-04-25

---

## 1. نظرة عامة على المشروع

GT-IpNet هو تطبيق سطح مكتب بواجهة رسومية حديثة لتشخيص وإدارة الشبكة المحلية على نظام GNU/Linux. يجمع بين أدوات شبكية متعددة تحت واجهة موحدة ثنائية اللغة (عربية/إنجليزية) مع دعم كامل لـ RTL.

### المكدّس التقني

| الطبقة | التقنية |
|--------|---------|
| Shell | Electron 31 |
| Frontend | React 18 + TypeScript 5 |
| Build | electron-vite 2 + Vite 5 |
| Styling | Tailwind CSS v4 + inline styles |
| State | Zustand 4 (localStorage persistence) |
| Packaging | electron-builder (AppImage + DEB + RPM) |

---

## 2. معمارية ثلاثية العمليات

```
┌─────────────────────────────────────────────────────────┐
│  Renderer (React)          src/renderer/                │
│  window.api.<ns>.<method>()                             │
│           │                                             │
│           ▼  ipcRenderer.invoke()                       │
├─────────────────────────────────────────────────────────┤
│  Preload Bridge            src/preload/index.ts         │
│  contextBridge → window.api                             │
│           │                                             │
│           ▼  ipcMain.handle()                           │
├─────────────────────────────────────────────────────────┤
│  Main Process (Node.js)    src/main/                    │
│  Shell execution, file I/O, privilege escalation        │
└─────────────────────────────────────────────────────────┘
```

**القانون الأساسي:** الـ renderer لا يملك أي وصول Node.js مباشر. كل العمليات الحساسة (تشغيل أوامر، قراءة ملفات النظام، الصلاحيات) تتم حصراً في الـ main process.

---

## 3. هيكل المجلدات

```
GT-IPNET/
├── src/
│   ├── main/
│   │   ├── index.ts              # نقطة دخول main: نافذة، IPC، CSP
│   │   ├── ipc/
│   │   │   ├── network.ts        # واجهات الشبكة، routing، ARP، wifi
│   │   │   ├── discovery.ts      # arp-scan + nmap + كشف الأجهزة
│   │   │   ├── diagnostics.ts    # DNS + traceroute + ping
│   │   │   ├── ports.ts          # ss/netstat + nmap port scan
│   │   │   ├── speed.ts          # speedtest-cli + curl fallback
│   │   │   └── system.ts         # تبعيات + تقارير + إصدار
│   │   └── utils/
│   │       ├── exec.ts           # runCommand / streamCommand + تصاعد صلاحيات
│   │       ├── deviceInfo.ts     # OUI + mDNS + قاعدة بيانات Apple
│   │       ├── deps.ts           # كشف مدير الحزم + تثبيت الأدوات
│   │       └── report.ts         # حفظ التقارير في ~/GT-IpNet_Reports/
│   ├── preload/
│   │   └── index.ts              # الجسر الكامل window.api
│   └── renderer/
│       ├── App.tsx               # التوجيه + Onboarding + إشعارات
│       ├── store/
│       │   └── appStore.ts       # Zustand: lang, page, lastDiscovery, lastSpeed
│       ├── hooks/
│       │   └── useI18n.ts        # قاموس ar/en + useI18n hook
│       ├── components/
│       │   ├── ui/index.tsx      # مكتبة UI: Card, Btn, Badge, StatCard...
│       │   └── layout/
│       │       ├── Sidebar.tsx
│       │       ├── Titlebar.tsx
│       │       ├── PrivilegeBanner.tsx
│       │       └── Onboarding.tsx
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Discovery.tsx
│       │   ├── Diagnostics.tsx
│       │   ├── Ports.tsx
│       │   ├── Speed.tsx
│       │   ├── Settings.tsx
│       │   └── Reports.tsx
│       └── styles/global.css
├── resources/
│   └── icon.png                  # 256×256 PNG (أيقونة التطبيق)
├── scripts/
│   └── build-all.sh              # بناء AppImage + DEB + RPM
└── CLAUDE.md                     # توجيهات Claude Code
```

---

## 4. الأوامر المتاحة

```bash
# تطوير
npm run dev               # وضع التطوير مع hot-reload

# بناء
npm run build             # بناء main + preload + renderer → out/
npm run typecheck         # فحص TypeScript بدون إصدار

# تحزيم
npm run build:all         # AppImage + DEB + RPM (bash scripts/build-all.sh)
npm run build:appimage    # AppImage فقط
npm run build:deb         # .deb فقط
npm run build:rpm         # .rpm فقط (يستخدم alien إن لم يتوفر rpmbuild)
```

---

## 5. نظام صلاحيات الجذر (exec.ts)

تصاعد تلقائي ثلاثي المراحل عند تمرير `sudo: true` لـ `runCommand`:

```
1. isRoot()      → يعمل كـ root أصلاً → تشغيل مباشر
2. sudo -n true  → sudo بدون كلمة مرور → sudo -n <cmd>
3. pkexec        → نافذة رسومية من polkit → pkexec env DISPLAY=... <cmd>
```

**ملاحظة حرجة:** `streamCommand` هي **async** وتُرجع `Promise<() => void>`. يجب دائماً `await stopRef.current = await streamCommand(...)`.

**الحزمة المطلوبة لـ pkexec على Debian/Ubuntu:**
```bash
sudo apt install polkitd pkexec
```

---

## 6. كشف الأجهزة (deviceInfo.ts)

### مسار التعرف على كل جهاز:

```
MAC Address
    │
    ▼ OUI Lookup
/usr/share/nmap/nmap-mac-prefixes
/usr/share/arp-scan/ieee-oui.txt
    │ → manufacturer (Apple / Samsung / Cisco...)
    │ → deviceType أولي (iphone / android / router...)
    │
    ▼ mDNS (avahi-browse أو nmap mdns-sd)
كشف الخدمات المعلنة على الشبكة:
    │ → deviceName ("John's iPhone")
    │ → modelId ("iPhone14,2")
    │ → os ("iOS 17")
    │ → services (_airplay._tcp, _smb._tcp...)
    │
    ▼ Apple Model DB (مضمّن في الكود)
"iPhone14,2" → "iPhone 13 Pro"
100+ طراز Apple مدعوم (iPhone, iPad, Mac, Apple Watch, Apple TV)
    │
    ▼ nmap OS Detection (عند الطلب فقط)
nmap -O --osscan-guess → تفاصيل نظام التشغيل
```

### أنواع الأجهزة المعتمدة:
`iphone | ipad | mac | apple-tv | apple-watch | android | windows | linux | router | switch | access-point | printer | tv | smart-home | iot | unknown`

### تخزين OUI:
يُحمَّل مرة واحدة ويُخزَّن في `_ouiCache`. نتائج mDNS مخزّنة 60 ثانية.

---

## 7. الـ Parser ثنائي الوضع في Discovery

### الفحص السريع (arp-scan):
كل سطر = جهاز كامل:
```
192.168.1.1   00:11:22:33:44:55   Cisco Systems
```

### الفحص الشامل (nmap -sn):
**3 أسطر لكل جهاز** → يستخدم `nmapPendingRef` لجمعها:
```
Nmap scan report for router (192.168.1.1)   ← بداية الجهاز
Host is up (0.00031s latency).              ← إضافة latency
MAC Address: 00:11:22:33:44:55 (Cisco)     ← إكمال الجهاز
```
الجهاز المحلي (بدون MAC) يُطلَق عند بدء السطر التالي أو `Nmap done:`.

---

## 8. حفظ النتائج (Persistence)

كل البيانات المحفوظة في `localStorage` تحت مفتاح `gt-ipnet-store`:

| المفتاح | النوع | الوصف |
|---------|-------|-------|
| `lang` | `'ar' \| 'en'` | لغة الواجهة |
| `activeInterface` | `string` | آخر واجهة شبكة مختارة |
| `onboardingDone` | `boolean` | هل أتمّ المستخدم الإعداد الأولي |
| `lastSpeedResult` | `LastSpeedResult \| null` | آخر نتيجة قياس سرعة + التاريخ |
| `lastDiscovery` | `LastDiscovery \| null` | آخر نتائج فحص الشبكة (الأجهزة + التاريخ + الواجهة + الوضع) |

عند فتح صفحة **اكتشاف الأجهزة**: تُعرض النتائج المحفوظة مباشرة مع **شريط إشعار أصفر** يوضح تاريخ آخر فحص والواجهة والوضع، مع زر "↺ فحص جديد".

---

## 9. نظام الترجمة (useI18n)

```typescript
const { t, lang, isRtl } = useI18n()
t('discovery')  // → 'اكتشاف الأجهزة' | 'Discovery'
```

الملف الوحيد: `src/renderer/hooks/useI18n.ts` — قاموسان `ar` و `en` مدمجان.

**قواعد تسمية المصطلحات العربية:**
- DNS → `نظام أسماء النطاقات (DNS)`
- Ping → `مستكشف حزم الإنترنت (PING)`
- العلم المستخدم: 🇲🇦 للعربية (أرقام غربية/مغربية)، 🇺🇸 للإنجليزية
- تنسيق التاريخ بالعربية: `ar-MA` (أرقام غربية ١٢٣ وليس مشرقية)

---

## 10. نظام المكوّنات (ui/index.tsx)

**تحذير مهم:** Tailwind v4 arbitrary values (مثل `text-[#79C0FF]`) **تنكسر في runtime**. جميع الألوان تستخدم inline styles مع:

```typescript
const C = { amber: '#F5B800', cyan: '#79C0FF', green: '#3FB950', ... }
hex('cyan')         // → '#79C0FF'
hexBg('cyan', 0.12) // → 'rgba(121,192,255,0.12)'
```

### المكوّنات المتاحة:
`Card`, `Btn`, `Badge`, `StatCard`, `Progress`, `Sparkline`, `TerminalOutput`, `Input`, `Spinner`, `SectionTitle`, `NotificationToast`, `ErrorBoundary`

---

## 11. شاشة الإعداد الأولي (Onboarding)

تظهر **مرة واحدة فقط** عند أول تشغيل (تُحكم بـ `onboardingDone` في store). 4 شرائح:
1. ترحيب بـ GT-IpNet + اختيار اللغة
2. شرح كشف الأجهزة الذكي
3. شرح أدوات التشخيص
4. تثبيت التبعيات المفقودة (تلقائي من الشاشة)

---

## 12. التبعيات النظامية المطلوبة

| الأداة | الحزمة (apt) | الوظيفة | مطلوبة |
|--------|--------------|---------|--------|
| `ip` | `iproute2` | معلومات الشبكة | ✅ نعم |
| `ping` | `iputils-ping` | اختبار الاتصال | ✅ نعم |
| `arp-scan` | `arp-scan` | الفحص السريع | اختياري |
| `nmap` | `nmap` | الفحص الشامل + OS detection | اختياري |
| `dig` | `dnsutils` | اختبار DNS | اختياري |
| `mtr` | `mtr` | تتبع المسار | اختياري |
| `traceroute` | `traceroute` | تتبع المسار (بديل) | اختياري |
| `speedtest-cli` | `speedtest-cli` | قياس السرعة | اختياري |
| `avahi-browse` | `avahi-utils` | أسماء الأجهزة الحقيقية (mDNS) | اختياري |
| `pkexec` | `pkexec` | نافذة رسومية لطلب صلاحيات الجذر | اختياري |
| `ss` | `iproute2` | إحصاء المنافذ | اختياري |
| `curl` | `curl` | بديل لقياس السرعة | اختياري |

---

## 13. التحزيم (scripts/build-all.sh)

```bash
bash scripts/build-all.sh [all|appimage|deb|rpm]
```

**منطق RPM الذكي:**
1. محاولة `electron-builder --linux rpm` مباشرة (إذا وُجد `rpmbuild`)
2. إذا فشل: تحويل DEB → RPM عبر `alien -g` + `rpmbuild`
3. إذا لم تتوفر الأدوات: تعليمات تثبيت مفصّلة

**متطلبات بناء RPM على Debian/Ubuntu:**
```bash
sudo apt install alien rpm
```

---

## 14. ملاحظات التطوير الحرجة

### 1. streamCommand هي async
```typescript
// ❌ خطأ
stopRef.current = window.api.discovery.streamScan(...)

// ✅ صحيح (في preload الـ streamScan تستدعي invoke وتُرجع void، لكن الـ onStream يُعطي stop fn)
stopRef.current = window.api.discovery.onStream(callback)
await window.api.discovery.streamScan(iface, mode, subnet)
```

### 2. مجلد التقارير قد يكون root-owned
إذا شُغّل التطبيق مرة بـ sudo، يصبح المجلد ملكاً لـ root. `saveReport()` تُرجع `null` بدلاً من الإلقاء، و`ensureReportsDir()` تُصلح الملكية تلقائياً.

### 3. OUI database قد لا تتوفر
إذا لم يُثبَّت `nmap` أو `arp-scan`، قاعدة OUI ستكون فارغة وسيُعرض المصنّع كـ "Unknown". هذا طبيعي ولا يُعدّ خطأ.

### 4. mDNS يحتاج avahi-utils
`avahi-browse` من حزمة `avahi-utils`. بدونه يتراجع النظام لـ `nmap --script mdns-sd` إن وُجد nmap.

### 5. إضافة IPC جديد
يجب تعديل **ثلاثة ملفات**:
- `src/main/ipc/<feature>.ts` — الـ handler
- `src/preload/index.ts` — إضافة التابع للـ api object
- الـ renderer — استدعاء `window.api.<ns>.<method>()`

---

## 15. تدفق البيانات في كشف الأجهزة

```
المستخدم يضغط "فحص الشبكة"
         │
         ▼
streamScan(iface, mode, subnet)  [main: arp-scan أو nmap]
         │
         ▼ stream lines via IPC
Discovery.tsx: onStream callback
         │
         ├── mode=quick → parseArpLine()    → host كامل في سطر واحد
         └── mode=full  → parseNmapStreamLine() + nmapPendingRef → host بعد 3 أسطر
         │
         ▼
quickEnrich(host): OUI lookup → deviceType أولي (instant)
         │
         ▼  [بعد اكتمال الفحص]
identifyAllHosts(): enrich API → OUI + mDNS batch
         │
         ▼
saveDiscovery(): حفظ في localStorage
         │
         ▼
عرض النتائج مع شارة "محفوظة" عند إعادة الفتح
```

---

## 16. تدفق البيانات في قياس السرعة

```
المستخدم يضغط "بدء الاختبار"
         │
         ▼
speed.stream()          [main: speedtest-cli --bytes]
         │
         ▼ stream lines
Speed.tsx: onStream callback
         │
         ├── "Testing download..." → setPhase('download')
         ├── "Download: 45.3 Mbit/s" → setLiveDownload(45.3) → رسم gauge
         ├── "Testing upload..."   → setPhase('upload')
         └── "Upload: 12.1 Mbit/s" → setLiveUpload(12.1) → رسم gauge
         │
         ▼  [بعد انتهاء stream]
speed.run()             [main: speedtest-cli --simple → نتيجة نظيفة]
         │
         ▼
saveSpeedResult(): حفظ في localStorage
         │
         ▼
عرض "آخر اختبار" عند إعادة الفتح
```

---

*آخر تحديث للوثيقة: 2026-04-25*
