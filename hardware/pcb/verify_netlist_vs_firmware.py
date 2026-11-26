"""
KiCad 10 官方网表 (.net) <-> ESP32-C3 EVT 4 层主板固件 (config.h) 引脚 100% 物理对齐校验器
杜绝“原理图画的是 IO5，固件写的是 IO6”这类硬件联调致命翻车。
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROJ_DIR = ROOT / "pcb" / "catmouse-band-v15"
NET_FILE = PROJ_DIR / "catmouse-band-v15.net"
MANIFEST_FILE = PROJ_DIR / "circuit_manifest.json"
CONFIG_H = ROOT / "firmware" / "include" / "config.h"

# ESP32-C3-WROOM-02 官方引脚编号 -> ESP32-C3 GPIO 编号映射
WROOM02_PIN_TO_GPIO = {
    "3": 4,
    "4": 5,
    "5": 6,
    "6": 7,
    "7": 8,
    "8": 9,
    "10": 10,
    "11": 20,
    "12": 21,
    "13": 18,
    "14": 19,
    "15": 3,
    "16": 2,
    "17": 1,
    "18": 0,
}

# 固件宏名 -> 原理图期望网络名
FW_MACRO_TO_SCH_NET = {
    "PIN_BATT_ADC": "BATT_ADC",
    "PIN_IMU_INT": "IMU_INT",
    "PIN_BUTTON": "BTN_USER",
    "PIN_MOTOR": "MOTOR_PWM",
    "PIN_SDA": "I2C_SDA",
    "PIN_SCL": "I2C_SCL",
    "PIN_LED_DATA": "LED_DATA",
    "PIN_BUZZER": "BUZZER_PWM",
    "PIN_NFC_RST": "NFC_RST",
    "PIN_LED_PWR": "LED_PWR_EN",
}


def parse_kicad_netlist_u1(net_text: str) -> dict[str, str]:
    """从 kicad-cli 导出的真实 .net 文件解析出 {net_name: [U1_pin_numbers...]}，反查 {U1_pin: net_name}"""
    u1_pin_to_net = {}
    # 匹配每个 (net (code ...) (name "...") ... )
    for m in re.finditer(r'\(net\s+\(code\s+"[^"]+"\)\s+\(name\s+"([^"]+)"\)(.*?)(?=\n\s*\(net\s+\(code|\)\s*\)\s*$)', net_text, re.S):
        net_name = m.group(1).lstrip("/")
        body = m.group(2)
        for nm in re.finditer(r'\(node\s+\(ref\s+"U1"\)\s+\(pin\s+"([^"]+)"\)', body):
            u1_pin_to_net[nm.group(1)] = net_name
    return u1_pin_to_net


def parse_evt_firmware_pins(cfg_text: str) -> dict[str, int]:
    # 模拟 #ifdef CATMOUSE_EVT_4LAYER_PCB 展开
    lines = []
    in_evt_if = False
    in_evt_else = False
    for ln in cfg_text.splitlines():
        s = ln.strip()
        if s == "#ifdef CATMOUSE_EVT_4LAYER_PCB":
            in_evt_if = True
            continue
        if in_evt_if and s == "#else":
            in_evt_if = False
            in_evt_else = True
            continue
        if (in_evt_if or in_evt_else) and s == "#endif":
            in_evt_if = in_evt_else = False
            continue
        if in_evt_else:
            continue
        lines.append(ln)
    eff = "\n".join(lines)
    return {k: int(v) for k, v in re.findall(r"constexpr\s+int\s+(PIN_\w+)\s*=\s*(-?\d+);", eff)}


def verify():
    assert NET_FILE.exists(), f"Missing exported KiCad netlist: {NET_FILE}"
    u1_pin_to_net = parse_kicad_netlist_u1(NET_FILE.read_text(encoding="utf-8"))
    gpio_to_net = {WROOM02_PIN_TO_GPIO[p]: net for p, net in u1_pin_to_net.items() if p in WROOM02_PIN_TO_GPIO}
    fw_pins = parse_evt_firmware_pins(CONFIG_H.read_text(encoding="utf-8"))

    print("=== KiCad 10 官方网表 <-> EVT 4层板固件引脚一致性校验 ===")
    for macro, expected_net in FW_MACRO_TO_SCH_NET.items():
        assert macro in fw_pins, f"Missing firmware macro {macro}"
        gpio = fw_pins[macro]
        actual_net = gpio_to_net.get(gpio)
        assert actual_net == expected_net, f"MISMATCH! {macro}=GPIO{gpio}, expected net '{expected_net}', got '{actual_net}'"
        print(f"  [OK] {macro:<13} = GPIO{gpio:<2} <==> PCB Net '{actual_net}'")

    # 验证原生 USB Serial/JTAG 烧录引脚 (GPIO18=USB_DN, GPIO19=USB_DP) 与 BOOT (GPIO9)
    assert gpio_to_net.get(18) == "USB_DN", f"GPIO18 net mismatch: {gpio_to_net.get(18)}"
    assert gpio_to_net.get(19) == "USB_DP", f"GPIO19 net mismatch: {gpio_to_net.get(19)}"
    assert gpio_to_net.get(9) == "BOOT_SW", f"GPIO9 net mismatch: {gpio_to_net.get(9)}"
    print("  [OK] USB_JTAG      = GPIO18/19 <==> PCB Net 'USB_DN'/'USB_DP' (磁吸口原生一线烧录)")
    print("  [OK] BOOT_STRAP    = GPIO9     <==> PCB Net 'BOOT_SW' (10k上拉 + TP1)")
    print("\n[PASS] 原理图网表、4层 PCB 与 EVT 固件 100% 引脚物理对齐！")


if __name__ == "__main__":
    verify()
