# GT-IpNet — التوثيق الشامل | Comprehensive Documentation

![GPLv2](https://img.shields.io/badge/license-GPLv2-blue?style=flat-square) ![GPLv3](https://img.shields.io/badge/license-GPLv3-3FB950?style=flat-square) ![Version](https://img.shields.io/badge/version-2.0.0-F5B800?style=flat-square) ![Platform](https://img.shields.io/badge/platform-GNU%2FLinux-79C0FF?style=flat-square)

<p align="center">
  <img src="icon.png" width="180" alt="GT-IpNet Icon"/>
</p>

**المطور:** [GNUTUX](https://github.com/SalehGNUTUX)  
**الموقع:** [salehgnutux.github.io/GT-IpNet](https://salehgnutux.github.io/GT-IpNet/)  
**ماستدون:** [@gnutux@linuxrocks.online](https://linuxrocks.online/@gnutux)  
**تيليغرام:** [t.me/GNUTUX](https://t.me/GNUTUX)

---

## 📑 المحتويات

1. [نبذة](#نبذة)
2. [رحلة التطور](#رحلة-التطور)
3. [جدول المقارنة الشامل](#جدول-المقارنة-الشامل)
4. [الإصدار 2.0.0 — الثوري](#الإصدار-200--الثوري)
5. [الإصدار 1.0.0 — الرسومي](#الإصدار-100--الرسومي)
6. [الإصدار 0.1 — الطرفي](#الإصدار-01--الطرفي)
7. [طرق التثبيت](#طرق-التثبيت)
8. [التبعيات النظامية](#التبعيات-النظامية)
9. [البناء من المصدر](#البناء-من-المصدر)
10. [البنية التقنية](#البنية-التقنية)
11. [سجل التغييرات](#سجل-التغييرات)
12. [الترخيص](#الترخيص)

---

## نبذة

GT-IpNet هو مشروع مفتوح المصدر لنظام GNU/Linux، بدأ كبرنامج نصي بسيط للطرفية (Shell Script) ثم تطور إلى تطبيق سطح مكتب متكامل بواجهة رسومية حديثة مبنية بـ **Electron + React + TypeScript**. المشروع صُمم ليكون **متعدد الإصدارات** يلبي احتياجات مختلف المستخدمين: من محبي سطر الأوامر إلى من يفضلون الواجهات الرسومية المتقدمة مع التحكم الكامل بالشبكة.

> **الفلسفة:** لكل مستخدم أداته. لا نفرض واجهة على أحد — نوفر الخيارات الثلاثة معاً.

---

## رحلة التطور

```
┌──────────────────────────────────────────────────────────────────────┐
│                        رحلة GT-IpNet                                 │
│                                                                      │
│  v0.1 (2025)        v1.0.0 (2026-04)        v2.0.0 (2026-05)       │
│  ┌─────────┐        ┌──────────────┐        ┌────────────────────┐  │
│  │ طرفية    │   →    │ واجهة رسومية  │   →    │ متحكم شبكة متكامل  │  │
│  │ Shell    │        │ Electron+React│        │ + ضابط + قفل + Tray│  │
│  │ ~50 KB   │        │ ~105 MB      │        │ ~105 MB            │  │
│  │ GPLv2    │        │ GPLv2        │        │ GPLv3              │  │
│  └─────────┘        └──────────────┘        └────────────────────┘  │
│                                                                      │
│  الميزات:            الميزات الجديدة:          الميزات الثورية:       │
│  • مسح ARP          • واجهة رسومية           • ضابط الشبكة           │
│  • تقارير           • اكتشاف ذكي             • حجب/تحديد الأجهزة     │
│  • ثنائي اللغة      • فحص منافذ              • قفل البرنامج          │
│                      • قياس سرعة              • Tray Icon            │
│                      • تشخيص DNS             • MAC العشوائي          │
│                      • صلاحيات pkexec        • شبكات مجاورة          │
│                                               • استمرارية خلفية      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## جدول المقارنة الشامل

| الميزة | v0.1 | v1.0.0 | v2.0.0 |
|--------|:---:|:---:|:---:|
| **نوع الواجهة** | 🖥️ طرفية | 🪟 رسومية | 🪟 رسومية |
| **حجم التطبيق** | ~50 KB | ~105 MB | ~105 MB |
| **التقنية** | Bash Script | Electron + React + TS | Electron + React + TS |
| **اكتشاف الأجهزة** | ✅ أساسي | ✅ متقدم | ✅ متقدم |
| **كشف MAC العشوائي** | ❌ | ❌ | ✅ |
| **أسماء الأجهزة الحقيقية (mDNS/NetBIOS)** | ❌ | ❌ | ✅ |
| **اكتشاف الشبكات المجاورة** | ❌ | ❌ | ✅ |
| **ضابط الشبكة (حجب/تحديد)** | ❌ | ❌ | ✅ |
| **تأجيل رفع الحجب** | ❌ | ❌ | ✅ |
| **الاستمرارية في الخلفية** | ❌ | ❌ | ✅ |
| **عداد تنازلي للحجب** | ❌ | ❌ | ✅ |
| **قفل البرنامج** | ❌ | ❌ | ✅ |
| **القفل التلقائي بعد الخمول** | ❌ | ❌ | ✅ |
| **أيقونة Tray** | ❌ | ❌ | ✅ |
| **حوار تأكيد الإغلاق** | ❌ | ❌ | ✅ |
| **وضع الجلسة (sudo -S)** | ❌ | ❌ | ✅ |
| **فحص المنافذ** | ❌ | ✅ أساسي | ✅ بأسماء البرامج + PID |
| **فحص nmap للأجهزة البعيدة** | ❌ | ❌ | ✅ |
| **قياس سرعة الإنترنت** | ❌ | ✅ أساسي | ✅ مقاييس دائرية حية |
| **تشخيص DNS/Traceroute/Ping** | ❌ | ✅ | ✅ |
| **التقارير** | ✅ TXT | ✅ محفوظة | ✅ محفوظة + سجلات أخطاء |
| **ثنائي اللغة (عربي/إنجليزي)** | ✅ | ✅ | ✅ |
| **RTL كامل** | ❌ | ✅ | ✅ |
| **شاشة ترحيب** | ❌ | ✅ | ✅ |
| **تثبيت التبعيات من الواجهة** | ❌ | ✅ | ✅ |
| **Enter يرسل النماذج** | ❌ | ❌ | ✅ |
| **تحسين استهلاك الذاكرة** | ❌ | ❌ | ✅ |
| **الرخصة** | GPLv2 | GPLv2 | **GPLv3** |

---

## الإصدار 2.0.0 — الثوري

### 🆕 الميزات الجديدة كلياً

#### 📡 ضابط الشبكة (Network Controller)
- **حجب الإنترنت** عن أي جهاز على الشبكة المحلية
  - حجب دائم
  - حجب بمؤقت زمني (بالدقائق) مع **عداد تنازلي حي**
- **تحديد عرض النطاق الترددي:** 128Kbit | 512Kbit | 1Mbit | 5Mbit | 10Mbit
- **تأجيل رفع الحجب:** عند رفع الحجب يمكن تحديد مدة تأجيل قبل التنفيذ
- **كشف القيود السابقة تلقائياً** عند فتح القسم مع خيار الاعتماد أو التنظيف
- **الاستمرارية في الخلفية** *(اختياري)*: الإغلاق الكامل للبرنامج لا يوقف العمليات
- **حماية ذاتية:** لا يمكن حجب جهازك الحالي أبداً
- **تنظيف تلقائي** عند الإغلاق العادي + تسجيل كل عملية في التقارير
- التقنية: `arpspoof` (ARP Spoofing) + `iptables` + `tc` (Traffic Control)

#### 🔒 قفل البرنامج (App Lock)
- كلمة مرور خاصة (SHA-256) مستقلة عن كلمة مرور الجذر
- نظام أمان متكامل: تعطيل/إعادة تفعيل/تغيير/تصفير القفل — جميعها تطلب كلمة المرور الحالية
- الـ hash لا يُمسح عند التعطيل (يبقى للتحقق عند إعادة التفعيل)
- **القفل التلقائي بعد الخمول:** تحديد مدة بالدقائق لإعادة القفل تلقائياً
- تبديل اللغة من شاشة القفل
- Enter يُرسل النماذج في جميع أقسام البرنامج

#### ⚡ وضع صلاحيات الجذر
- **لكل عملية:** يطلب كلمة المرور عند كل أمر محمي (الافتراضي)
- **مرة واحدة للجلسة:** `sudo -S` + `sudo -k` للأمان — صامت طوال الجلسة

#### 📌 ميزات الواجهة المتقدمة
- **أيقونة شريط النظام (Tray):** البرنامج يعيش في الخلفية، نقرة واحدة للإظهار/الإخفاء
- **حوار تأكيد الإغلاق:** خيارات "تصغير" أو "إغلاق" (مع كلمة مرور القفل)
- **كشف MAC العشوائي:** يكشف تلقائياً عناوين MAC العشوائية (iOS 14+ و Android 10+)
- **اكتشاف الشبكات المجاورة:** زر "+شبكات" يستكشف الموجهات المتشابكة
- **Deep Identify:** نتائج nmap حقيقية لكل جهاز

#### 📋 تحسينات على الإصدار السابق
- المنافذ: أسماء البرامج و PID، تبويبان (اتصالات / استماع)، فحص nmap للأجهزة البعيدة
- السرعة: مقياسان SVG دائريان متحركان بقيم حية
- التقارير: سجلات أخطاء في تبويب منفصل
- استهلاك محسَّن للذاكرة (تعطيل GPU غير الضروري)

### 📥 التحميل

| الحزمة | الرابط | الحجم | SHA256 |
|--------|--------|:----:|--------|
| **AppImage** | [GT-IpNet-2.0.0-x86_64.AppImage](https://github.com/SalehGNUTUX/GT-IpNet/releases/download/GT-IpNet_2.0.0_amd64/GT-IpNet-2.0.0-x86_64.AppImage) | 105 MB | `5f5b7ca32a2cc55139375e3f6328284efba2bc3f2fa292828359bbe2b18bcf7a` |
| **DEB** | [GT-IpNet_2.0.0_amd64.deb](https://github.com/SalehGNUTUX/GT-IpNet/releases/download/GT-IpNet_2.0.0_amd64/GT-IpNet_2.0.0_amd64.deb) | 72.3 MB | `f8e1a0b6b0eb3a69802e21070b1b977ea717532c09114437615ba5101d698f77` |
| **RPM** | [GT-IpNet_2.0.0_amd64.rpm](https://github.com/SalehGNUTUX/GT-IpNet/releases/download/GT-IpNet_2.0.0_amd64/GT-IpNet_2.0.0_amd64.rpm) | 103 MB | `58a358c51782a89c023a7bcdddf3584377a1fc1dcd9399d599fbd4d1e22b01e6` |

**[صفحة الإصدار على GitHub](https://github.com/SalehGNUTUX/GT-IpNet/releases/tag/GT-IpNet_2.0.0_amd64)**

---

## الإصدار 1.0.0 — الرسومي

### الميزات
- أول إصدار بواجهة رسومية كاملة (Electron + React + TypeScript)
- اكتشاف الأجهزة عبر `arp-scan` و `nmap`
- فحص المنافذ عبر `ss` و `nmap`
- قياس سرعة الإنترنت عبر `speedtest-cli`
- تشخيص DNS و Traceroute و Ping
- واجهة عربية/إنجليزية كاملة مع RTL
- نظام صلاحيات ذكي (pkexec)
- حفظ النتائج والتقارير تلقائياً
- شاشة ترحيب عند الاستخدام الأول

### 📥 التحميل

| الحزمة | الرابط | الحجم | SHA256 |
|--------|--------|:----:|--------|
| **AppImage** | [GT-IpNet-1.0.0-x86_64.AppImage](https://github.com/SalehGNUTUX/GT-IpNet/releases/download/gt-ipnet-1.0/GT-IpNet-1.0.0-x86_64.AppImage) | 105 MB | `1b23a6e81130185b535f972e7b6d888a903dab846e187d7c2f920b9e87d85b13` |
| **DEB** | [GT-IpNet_1.0.0_amd64.deb](https://github.com/SalehGNUTUX/GT-IpNet/releases/download/gt-ipnet-1.0/GT-IpNet_1.0.0_amd64.deb) | 72.3 MB | `601ff6acbedb355e4c2dcd06faeb55fce034098763f4c5e0b30749839f76b785` |
| **RPM** | [gt-ipnet-1.0.0.x86_64.rpm](https://github.com/SalehGNUTUX/GT-IpNet/releases/download/gt-ipnet-1.0/gt-ipnet-1.0.0.x86_64.rpm) | 103 MB | `2613a5fe86f3e979a69dc7b4106e07a1e64ba81a3ab39abab7847cbeed3735bc` |

**[صفحة الإصدار على GitHub](https://github.com/SalehGNUTUX/GT-IpNet/releases/tag/gt-ipnet-1.0)**

---

## الإصدار 0.1 — الطرفي

### الميزات
- برنامج نصي خفيف (~50 KB) يعمل مباشرة من سطر الأوامر
- مسح سريع للشبكة عبر `arp-scan`
- إنشاء تقارير فورية
- دعم اللغتين العربية والإنجليزية
- لا يحتاج واجهة رسومية أو تبعيات كبيرة
- متوافق مع جميع توزيعات GNU/Linux

### 📥 التحميل

| الطريقة | الرابط |
|--------|--------|
| **AppImage** | [GT-IpNet_Network_Controller-V0.1-x86_64.AppImage](https://github.com/SalehGNUTUX/GT-IpNet/releases/download/GT-IpNet.V0.1/GT-IpNet_Network_Controller-V0.1-x86_64.AppImage) |
| **صفحة الإصدار** | [GT-IpNet.V0.1 Release](https://github.com/SalehGNUTUX/GT-IpNet/releases/tag/GT-IpNet.V0.1) |

---

## طرق التثبيت

### 🟣 الإصدار 2.0.0

#### AppImage (موصى به لجميع التوزيعات)
```bash
wget https://github.com/SalehGNUTUX/GT-IpNet/releases/download/GT-IpNet_2.0.0_amd64/GT-IpNet-2.0.0-x86_64.AppImage
chmod +x GT-IpNet-2.0.0-x86_64.AppImage
./GT-IpNet-2.0.0-x86_64.AppImage
```

#### DEB (Debian / Ubuntu / Linux Mint)
```bash
wget https://github.com/SalehGNUTUX/GT-IpNet/releases/download/GT-IpNet_2.0.0_amd64/GT-IpNet_2.0.0_amd64.deb
sudo dpkg -i GT-IpNet_2.0.0_amd64.deb
```

#### RPM (Fedora / openSUSE / RHEL)
```bash
wget https://github.com/SalehGNUTUX/GT-IpNet/releases/download/GT-IpNet_2.0.0_amd64/GT-IpNet_2.0.0_amd64.rpm
sudo rpm -i GT-IpNet_2.0.0_amd64.rpm
```

---

### 🔵 الإصدار 1.0.0

#### AppImage
```bash
wget https://github.com/SalehGNUTUX/GT-IpNet/releases/download/gt-ipnet-1.0/GT-IpNet-1.0.0-x86_64.AppImage
chmod +x GT-IpNet-1.0.0-x86_64.AppImage
./GT-IpNet-1.0.0-x86_64.AppImage
```

#### DEB
```bash
wget https://github.com/SalehGNUTUX/GT-IpNet/releases/download/gt-ipnet-1.0/GT-IpNet_1.0.0_amd64.deb
sudo dpkg -i GT-IpNet_1.0.0_amd64.deb
```

#### RPM
```bash
wget https://github.com/SalehGNUTUX/GT-IpNet/releases/download/gt-ipnet-1.0/gt-ipnet-1.0.0.x86_64.rpm
sudo rpm -i gt-ipnet-1.0.0.x86_64.rpm
```

---

### 🟢 الإصدار 0.1 (الطرفي)

#### التثبيت من المصدر (الطريقة الموصى بها)
```bash
git clone https://github.com/SalehGNUTUX/GT-IpNet.git
cd GT-IpNet
chmod +x gtipnet.sh
sudo ./gtipnet.sh
```

#### أو استخدام AppImage
```bash
wget https://github.com/SalehGNUTUX/GT-IpNet/releases/download/GT-IpNet.V0.1/GT-IpNet_Network_Controller-V0.1-x86_64.AppImage
chmod +x GT-IpNet_Network_Controller-V0.1-x86_64.AppImage
./GT-IpNet_Network_Controller-V0.1-x86_64.AppImage
```

#### أوامر سريعة
```bash
./gtipnet.sh --scan      # مسح سريع للشبكة
./gtipnet.sh --report    # إنشاء تقرير فوري
LANG=ar ./gtipnet.sh     # تشغيل بالعربية
```

---

## التبعيات النظامية

| الأداة | الحزمة (apt) | v0.1 | v1.0 | v2.0 | الوظيفة |
|--------|--------------|:---:|:---:|:---:|---------|
| `ip` | `iproute2` | ✅ | ✅ | ✅ | معلومات الشبكة والتوجيه |
| `ping` | `iputils-ping` | — | ✅ | ✅ | اختبار الاتصال |
| `arp-scan` | `arp-scan` | ✅ | ✅ | ✅ | الفحص السريع للشبكة |
| `nmap` | `nmap` | — | ✅ | ✅ | الفحص الشامل + كشف الخدمات |
| `avahi-browse` | `avahi-utils` | — | — | ✅ | أسماء الأجهزة عبر mDNS |
| `arpspoof` | `dsniff` | — | — | ✅ | ضابط الشبكة |
| `iptables` | `iptables` | — | — | ✅ | حجب/تحديد الأجهزة |
| `arping` | `arping` | — | — | ✅ | اكتشاف MAC البوابة |
| `dig` | `dnsutils` | — | ✅ | ✅ | اختبار DNS |
| `mtr` | `mtr` | — | ✅ | ✅ | تتبع المسار |
| `speedtest-cli` | `speedtest-cli` | — | ✅ | ✅ | قياس سرعة الإنترنت |
| `pkexec` | `pkexec` | — | ✅ | ✅ | نافذة رسومية للصلاحيات |
| `nmblookup` | `samba-client` | — | — | ✅ | أسماء أجهزة Windows |

> **تثبيت التبعيات:** في الإصدارين 1.0 و 2.0 يمكن تثبيت كل التبعيات من داخل البرنامج: **الإعدادات ← التبعيات**

---

## البناء من المصدر

### المتطلبات
- Node.js v18 أو أحدث
- npm v9+

### الخطوات (للإصدارين 1.0 و 2.0)
```bash
git clone https://github.com/SalehGNUTUX/GT-IpNet.git
cd GT-IpNet
npm install
npm run dev          # وضع التطوير
```

### التحزيم
```bash
npm run build           # بناء main + preload + renderer
npm run build:all       # AppImage + DEB + RPM (دفعة واحدة)
npm run build:appimage  # AppImage فقط
npm run build:deb       # .deb فقط
npm run build:rpm       # .rpm فقط
```

> **بناء RPM على Debian/Ubuntu:** `sudo apt install alien rpm`

---

## البنية التقنية

```
Electron (Main Process)       →  تشغيل الأوامر، IPC، Tray، الصلاحيات، حالة خلفية
    ↕ IPC (contextBridge)
React + TypeScript (Renderer) →  واجهة المستخدم، Zustand، i18n
```

**المكدّس:** Electron 31 + React 18 + TypeScript 5 + Vite 5 + Tailwind v4 + Zustand

### تصاعد الصلاحيات (4 مراحل)
1. root → تشغيل مباشر
2. كلمة مرور الجلسة (`sudo -S` بعد `sudo -k` للأمان) → صامت بلا حوار
3. `sudo -n` → passwordless sudo
4. pkexec → نافذة رسومية polkit

### ضابط الشبكة — كيف يعمل
```
arpspoof MITM + iptables GT_IPNET chain + tc HTB
PID files: /tmp/gt-arp-<ip>-{1,2}.pid
State file: ~/GT-IpNet_Reports/netcontrol-state.json
```

---

## سجل التغييرات

### v2.0.0 — 2026-05

**ميزات جديدة:**
- قسم **ضابط الشبكة** (حجب/تحديد/عداد تنازلي/كشف قيود سابقة)
- **الاستمرارية في الخلفية:** العمليات تبقى بعد إغلاق البرنامج مع auto-stop للمؤقتات
- **قفل البرنامج:** SHA-256، شاشة قفل، تبديل لغة من شاشة القفل
- **القفل التلقائي بعد الخمول** (دقائق قابلة للتحديد)
- **وضع الجلسة** (`sudo -S` + `sudo -k` للأمان)
- **أيقونة Tray** + حوار تأكيد الإغلاق
- **تأجيل رفع الحجب:** حجب موقوت حتى رفع الحجب
- **فحص الشبكات المجاورة** (موجهات متشابكة)

**تحسينات:**
- تحسين الذاكرة: تعطيل GPU (−60 MiB) + حد V8 heap
- المنافذ: أسماء البرامج و PID، تبويبان، بحث وفلتر
- مسح avahi مزدوج + avahi-resolve + nmblookup لأسماء الأجهزة
- سرعة الإنترنت: مقياسان دائريان متحركان، قيم حية
- ترقية الرخصة: **GPLv2 → GPLv3**

**إصلاحات أمنية:**
- `sudo -k` قبل التحقق من كلمة مرور الجلسة
- ثغرات قفل البرنامج: التعطيل/إعادة الضبط يتطلبان كلمة المرور
- Enter يُرسل النماذج في جميع الأقسام
- أيقونة Tray شفافة في الحزم: إصلاح مسار `process.resourcesPath`

### v1.0.0 — 2026-04

- الإصدار الأول: اكتشاف الأجهزة، التشخيص، المنافذ، السرعة، التقارير
- واجهة عربية/إنجليزية كاملة + RTL
- تحزيم: AppImage + DEB + RPM
- شاشة ترحيب عند الاستخدام الأول

---

## متى تستخدم أي إصدار؟

| السيناريو | الإصدار |
|-----------|:------:|
| أداة خفيفة وسريعة من الطرفية | **v0.1** |
| واجهة رسومية لاكتشاف وتشخيص الشبكة | **v1.0.0** |
| تحكم كامل بالشبكة (حجب/تحديد، قفل، Tray) | **v2.0.0** |
| العمل على سيرفر بدون واجهة رسومية | **v0.1** |
| حماية إضافية وقفل البرنامج | **v2.0.0** |
| التعرف على الأجهزة المحمولة (MAC العشوائي) | **v2.0.0** |

---

## الترخيص

| الإصدار | الرخصة |
|---------|--------|
| v0.1 | [GPLv2](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html) |
| v1.0.0 | [GPLv2](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html) |
| v2.0.0 | [GPLv3](https://www.gnu.org/licenses/gpl-3.0.html) |

Copyright © 2025-2026 **GNUTUX**

---

<p align="center">
  <strong>✨ لأن أدوات الشبكة يجب أن تكون حرة ومفتوحة المصدر ✨</strong><br>
  <sub>حرية الاختيار بين الطرفية والرسومية — لكل مستخدم ما يناسبه</sub>
</p>
