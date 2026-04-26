#!/usr/bin/env bash
# GT-IpNet — بناء تلقائي لجميع حزم GNU/Linux (AppImage + DEB + RPM)
# يدعم: rpmbuild أصلي، أو alien (DEB→RPM) على Debian/Ubuntu
# المطور: GNUTUX — https://github.com/SalehGNUTUX/GT-IpNet
set -uo pipefail

cd "$(dirname "$0")/.."

echo "══════════════════════════════════════════════════════════"
echo "   GT-IpNet — سكربت البناء التلقائي لـ GNU/Linux"
echo "══════════════════════════════════════════════════════════"

# ── التحقق من المتطلبات الأساسية ─────────────────────────────
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js غير مثبّت. يتطلب المشروع Node.js v18 أو أحدث."
    exit 1
fi
NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ إصدار Node.js ($NODE_VERSION) قديم جداً. يلزم v18 أو أحدث."
    exit 1
fi
echo "✅ Node.js: $(node -v)"
echo "✅ npm:     $(npm -v)"
echo ""

# ── تثبيت الاعتماديات ─────────────────────────────────────────
if [ ! -d node_modules ]; then
    echo "📦 تثبيت اعتماديات npm..."
    npm install
else
    echo "📦 اعتماديات npm موجودة — تخطي التثبيت"
fi
echo ""

# ── بناء electron-vite (renderer + main + preload) ─────────────
echo "🔨 electron-vite build..."
npx electron-vite build
echo ""

BUILT=()
FAILED=()

# ── دالة بناء هدف واحد (AppImage / deb) ──────────────────────
build_target() {
    local target="$1"
    echo "📦 جاري بناء: $target ..."
    if npx electron-builder --linux "$target" 2>&1; then
        echo "✅ نجح بناء: $target"
        BUILT+=("$target")
    else
        echo "⚠️  فشل بناء: $target"
        FAILED+=("$target")
    fi
    echo ""
}

# ── دالة بناء RPM (ذكية: rpmbuild أصلي ← alien+rpmbuild ← تعليمات) ──────
build_rpm() {
    echo "📦 جاري بناء: rpm ..."

    # ١. محاولة البناء الأصلي عبر electron-builder
    if command -v rpmbuild >/dev/null 2>&1; then
        echo "   → محاولة بناء RPM أصلي (electron-builder)..."
        if npx electron-builder --linux rpm 2>&1; then
            echo "✅ نجح بناء: rpm"
            BUILT+=("rpm")
            echo ""
            return
        fi
        echo "   ⚠ فشل electron-builder — الانتقال إلى alien..."
    else
        echo "   ⚠ rpmbuild غير مثبّت — الانتقال إلى alien..."
    fi

    # ٢. الحصول على DEB أولاً
    local deb_file
    deb_file=$(ls release/*.deb 2>/dev/null | head -1)

    if [ -z "$deb_file" ]; then
        echo "   ⚠ لا يوجد ملف DEB — سيُبنى DEB أولاً..."
        echo ""
        build_target deb
        deb_file=$(ls release/*.deb 2>/dev/null | head -1)
        if [ -z "$deb_file" ]; then
            echo "❌ تعذّر الحصول على DEB — لا يمكن إنشاء RPM"
            FAILED+=("rpm")
            echo ""
            return
        fi
    fi

    # ٣. alien -g (توليد مجلد) + تصحيح Summary + rpmbuild
    if command -v alien >/dev/null 2>&1 && command -v rpmbuild >/dev/null 2>&1; then
        local deb_name tmpdir pkgdir spec rpm_file outdir
        deb_name=$(basename "$deb_file")
        tmpdir=$(mktemp -d)
        outdir="$(pwd)/release"

        echo "   → توليد مجلد RPM من $deb_name ..."
        cp "$deb_file" "$tmpdir/"

        if ! (cd "$tmpdir" && fakeroot alien -r -g "$deb_name") 2>&1; then
            echo "❌ فشل alien في توليد المجلد"
            rm -rf "$tmpdir"
            FAILED+=("rpm")
            echo ""
            return
        fi

        spec=$(find "$tmpdir" -name "*.spec" | head -1)
        if [ -z "$spec" ]; then
            echo "❌ لم يُعثر على ملف .spec بعد alien -g"
            rm -rf "$tmpdir"
            FAILED+=("rpm")
            echo ""
            return
        fi

        # تصحيح حقل Summary الفارغ
        sed -i 's/^Summary:[[:space:]]*$/Summary: Network Diagnostic \& Management Tool for GNU\/Linux/' "$spec"

        pkgdir=$(dirname "$spec")
        echo "   → rpmbuild من $(basename "$pkgdir") ..."
        if (cd "$pkgdir" && fakeroot rpmbuild --buildroot="$pkgdir" -bb --target x86_64 "$(basename "$spec")") 2>&1; then
            rpm_file=$(find "$tmpdir" -name "*.rpm" | head -1)
            if [ -n "$rpm_file" ]; then
                cp "$rpm_file" "$outdir/"
                echo "✅ نجح بناء: rpm (alien + rpmbuild)"
                BUILT+=("rpm (alien)")
            else
                echo "❌ بُني RPM لكن لم يُعثر على الملف في $tmpdir"
                FAILED+=("rpm")
            fi
        else
            echo "❌ فشل rpmbuild"
            FAILED+=("rpm")
        fi
        rm -rf "$tmpdir"
        echo ""
        return
    fi

    # ٤. لا يوجد الأدوات اللازمة — تعليمات للمستخدم
    echo ""
    echo "❌ تعذّر بناء RPM. المطلوب على Debian/Ubuntu:"
    echo ""
    if ! command -v alien >/dev/null 2>&1; then
        echo "   sudo apt install alien rpm"
    else
        echo "   sudo apt install rpm   # يُوفّر rpmbuild"
    fi
    echo "   ثم أعد تشغيل: $0 rpm"
    FAILED+=("rpm")
    echo ""
}

# ── اختيار الأهداف وتنفيذها ───────────────────────────────────
TARGETS="${1:-all}"
case "$TARGETS" in
    all)
        build_target AppImage
        build_target deb
        build_rpm
        ;;
    appimage) build_target AppImage ;;
    deb)      build_target deb ;;
    rpm)      build_rpm ;;
    *)
        echo "الاستخدام: $0 [all|appimage|deb|rpm]"
        exit 1
        ;;
esac

# ── تقرير النتائج ─────────────────────────────────────────────
echo "══════════════════════════════════════════════════════════"
[ ${#BUILT[@]}  -gt 0 ] && echo "   ✅ نجح:  ${BUILT[*]}"
[ ${#FAILED[@]} -gt 0 ] && echo "   ❌ فشل:  ${FAILED[*]}"
echo "══════════════════════════════════════════════════════════"
echo ""
echo "الحزم الجاهزة في مجلد release/:"
ls -lh release/*.AppImage release/*.deb release/*.rpm 2>/dev/null \
  || echo "   (لا توجد مخرجات)"
echo ""
echo "💡 تثبيت DEB:     sudo dpkg -i release/*.deb"
echo "💡 تثبيت RPM:     sudo rpm -i release/*.rpm"
echo "💡 تشغيل AppImage: chmod +x release/*.AppImage && ./release/*.AppImage"
echo ""
echo "🌐 المشروع: https://github.com/SalehGNUTUX/GT-IpNet"

[ ${#BUILT[@]} -eq 0 ] && exit 1 || exit 0
