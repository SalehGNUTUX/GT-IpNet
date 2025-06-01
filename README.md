### 📜 ملف README.md (ثنائي اللغة)


# GT-IpNet - متحكم متقدم في الشبكة | Advanced Network Controller

![GPLv2 License](https://img.shields.io/badge/license-GPLv2-blue)
![Latest Release](https://img.shields.io/badge/version-0.1-green)

<img src="https://github.com/SalehGNUTUX/GT-IpNet/raw/main/screenshots/main_menu.png" width="400" alt="واجهة GT-IpNet">

إليك لائحة المزايا مصنفة لكل لغة على حدة مع رموز تعبيرية جذابة:

### 🌟 المميزات الرئيسية (بالعربية)

🔍 **مسح الشبكة المتقدم**
- ⚡ مسح سريع باستخدام `arp-scan`
- 🔎 مسح تفصيلي باستخدام `nmap`
- 🌐 كشف تلقائي لواجهات الشبكة

🌍 **دعم متعدد اللغات**
- 🔄 تبديل لغوي فوري (عربي/إنجليزي)
- 🎨 واجهة مستخدم ملونة
- 📋 قوائم مرقمة سهلة الاستخدام

📶 **تشخيص الشبكة**
- 📡 فحص إعدادات IP والروتينج
- 🔌 اختبار اتصال DNS
- 🛣️ تتبع مسار الحزم (traceroute)

⚙️ **التشغيل والتوافق**
- 🐧 يدعم ديبيان/أرش/فيدورا
- 📦 نسخة محمولة (AppImage)
- 🔄 لا يحتاج لتثبيت دائم

🚀 **اختبارات الأداء**
- ⏱️ قياس سرعة الإنترنت
- 🏓 اختبار Ping للاستجابة
- 📊 تحليل استقرار الاتصال



## 📥 طرق التثبيت

### 1. AppImage (موصى به)
```bash
wget https://github.com/SalehGNUTUX/GT-IpNet/releases/download/GT-IpNet.V0.1/GT-IpNet_Network_Controller-V0.1-x86_64.AppImage
```
```bash
chmod +x GT-IpNet_Network_Controller-V0.1-x86_64.AppImage
```
```bash
./GT-IpNet_Network_Controller-V0.1-x86_64.AppImage
```

### 2. من المصدر
```bash
git clone https://github.com/SalehGNUTUX/GT-IpNet.git
```
```bash
cd GT-IpNet
```
```bash
chmod +x GT-IpNet
```
```bash
sudo ./GT-IpNet
```

## 🛠 المتطلبات
| الأداة          | التثبيت على ديبيان       | التثبيت على أرش        |
|----------------|-------------------------|-----------------------|
| `arp-scan`     | `sudo apt install arp-scan` | `sudo pacman -S arp-scan` |
| `nmap`         | `sudo apt install nmap` | `sudo pacman -S nmap` |

---

# GT-IpNet - Advanced Network Controller

### 🌟 Key Features (In English)

🔍 **Advanced Network Scanning**
- ⚡ Quick scan using `arp-scan`
- 🔎 Detailed scan with `nmap`
- 🌐 Automatic interface detection

🌍 **Multilingual Support**
- 🔄 Instant language switching (EN/AR)
- 🎨 Colorful UI with emojis
- 📋 Numbered menus for easy navigation

📶 **Network Diagnostics**
- 📡 IP configuration & routing check
- 🔌 DNS connectivity testing
- 🛣️ Packet route tracing (traceroute)

⚙️ **Operation & Compatibility**
- 🐧 Supports Debian/Arch/Fedora
- 📦 Portable AppImage version
- 🔄 No permanent installation needed

🚀 **Performance Tests**
- ⏱️ Internet speed measurement
- 🏓 Ping latency testing
- 📊 Connection stability analysis

✨ **Special Highlights**
- 🔐 Works with user permissions
- 🤖 ARM/x86 architecture support
- 🆓 Open-source (GPLv2 licensed)

## 📥 Installation Methods

### 1. AppImage (Recommended)
```bash
wget https://github.com/SalehGNUTUX/GT-IpNet/releases/download/GT-IpNet.V0.1/GT-IpNet_Network_Controller-V0.1-x86_64.AppImage
```
```bash
chmod +x GT-IpNet_Network_Controller-V0.1-x86_64.AppImage
```
```bash
./GT-IpNet_Network_Controller-V0.1-x86_64.AppImage
```

### 2. From Source
```bash
git clone https://github.com/SalehGNUTUX/GT-IpNet.git
```
```bash
cd GT-IpNet
```
```bash
chmod +x GT-IpNet
```
```bash
sudo ./GT-IpNet
```

## 🛠 Requirements
| Tool           | Debian/Ubuntu          | Arch Linux         |
|----------------|------------------------|--------------------|
| `arp-scan`     | `sudo apt install arp-scan` | `sudo pacman -S arp-scan` |
| `nmap`         | `sudo apt install nmap` | `sudo pacman -S nmap` |
```

---
```
### 📄 ملف INSTALL.md (إرشادات التثبيت التفصيلية)


# دليل التثبيت الكامل لـ GT-IpNet

## 1. التثبيت عبر AppImage
الطريقة الأسهل للاستخدام:

# تنزيل الملف
```
wget https://github.com/SalehGNUTUX/GT-IpNet/releases/download/GT-IpNet.V0.1/GT-IpNet_Network_Controller-V0.1-x86_64.AppImage
```
# جعله قابلاً للتنفيذ
```
chmod +x GT-IpNet_Network_Controller-V0.1-x86_64.AppImage
```
# التشغيل
```
./GT-IpNet_Network_Controller-V0.1-x86_64.AppImage
```

## 2. التثبيت من المصدر
للمطورين أو الراغبين في التعديل:
```bash
git clone https://github.com/SalehGNUTUX/GT-IpNet.git
```
```bash
cd GT-IpNet
```
```bash
chmod +x GT-IpNet
```
```bash
sudo ./GT-IpNet
```

## 📦 تثبيت التبعيات حسب التوزيعة

### 🐧 ديبيان/أوبنتو
```bash
sudo apt update
```
```bash
sudo apt install -y arp-scan nmap iproute2 dnsutils
```

### 🔴 فيدورا/ر هيل
```bash
sudo dnf install -y arp-scan nmap iproute bind-utils
```

### 🐉 أرش لينكس/مانجارو
```bash
sudo pacman -Sy arp-scan nmap iproute2 bind-tools
```

### 🍎 macOS (باستخدام Homebrew)
```bash
brew install arp-scan nmap iproute2mac bind
```

# --------------------------------------------------

# Complete GT-IpNet Installation Guide

## 1. AppImage Installation
Easiest method for end-users:

# Download
```bash
wget https://github.com/SalehGNUTUX/GT-IpNet/releases/download/GT-IpNet.V0.1/GT-IpNet_Network_Controller-V0.1-x86_64.AppImage
```
# Make executable
```bash
chmod +x GT-IpNet_Network_Controller-V0.1-x86_64.AppImage
```
# Run
```bash
./GT-IpNet_Network_Controller-V0.1-x86_64.AppImage
```

## 2. Source Installation
For developers or contributors:
```bash
git clone https://github.com/SalehGNUTUX/GT-IpNet.git
```
```bash
cd GT-IpNet
```
```bash
chmod +x GT-IpNet
```
```bash
sudo ./GT-IpNet
```

## 📦 Dependency Installation

### 🐧 Debian/Ubuntu
```bash
sudo apt update
sudo apt install -y arp-scan nmap iproute2 dnsutils speedtest-cli
```

### 🔴 Fedora/RHEL
```bash
sudo dnf install -y arp-scan nmap iproute bind-utils speedtest-cli
```

### 🐉 Arch Linux/Manjaro
```bash
sudo pacman -Sy arp-scan nmap iproute2 bind-tools speedtest-cli
```

### 🍎 macOS (Using Homebrew)
```bash
brew install arp-scan nmap iproute2mac bind speedtest-cli
```


---

### 📑 ملف DOCUMENTATION.md (التوثيق الفني)


# 📘 التوثيق الفني لـ GT-IpNet


## 🛠 الأوامر الأساسيةالخيار	الوصف	مثال الاستخدام
```bash

--scan    | مسح سريع للشبكة     | GT-IpNet --scan
--report  |إنشاء تقرير فوري       |	GT-IpNet --report
--lang ar |	التشغيل باللغة العربية   | GT-IpNet --lang ar
--help    |	عرض المساعدة        | GT-IpNet --help
```
## 🔍 أمثلة استخدام
1. مسح الشبكة وحفظ النتائج:
```bash
./GT-IpNet_Network_Controller-V0.1-x86_64.AppImage --scan > scan_results.txt
```

2. تشغيل الواجهة بلغة محددة:
```bash
LANG=ar ./GT-IpNet
```

# 📘 GT-IpNet Technical Documentation

## File Structure

```bash

## 🛠 Core Commands
| Option      | Description            | Example               |
|------------|------------------------|-----------------------|
| `--scan`   | Quick network scan     | `GT-IpNet --scan`     |
| `--report` | Generate instant report| `GT-IpNet --report`   |

## 🔍 Usage Examples
1. Scan network and save results:
```bash
./GT-IpNet_Network_Controller-V0.1-x86_64.AppImage --scan > scan_results.txt
```

2. Launch with specific language:
```bash
LANG=ar ./GT-IpNet
```
````

هذا التوثيق يغطي:
1. جميع طرق التثبيت (AppImage + مصدر)
2. المتطلبات لكل توزيعة رئيسية
3. هيكل الملفات والمخرجات
4. أمثلة استخدام عملية
5. دعم كامل للغتين العربية والإنجليزية
