#!/bin/bash
# GT-IpNet - Network Diagnostic Tool
# الإصدار: 0.1 (GPLv2)
# المطور: gnutux

# === إعدادات اللغة ===
detect_language() {
    system_lang="${LANG%_*}"
    if [ "$system_lang" = "ar" ]; then
        lang="ar"
    else
        lang="en"
    fi

    if [ -f ~/.gtipnet_lang ]; then
        lang=$(cat ~/.gtipnet_lang)
    fi
}

switch_language() {
    if [ "$lang" = "ar" ]; then
        lang="en"
    else
        lang="ar"
    fi
    echo "$lang" > ~/.gtipnet_lang
    echo -e "\033[1;32m✓ $(tr "language_changed")\033[0m"
    sleep 1
}

tr() {
    key="$1"
    case "$lang" in
        "ar")
            case "$key" in
                "title") echo "GT-IpNet - أداة تشخيص الشبكة" ;;
                "author") echo "بواسطة gnutux" ;;
                "license") echo "رخصة GPL الإصدار الثاني" ;;
                "menu_network") echo "1) الفحص الأساسي للشبكة" ;;
                "menu_dns") echo "2) فحص DNS" ;;
                "menu_speed") echo "3) اختبار سرعة الإنترنت" ;;
                "menu_discovery") echo "4) اكتشاف الأجهزة" ;;
                "menu_ports") echo "5) فحص المنافذ" ;;
                "menu_trace") echo "6) تتبع المسار" ;;
                "menu_ping") echo "7) اختبار Ping" ;;
                "menu_lang") echo "8) تبديل اللغة ($lang)" ;;
                "menu_exit") echo "0) خروج" ;;
                "prompt_choice") echo "اختر خيارًا:" ;;
                "language_changed") echo "تم تغيير اللغة إلى $lang" ;;
                "scan_choice") echo "اختر طريقة المسح:" ;;
                "scan_arp") echo "1) مسح سريع (arp-scan)" ;;
                "scan_nmap") echo "2) مسح متقدم (nmap)" ;;
                "scan_back") echo "0) رجوع" ;;
                "interface_select") echo "اختر واجهة الشبكة:" ;;
                "dns_title") echo "فحص DNS" ;;
                "speed_title") echo "اختبار سرعة الإنترنت" ;;
                "ports_title") echo "فحص المنافذ" ;;
                "trace_title") echo "تتبع المسار" ;;
                "ping_title") echo "اختبار Ping" ;;
                "invalid_option") echo "خيار غير صحيح!" ;;
                *) echo "$key" ;;
            esac
            ;;
        *)
            case "$key" in
                "title") echo "GT-IpNet - Network Diagnostic Tool" ;;
                "author") echo "by gnutux" ;;
                "license") echo "GPL version 2 license" ;;
                "menu_network") echo "1) Basic Network Check" ;;
                "menu_dns") echo "2) DNS Check" ;;
                "menu_speed") echo "3) Internet Speed Test" ;;
                "menu_discovery") echo "4) Network Device Discovery" ;;
                "menu_ports") echo "5) Port Scan" ;;
                "menu_trace") echo "6) Route Tracing" ;;
                "menu_ping") echo "7) Ping Test" ;;
                "menu_lang") echo "8) Switch Language ($lang)" ;;
                "menu_exit") echo "0) Exit" ;;
                "prompt_choice") echo "Choose an option:" ;;
                "language_changed") echo "Language changed to $lang" ;;
                "scan_choice") echo "Choose scan method:" ;;
                "scan_arp") echo "1) Quick scan (arp-scan)" ;;
                "scan_nmap") echo "2) Advanced scan (nmap)" ;;
                "scan_back") echo "0) Back" ;;
                "interface_select") echo "Select network interface:" ;;
                "dns_title") echo "DNS Check" ;;
                "speed_title") echo "Internet Speed Test" ;;
                "ports_title") echo "Port Scan" ;;
                "trace_title") echo "Route Tracing" ;;
                "ping_title") echo "Ping Test" ;;
                "invalid_option") echo "Invalid option!" ;;
                *) echo "$key" ;;
            esac
            ;;
    esac
}

# === عرض الشعار ===
show_banner() {
    echo -e "\033[1;36m"
cat << "EOF"
  ______   ________     ______            __    __              __
 /      \ /        |   /      |          /  \  /  |            /  |
/$$$$$$  |$$$$$$$$/    $$$$$$/   ______  $$  \ $$ |  ______   _$$ |_
$$ | _$$/    $$ | ______ $$ |   /      \ $$$  \$$ | /      \ / $$   |
$$ |/    |   $$ |/      |$$ |  /$$$$$$  |$$$$  $$ |/$$$$$$  |$$$$$$/
$$ |$$$$ |   $$ |$$$$$$/ $$ |  $$ |  $$ |$$ $$ $$ |$$    $$ |  $$ | __
$$ \__$$ |   $$ |       _$$ |_ $$ |__$$ |$$ |$$$$ |$$$$$$$$/   $$ |/  |
$$    $$/    $$ |      / $$   |$$    $$/ $$ | $$$ |$$       |  $$  $$/
 $$$$$$/     $$/       $$$$$$/ $$$$$$$/  $$/   $$/  $$$$$$$/    $$$$/
                               $$ |
                               $$ |
                               $$/
EOF
echo -e "\033[0m"

echo -e "\033[1;36m$(tr "title") | $(tr "author")"
echo "$(tr "license")"
echo "==========================================="

}

# === اكتشاف واجهات الشبكة ===
detect_interfaces() {
    interfaces=($(ip -o link show | awk -F': ' '{print $2}' | grep -v lo))
    if [ ${#interfaces[@]} -eq 0 ]; then
        if [ "$lang" = "ar" ]; then
            echo -e "\033[1;31m❌ لم يتم العثور على واجهات شبكة!\033[0m"
        else
            echo -e "\033[1;31m❌ No network interfaces found!\033[0m"
        fi
        exit 1
    fi
}

select_interface() {
    if [ ${#interfaces[@]} -gt 1 ]; then
        echo -e "\n\033[1;33m$(tr "interface_select")\033[0m"
        for i in "${!interfaces[@]}"; do
            echo "$(($i+1))) ${interfaces[$i]}"
        done

        while true; do
            read -p "$(tr "prompt_choice") " iface_choice
            if [[ "$iface_choice" =~ ^[0-9]+$ ]] && [ "$iface_choice" -ge 1 ] && [ "$iface_choice" -le ${#interfaces[@]} ]; then
                selected_iface="${interfaces[$(($iface_choice-1))]}"
                break
            else
                echo -e "\033[1;31m❌ $(tr "invalid_option")\033[0m"
            fi
        done
    else
        selected_iface="${interfaces[0]}"
    fi
}

# === إنشاء تقارير ===
REPORT_DIR="$HOME/GT-IpNet_Reports"
mkdir -p "$REPORT_DIR"
current_date=$(date +"%Y-%m-%d_%H-%M-%S")
report_file="$REPORT_DIR/network_report_$current_date.txt"

add_to_report() {
    echo -e "\n$1" >> "$report_file"
    echo "--------------------------------" >> "$report_file"
    eval "$2" >> "$report_file" 2>&1
}

# === فحص الشبكة الأساسي ===
basic_network_check() {
    if [ "$lang" = "ar" ]; then
        echo -e "\n\033[1;34m🔧 الفحص الأساسي للشبكة\033[0m"
    else
        echo -e "\n\033[1;34m🔧 Basic Network Check\033[0m"
    fi

    echo -e "\n\033[1;33m🌐 $(tr "interface_select"): $selected_iface\033[0m"
    ip -br -c addr show dev "$selected_iface"
    add_to_report "Network Interface $selected_iface" "ip -br -c addr show dev $selected_iface"

    echo -e "\n\033[1;33m🗺️ $(if [ "$lang" = "ar" ]; then echo "جدول التوجيه"; else echo "Routing Table"; fi)\033[0m"
    ip route
    add_to_report "Routing Table" "ip route"
}

# === فحص DNS ===
dns_check() {
    echo -e "\n\033[1;34m🔍 $(tr "dns_title")\033[0m"

    if command -v dig &>/dev/null; then
        echo -e "\n\033[1;33m🔎 DNS Resolution (dig example.com):\033[0m"
        dig example.com +short
        add_to_report "DNS Resolution" "dig example.com +short"
    else
        echo -e "\n\033[1;33m🔎 DNS Resolution (nslookup example.com):\033[0m"
        nslookup example.com
        add_to_report "DNS Resolution" "nslookup example.com"
    fi

    echo -e "\n\033[1;33m📋 /etc/resolv.conf:\033[0m"
    cat /etc/resolv.conf
    add_to_report "DNS Config" "cat /etc/resolv.conf"
}

# === اختبار السرعة ===
speed_test() {
    echo -e "\n\033[1;34m🚀 $(tr "speed_title")\033[0m"

    if command -v speedtest-cli &>/dev/null; then
        echo -e "\033[1;33m⏳ $(if [ "$lang" = "ar" ]; then echo "جارِ قياس سرعة الإنترنت..."; else echo "Measuring internet speed..."; fi)\033[0m"
        speedtest-cli --simple
        add_to_report "Speed Test" "speedtest-cli --simple"
    elif command -v fast &>/dev/null; then
        echo -e "\033[1;33m⏳ $(if [ "$lang" = "ar" ]; then echo "جارِ قياس السرعة (fast.com)..."; else echo "Measuring speed (fast.com)..."; fi)\033[0m"
        fast
        add_to_report "Speed Test" "fast"
    else
        echo -e "\033[1;31m❌ $(if [ "$lang" = "ar" ]; then echo "أدوات قياس السرعة غير مثبتة"; else echo "Speed test tools not installed"; fi)\033[0m"
        echo "sudo apt install speedtest-cli"
    fi
}

# === فحص المنافذ ===
port_scan() {
    echo -e "\n\033[1;34m🔒 $(tr "ports_title")\033[0m"

    if command -v netstat &>/dev/null; then
        echo -e "\033[1;33m📊 $(if [ "$lang" = "ar" ]; then echo "الاتصالات النشطة (netstat):"; else echo "Active Connections (netstat):"; fi)\033[0m"
        netstat -tulnp
        add_to_report "Active Connections" "netstat -tulnp"
    elif command -v ss &>/dev/null; then
        echo -e "\033[1;33m📊 $(if [ "$lang" = "ar" ]; then echo "الاتصالات النشطة (ss):"; else echo "Active Connections (ss):"; fi)\033[0m"
        ss -tulnp
        add_to_report "Active Connections" "ss -tulnp"
    else
        echo -e "\033[1;31m❌ $(if [ "$lang" = "ar" ]; then echo "لا توجد أدوات لفحص المنافذ"; else echo "No port scanning tools found"; fi)\033[0m"
    fi
}

# === تتبع المسار ===
trace_route() {
    echo -e "\n\033[1;34m🛣️ $(tr "trace_title")\033[0m"

    if command -v mtr &>/dev/null; then
        echo -e "\033[1;33m📍 $(if [ "$lang" = "ar" ]; then echo "تتبع المسار (mtr):"; else echo "Route Tracing (mtr):"; fi)\033[0m"
        mtr -r -c 3 8.8.8.8
        add_to_report "MTR Trace" "mtr -r -c 3 8.8.8.8"
    elif command -v traceroute &>/dev/null; then
        echo -e "\033[1;33m📍 $(if [ "$lang" = "ar" ]; then echo "تتبع المسار (traceroute):"; else echo "Route Tracing (traceroute):"; fi)\033[0m"
        traceroute 8.8.8.8
        add_to_report "Traceroute" "traceroute 8.8.8.8"
    elif command -v tracepath &>/dev/null; then
        echo -e "\033[1;33m📍 $(if [ "$lang" = "ar" ]; then echo "تتبع المسار (tracepath):"; else echo "Route Tracing (tracepath):"; fi)\033[0m"
        tracepath 8.8.8.8
        add_to_report "Tracepath" "tracepath 8.8.8.8"
    else
        echo -e "\033[1;31m❌ $(if [ "$lang" = "ar" ]; then echo "لا توجد أدوات لتتبع المسار"; else echo "No route tracing tools found"; fi)\033[0m"
    fi
}

# === اختبار Ping ===
ping_test() {
    echo -e "\n\033[1;34m📶 $(tr "ping_title")\033[0m"
    echo -e "\033[1;33m🔄 $(if [ "$lang" = "ar" ]; then echo "اختبار Ping لـ 8.8.8.8 (4 حزم):"; else echo "Pinging 8.8.8.8 (4 packets):"; fi)\033[0m"
    ping -c 4 8.8.8.8
    add_to_report "Ping Test" "ping -c 4 8.8.8.8"
}

# === اكتشاف الأجهزة ===
device_discovery() {
    while true; do
        echo -e "\n\033[1;34m🕵️ $(tr "scan_choice")\033[0m"
        echo "1) $(tr "scan_arp")"
        echo "2) $(tr "scan_nmap")"
        echo "0) $(tr "scan_back")"

        read -p "$(tr "prompt_choice") " scan_choice

        case $scan_choice in
            1)
                if command -v arp-scan &>/dev/null; then
                    echo -e "\n\033[1;33m🔍 $(if [ "$lang" = "ar" ]; then echo "جارٍ المسح باستخدام arp-scan..."; else echo "Running arp-scan..."; fi)\033[0m"
                    sudo arp-scan --interface="$selected_iface" --localnet
                    add_to_report "ARP Scan" "sudo arp-scan --interface=$selected_iface --localnet"
                else
                    echo -e "\033[1;31m❌ $(if [ "$lang" = "ar" ]; then echo "أداة arp-scan غير مثبتة"; else echo "arp-scan tool not installed"; fi)\033[0m"
                    echo "sudo apt install arp-scan"
                fi
                break
                ;;
            2)
                if command -v nmap &>/dev/null; then
                    echo -e "\n\033[1;33m🔍 $(if [ "$lang" = "ar" ]; then echo "جارٍ المسح باستخدام nmap..."; else echo "Running nmap scan..."; fi)\033[0m"
                    sudo nmap -sn -e "$selected_iface" 192.168.1.0/24
                    add_to_report "Nmap Scan" "sudo nmap -sn -e $selected_iface 192.168.1.0/24"
                else
                    echo -e "\033[1;31m❌ $(if [ "$lang" = "ar" ]; then echo "أداة nmap غير مثبتة"; else echo "nmap tool not installed"; fi)\033[0m"
                    echo "sudo apt install nmap"
                fi
                break
                ;;
            0) break ;;
            *) echo -e "\033[1;31m❌ $(tr "invalid_option")\033[0m" ;;
        esac
    done
}

# === القائمة الرئيسية ===
main_menu() {
    while true; do
        clear
        show_banner

        echo -e "\n\033[1;35m📡 $(if [ "$lang" = "ar" ]; then echo "القائمة الرئيسية"; else echo "Main Menu"; fi)\033[0m"
        echo "$(tr "menu_network")"
        echo "$(tr "menu_dns")"
        echo "$(tr "menu_speed")"
        echo "$(tr "menu_discovery")"
        echo "$(tr "menu_ports")"
        echo "$(tr "menu_trace")"
        echo "$(tr "menu_ping")"
        echo "$(tr "menu_lang")"
        echo "$(tr "menu_exit")"

        read -p "$(tr "prompt_choice") " choice

        case $choice in
            1) basic_network_check ;;
            2) dns_check ;;
            3) speed_test ;;
            4) device_discovery ;;
            5) port_scan ;;
            6) trace_route ;;
            7) ping_test ;;
            8) switch_language ;;
            0)
                echo -e "\n\033[1;32m✓ $(if [ "$lang" = "ar" ]; then echo "تم حفظ التقرير في:"; else echo "Report saved to:"; fi) $report_file\033[0m"
                echo -e "\033[1;35m🎉 $(if [ "$lang" = "ar" ]; then echo "شكرًا لاستخدامك GT-IpNet!"; else echo "Thanks for using GT-IpNet!"; fi)\033[0m"
                exit 0
                ;;
            *) echo -e "\033[1;31m❌ $(tr "invalid_option")\033[0m" ;;
        esac

        read -p "$(if [ "$lang" = "ar" ]; then echo "اضغط Enter للمتابعة..."; else echo "Press Enter to continue..."; fi)"
    done
}

# === بدء البرنامج ===
detect_language
detect_interfaces
select_interface

if [ "$EUID" -ne 0 ]; then
    echo -e "\033[1;33m🔒 $(if [ "$lang" = "ar" ]; then echo "بعض الميزات تتطلب صلاحيات root. جاري التشغيل باستخدام sudo..."; else echo "Some features require root privileges. Running with sudo..."; fi)\033[0m"
    exec sudo "$0" "$@"
fi

main_menu
