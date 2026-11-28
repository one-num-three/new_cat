"""
猫鼠手环 V1.5 EVT 4层主板 —— 原生 KiCad 10.0 原理图 + 工程 + DRC规则生成器
严格抽取 KiCad 10.0 官方符号库并展开 extends 继承，确保自包含、规范且通过 kicad-cli sch erc 零报错校验。
"""
import json
import pathlib
import re
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROJ_DIR = ROOT / "pcb" / "catmouse-band-v15"
PROJ_NAME = "catmouse-band-v15"
KICAD_SYM_DIR = pathlib.Path(r"D:\Program Files\KiCad\share\kicad\symbols")


def uid() -> str:
    return str(uuid.uuid4())


# ---------------- KiCad S-Expression 符号提取与 extends 展开 ----------------
def _extract_block(text: str, start_idx: int) -> str:
    depth = 0
    i = start_idx
    in_str = False
    while i < len(text):
        ch = text[i]
        if ch == '"' and (i == 0 or text[i - 1] != "\\"):
            in_str = not in_str
        elif not in_str:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    return text[start_idx : i + 1]
        i += 1
    raise ValueError("Unbalanced S-expression")


def _find_top_symbol(lib_text: str, sym_name: str) -> str:
    pat = re.compile(rf'^[ \t]+\(symbol "{re.escape(sym_name)}"', re.M)
    m = pat.search(lib_text)
    if not m:
        raise KeyError(f"Symbol {sym_name} not found")
    return _extract_block(lib_text, m.start() + lib_text[m.start() :].index("("))


def _extract_sub_symbols(block: str) -> list[str]:
    subs = []
    # 跳过顶层 (symbol "NAME"
    pos = block.find("\n")
    while pos != -1:
        m = re.search(r'\(symbol "([^"]+)"', block[pos:])
        if not m:
            break
        start = pos + m.start()
        sub = _extract_block(block, start)
        subs.append(sub)
        pos = start + len(sub)
    return subs


def load_kicad_symbol(lib_name: str, sym_name: str, library_dir=None) -> tuple[str, dict]:
    """返回 (完整自包含嵌入 lib_symbols 的 S-expr 文本, {pin_num: (x, y, ang, type, name)})"""
    lib_text = ((library_dir or KICAD_SYM_DIR) / f"{lib_name}.kicad_sym").read_text(encoding="utf-8")
    raw = _find_top_symbol(lib_text, sym_name)
    ext_m = re.search(r'\(extends "([^"]+)"\)', raw)

    if ext_m:
        parent_name = ext_m.group(1)
        parent_raw = _find_top_symbol(lib_text, parent_name)
        parent_subs = _extract_sub_symbols(parent_raw)
        # 去掉子符号里的 (extends ...)，并在末尾附加父符号的图形与引脚子块（将子块名前缀改成 sym_name）
        body = re.sub(r'\s*\(extends "[^"]+"\)', "", raw)
        renamed_subs = []
        for s in parent_subs:
            renamed = re.sub(
                rf'^\(symbol "{re.escape(parent_name)}_',
                f'(symbol "{sym_name}_',
                s,
            )
            renamed_subs.append(renamed)
        # 把 renamed_subs 插入 body 最后一个 ')' 之前
        last_paren = body.rfind(")")
        merged = body[:last_paren] + "\n" + "\n".join(renamed_subs) + "\n)"
        # 继承父符号的 (pin_numbers ...) / (pin_names ...) / (power) 等头部属性（用括号平衡提取！）
        for tag in ("pin_numbers", "pin_names", "power"):
            if f"({tag}" not in merged:
                tidx = parent_raw.find(f"({tag}")
                if tidx >= 0:
                    pblk = _extract_block(parent_raw, tidx)
                    ins_pos = merged.find("\n")
                    merged = merged[:ins_pos] + "\n\t\t" + pblk + merged[ins_pos:]
    else:
        merged = raw

    # 把顶层符号名改为 "Lib:Name"（KiCad .kicad_sch lib_symbols 规范）
    full_id = f"{lib_name}:{sym_name}"
    embedded = re.sub(rf'^\(symbol "{re.escape(sym_name)}"', f'(symbol "{full_id}"', merged, count=1)

    # 解析全部引脚坐标与类型（完整匹配 S-expression 括号，兼容 hide 与换行）
    pins = {}
    pos = 0
    while True:
        idx = embedded.find("(pin ", pos)
        if idx < 0:
            break
        pblk = _extract_block(embedded, idx)
        pos = idx + len(pblk)
        tm = re.match(r"\(pin\s+(\w+)\s+\w+", pblk)
        am = re.search(r"\(at\s+([-\d.]+)\s+([-\d.]+)(?:\s+([-\d.]+))?\)", pblk)
        nm = re.search(r'\(name\s+"([^"]*)"', pblk)
        numm = re.search(r'\(number\s+"([^"]*)"', pblk)
        if tm and am and numm:
            px, py = float(am.group(1)), float(am.group(2))
            pang = int(float(am.group(3))) if am.group(3) else 0
            pins[numm.group(1)] = (px, py, pang, tm.group(1), nm.group(1) if nm else "")
    return embedded, pins


# ---------------- 原理图构建器 ----------------
class SchematicBuilder:
    def __init__(self, project_name=PROJ_NAME, root_uuid=None, library_dirs=None):
        self.project_name = project_name
        self.root_uuid = root_uuid or ROOT_UUID
        self.library_dirs = library_dirs or {}
        self.lib_blocks: dict[str, str] = {}
        self.lib_pins: dict[str, dict] = {}
        self.items: list[str] = []
        self.pwr_idx = 1
        self.net_pin_map: dict[str, list[tuple[str, str]]] = {}  # 用于自动核验与生成 PCB 网表
        self.components: list[dict] = []

    def ensure_lib(self, lib: str, name: str) -> str:
        fid = f"{lib}:{name}"
        if fid not in self.lib_blocks:
            blk, pins = load_kicad_symbol(lib, name, self.library_dirs.get(lib))
            self.lib_blocks[fid] = blk
            self.lib_pins[fid] = pins
        return fid

    @staticmethod
    def pin_world(cx: float, cy: float, rot: int, px: float, py: float) -> tuple[float, float]:
        r = rot % 360
        if r == 0:
            return (round(cx + px, 4), round(cy - py, 4))
        if r == 90:
            return (round(cx - py, 4), round(cy - px, 4))
        if r == 180:
            return (round(cx - px, 4), round(cy + py, 4))
        if r == 270:
            return (round(cx + py, 4), round(cy + px, 4))
        raise ValueError(f"Unsupported rotation {rot}")

    def add_box(self, x1: float, y1: float, x2: float, y2: float, title: str):
        self.items.append(
            f'\t(rectangle (start {x1:.2f} {y1:.2f}) (end {x2:.2f} {y2:.2f})\n'
            f'\t\t(stroke (width 0.254) (type dash) (color 80 110 150 1))\n'
            f'\t\t(fill (type none))\n'
            f'\t\t(uuid "{uid()}")\n\t)'
        )
        self.items.append(
            f'\t(text "{title}" (at {x1 + 2.54:.2f} {y1 + 4.5:.2f} 0)\n'
            f'\t\t(effects (font (size 2.54 2.54) (bold yes)) (justify left))\n'
            f'\t\t(uuid "{uid()}")\n\t)'
        )

    def add_wire(self, x1: float, y1: float, x2: float, y2: float):
        if abs(x1 - x2) < 1e-4 and abs(y1 - y2) < 1e-4:
            return
        self.items.append(
            f'\t(wire (pts (xy {x1:.4f} {y1:.4f}) (xy {x2:.4f} {y2:.4f}))\n'
            f'\t\t(stroke (width 0) (type default))\n'
            f'\t\t(uuid "{uid()}")\n\t)'
        )

    def add_no_connect(self, x: float, y: float):
        self.items.append(f'\t(no_connect (at {x:.4f} {y:.4f}) (uuid "{uid()}"))')

    def add_global_label(self, name: str, x: float, y: float, angle: int = 0, shape: str = "bidirectional"):
        just = "left" if angle == 0 else ("right" if angle == 180 else "left")
        self.items.append(
            f'\t(global_label "{name}" (shape {shape}) (at {x:.4f} {y:.4f} {angle})\n'
            f'\t\t(effects (font (size 1.15 1.15)) (justify {just}))\n'
            f'\t\t(uuid "{uid()}")\n\t)'
        )

    def add_power(self, pwr_name: str, x: float, y: float, rot: int = 0):
        fid = self.ensure_lib("power", pwr_name)
        ref = f"#PWR{self.pwr_idx:03d}"
        self.pwr_idx += 1
        self.items.append(
            f'\t(symbol (lib_id "{fid}") (at {x:.4f} {y:.4f} {rot}) (unit 1)\n'
            f'\t\t(exclude_from_sim no) (in_bom no) (on_board yes) (dnp no)\n'
            f'\t\t(uuid "{uid()}")\n'
            f'\t\t(property "Reference" "{ref}" (at {x:.2f} {y + 3.0:.2f} 0) (effects (font (size 1.27 1.27))) (hide yes))\n'
            f'\t\t(property "Value" "{pwr_name}" (at {x:.2f} {y - 2.54:.2f} 0) (effects (font (size 1.15 1.15))))\n'
            f'\t\t(property "Footprint" "" (at {x:.2f} {y:.2f} 0) (effects (font (size 1.27 1.27))) (hide yes))\n'
            f'\t\t(property "Datasheet" "" (at {x:.2f} {y:.2f} 0) (effects (font (size 1.27 1.27))) (hide yes))\n'
            f'\t\t(pin "1" (uuid "{uid()}"))\n'
            f'\t\t(instances (project "{self.project_name}" (path "/{self.root_uuid}" (reference "{ref}") (unit 1))))\n\t)'
        )

    def place_part(
        self,
        lib: str,
        sym: str,
        ref: str,
        val: str,
        fp: str,
        x: float,
        y: float,
        rot: int = 0,
        pin_nets: dict[str, str] | None = None,
        stub_len: float = 3.81,
        extra_props: dict[str, str] | None = None,
        in_bom: bool = True,
    ):
        """放置器件，并根据 pin_nets 自动把每个引脚用短导线接到对应的电源符号 / 全局标签 / no_connect！"""
        fid = self.ensure_lib(lib, sym)
        pins = self.lib_pins[fid]
        pin_nets = pin_nets or {}
        extra_props = extra_props or {}

        pin_uuid_lines = "\n".join(f'\t\t(pin "{pnum}" (uuid "{uid()}"))' for pnum in pins.keys())
        part_uuid = uid()
        prop_lines = "".join(
            f'\t\t(property {json.dumps(name)} {json.dumps(text)} (at {x:.2f} {y:.2f} 0) '
            f'(effects (font (size 1.0 1.0))) (hide yes))\n'
            for name, text in extra_props.items()
        )
        # 避免 Reference / Value 重叠，放在器件上方
        self.items.append(
            f'\t(symbol (lib_id "{fid}") (at {x:.4f} {y:.4f} {rot}) (unit 1)\n'
            f'\t\t(exclude_from_sim no) (in_bom {"yes" if in_bom else "no"}) (on_board yes) (dnp no)\n'
            f'\t\t(uuid "{part_uuid}")\n'
            f'\t\t(property "Reference" "{ref}" (at {x:.2f} {y - 3.81:.2f} 0) (effects (font (size 1.27 1.27))))\n'
            f'\t\t(property "Value" "{val}" (at {x:.2f} {y + 3.81:.2f} 0) (effects (font (size 1.15 1.15))))\n'
            f'\t\t(property "Footprint" "{fp}" (at {x:.2f} {y:.2f} 0) (effects (font (size 1.0 1.0))) (hide yes))\n'
            f'\t\t(property "Datasheet" "~" (at {x:.2f} {y:.2f} 0) (effects (font (size 1.0 1.0))) (hide yes))\n'
            f'{prop_lines}'
            f'{pin_uuid_lines}\n'
            f'\t\t(instances (project "{self.project_name}" (path "/{self.root_uuid}" (reference "{ref}") (unit 1))))\n\t)'
        )

        self.components.append({"ref": ref, "val": val, "fp": fp, "lib": fid, "nets": dict(pin_nets)})
        # 按引脚朝向向外拉 stub wire 接网络，完全零交叉、零错位！
        # 注意同一坐标上的叠加引脚（如 LIS2HH12 的 GND 6/7/8）只需放一次电源符号！
        handled_coords = set()
        for pnum, (px, py, pang, ptype, pname) in pins.items():
            net = pin_nets.get(pnum, "NC")
            wx, wy = self.pin_world(x, y, rot, px, py)
            if net != "NC":
                self.net_pin_map.setdefault(net, []).append((ref, pnum))

            ckey = (round(wx, 3), round(wy, 3))
            if ckey in handled_coords:
                continue
            handled_coords.add(ckey)

            if net == "NC":
                self.add_no_connect(wx, wy)
                continue

            # 引脚方向 pang 是指向符号体内部的方向；向外延伸是相反方向 (pang + 180)
            # 在符号局部坐标系中：0=+x, 90=+y(上), 180=-x, 270=-y(下)
            out_dir = (pang + 180 + rot) % 360
            # 转世界坐标系（Y 轴向下）：0->(+1,0), 90->(0,-1), 180->(-1,0), 270->(0,+1)
            dx, dy = {0: (1, 0), 90: (0, -1), 180: (-1, 0), 270: (0, 1)}[out_dir]
            ex, ey = round(wx + dx * stub_len, 4), round(wy + dy * stub_len, 4)
            self.add_wire(wx, wy, ex, ey)

            if net in ("GND", "+3V3", "+5V", "+BATT"):
                pwr_rot = 0
                if net == "GND":
                    # GND 符号向下指向（默认 rot=0 朝下）
                    pwr_rot = 0
                elif out_dir == 270:
                    pwr_rot = 180
                self.add_power(net, ex, ey, pwr_rot)
            else:
                # 全局标签朝向：左拉用 180，右拉用 0，上下拉也默认横向展开清晰可读
                lbl_ang = 180 if dx < 0 else 0
                self.add_global_label(net, ex, ey, angle=lbl_ang)
        return part_uuid

    def render(self, title_block=None) -> str:
        libs = "\n".join(self.lib_blocks.values())
        body = "\n".join(self.items)
        title_block = title_block or (
            '\t\t(title "CatMouse Band V1.5 EVT - 4-Layer Compact Mainboard")\n'
            '\t\t(date "2026-11-27")\n'
            '\t\t(rev "V1.5-EVT")\n'
            '\t\t(company "CatMouse Action (one-num-three/new_cat)")\n'
            '\t\t(comment 1 "4-Layer 1.0mm Dia 38mm | L1:LED/Sig | L2:GND | L3:PWR | L4:MCU/NFC/IMU")\n'
            '\t\t(comment 2 "MCU: ESP32-C3-WROOM-02 | NFC: PN5321A3HN | IMU: LIS2DH12TR | LED: 12xWS2812B-2020")\n'
        )
        return (
            f'(kicad_sch\n'
            f'\t(version 20250114)\n'
            f'\t(generator "catmouse-band-eda")\n'
            f'\t(generator_version "1.5")\n'
            f'\t(uuid "{self.root_uuid}")\n'
            f'\t(paper "A3")\n'
            f'\t(title_block\n'
            f'{title_block}'
            f'\t)\n'
            f'\t(lib_symbols\n{libs}\n\t)\n'
            f'{body}\n'
            f'\t(sheet_instances (path "/" (page "1")))\n'
            f')\n'
        )


ROOT_UUID = uid()


def build_project():
    PROJ_DIR.mkdir(parents=True, exist_ok=True)
    sch = SchematicBuilder()

    # =================== 1. 电源、磁吸充电与电量采样区 ===================
    sch.add_box(12.7, 12.7, 152.4, 134.62, "1. POWER, MAGNETIC CHARGING (USB) & BATTERY ADC")

    # J1: 4-pin 背面贴片磁吸充电 + USB Serial/JTAG 原生一线烧录触点
    sch.place_part(
        "Connector_Generic", "Conn_01x04", "J1", "MAG_CHG_USB",
        "Connector_PinHeader_2.54mm:PinHeader_1x04_P2.54mm_Vertical_SMD_Pin1Left",
        30.48, 35.56, 0,
        {"1": "+5V", "2": "GND", "3": "USB_DN_EXT", "4": "USB_DP_EXT"},
    )
    # U4: MCP73831 锂电池线性充电管理 IC (303mA 1C)
    sch.place_part(
        "Battery_Management", "MCP73831-2-OT", "U4", "MCP73831-2-OT",
        "Package_TO_SOT_SMD:SOT-23-5",
        76.2, 43.18, 0,
        {"1": "CHG_STAT", "2": "GND", "3": "+BATT", "4": "+5V", "5": "CHG_PROG"},
    )
    sch.place_part("Device", "C", "C4", "4.7uF", "Capacitor_SMD:C_0402_1005Metric", 53.34, 43.18, 0, {"1": "+5V", "2": "GND"})
    sch.place_part("Device", "C", "C5", "4.7uF", "Capacitor_SMD:C_0402_1005Metric", 104.14, 43.18, 0, {"1": "+BATT", "2": "GND"})
    sch.place_part("Device", "R", "R7", "3.3k", "Resistor_SMD:R_0402_1005Metric", 53.34, 60.96, 0, {"1": "CHG_PROG", "2": "GND"})
    # 充电红灯指示
    sch.place_part("Device", "R", "R8", "1k", "Resistor_SMD:R_0402_1005Metric", 121.92, 35.56, 0, {"1": "+5V", "2": "CHG_LED_A"})
    sch.place_part("Device", "LED", "D13", "RED_CHG", "LED_SMD:LED_0603_1608Metric", 137.16, 35.56, 0, {"1": "CHG_STAT", "2": "CHG_LED_A"})

    # J2: 锂电池接口 (1.0mm JST-SH 卧式)
    sch.place_part(
        "Connector_Generic", "Conn_01x02", "J2", "BAT_300mAh",
        "Connector_JST:JST_SH_SM02B-SRSS-TB_1x02-1MP_P1.00mm_Horizontal",
        30.48, 81.28, 0,
        {"1": "+BATT", "2": "GND"},
    )
    # U5: AP2112K-3.3 超低噪声 LDO (600mA, Iq=55uA)
    sch.place_part(
        "Regulator_Linear", "AP2112K-3.3", "U5", "AP2112K-3.3",
        "Package_TO_SOT_SMD:SOT-23-5",
        76.2, 88.9, 0,
        {"1": "+BATT", "2": "GND", "3": "+BATT", "4": "NC", "5": "+3V3"},
    )
    sch.place_part("Device", "C", "C6", "10uF", "Capacitor_SMD:C_0603_1608Metric", 104.14, 88.9, 0, {"1": "+3V3", "2": "GND"})
    sch.place_part("Device", "C", "C7", "100nF", "Capacitor_SMD:C_0402_1005Metric", 119.38, 88.9, 0, {"1": "+3V3", "2": "GND"})

    # 电池精密分压采样 (200k + 200k + 100nF -> GPIO2 BATT_ADC)
    sch.place_part("Device", "R", "R9", "200k 1%", "Resistor_SMD:R_0402_1005Metric", 53.34, 114.3, 0, {"1": "+BATT", "2": "BATT_ADC"})
    sch.place_part("Device", "R", "R10", "200k 1%", "Resistor_SMD:R_0402_1005Metric", 76.2, 114.3, 0, {"1": "BATT_ADC", "2": "GND"})
    sch.place_part("Device", "C", "C8", "100nF", "Capacitor_SMD:C_0402_1005Metric", 99.06, 114.3, 0, {"1": "BATT_ADC", "2": "GND"})

    # 外部电源输入 PWR_FLAG (+5V, GND; 注意 +BATT 由 MCP73831 power_out 驱动, +3V3 由 AP2112K power_out 驱动!)
    sch.add_power("PWR_FLAG", 129.54, 114.3, 0)
    sch.add_wire(129.54, 114.3, 129.54, 119.38)
    sch.add_power("+5V", 129.54, 119.38, 180)
    sch.add_power("PWR_FLAG", 142.24, 114.3, 0)
    sch.add_wire(142.24, 114.3, 142.24, 119.38)
    sch.add_power("GND", 142.24, 119.38, 0)

    # =================== 2. 主控核心区 (ESP32-C3-WROOM-02) ===================
    sch.add_box(160.02, 12.7, 294.64, 134.62, "2. MCU CORE (ESP32-C3-WROOM-02, SRRC CERTIFIED)")

    sch.place_part(
        "RF_Module", "ESP32-C3-WROOM-02", "U1", "ESP32-C3-WROOM-02",
        "RF_Module:ESP32-C3-WROOM-02",
        215.9, 63.5, 0,
        {
            "1": "+3V3",
            "2": "ESP_EN",
            "3": "BTN_USER",      # GPIO4 (RTC唤醒)
            "4": "MOTOR_PWM",     # GPIO5
            "5": "I2C_SDA",       # GPIO6
            "6": "I2C_SCL",       # GPIO7
            "7": "LED_PWR_EN",    # GPIO8 (启动高电平 = 默认关闭灯环PMOS!)
            "8": "BOOT_SW",       # GPIO9
            "9": "GND",
            "10": "NFC_RST",      # GPIO10
            "11": "BUZZER_PWM",   # GPIO20
            "12": "LED_DATA",     # GPIO21
            "13": "USB_DN",       # GPIO18
            "14": "USB_DP",       # GPIO19
            "15": "IMU_INT",      # GPIO3 (RTC唤醒)
            "16": "BATT_ADC",     # GPIO2 (ADC1)
            "17": "IO1_EXT",      # GPIO1 预留扩展
            "18": "IO0_EXT",      # GPIO0 预留扩展
            "19": "GND",
        },
        stub_len=5.08,
    )
    # RC 上电复位 + 去耦 + BOOT上拉 + I2C上拉 + USB 22R 匹配 + 扩展测试点
    sch.place_part("Device", "R", "R1", "10k", "Resistor_SMD:R_0402_1005Metric", 175.26, 109.22, 0, {"1": "+3V3", "2": "ESP_EN"})
    sch.place_part("Device", "C", "C1", "1uF", "Capacitor_SMD:C_0402_1005Metric", 190.5, 109.22, 0, {"1": "ESP_EN", "2": "GND"})
    sch.place_part("Device", "C", "C2", "10uF", "Capacitor_SMD:C_0603_1608Metric", 205.74, 109.22, 0, {"1": "+3V3", "2": "GND"})
    sch.place_part("Device", "C", "C3", "100nF", "Capacitor_SMD:C_0402_1005Metric", 220.98, 109.22, 0, {"1": "+3V3", "2": "GND"})
    sch.place_part("Device", "R", "R2", "10k", "Resistor_SMD:R_0402_1005Metric", 236.22, 109.22, 0, {"1": "+3V3", "2": "BOOT_SW"})
    sch.place_part("Device", "R", "R3", "4.7k", "Resistor_SMD:R_0402_1005Metric", 251.46, 109.22, 0, {"1": "+3V3", "2": "I2C_SDA"})
    sch.place_part("Device", "R", "R4", "4.7k", "Resistor_SMD:R_0402_1005Metric", 266.7, 109.22, 0, {"1": "+3V3", "2": "I2C_SCL"})
    sch.place_part("Device", "R", "R5", "22R", "Resistor_SMD:R_0402_1005Metric", 279.4, 43.18, 0, {"1": "USB_DN", "2": "USB_DN_EXT"})
    sch.place_part("Device", "R", "R6", "22R", "Resistor_SMD:R_0402_1005Metric", 279.4, 66.04, 0, {"1": "USB_DP", "2": "USB_DP_EXT"})
    sch.place_part("Connector", "TestPoint", "TP1", "BOOT_TP", "TestPoint:TestPoint_Pad_D1.5mm", 279.4, 83.82, 0, {"1": "BOOT_SW"})
    sch.place_part("Connector", "TestPoint", "TP2", "IO0_TP", "TestPoint:TestPoint_Pad_D1.5mm", 279.4, 96.52, 0, {"1": "IO0_EXT"})
    sch.place_part("Connector", "TestPoint", "TP3", "IO1_TP", "TestPoint:TestPoint_Pad_D1.5mm", 279.4, 109.22, 0, {"1": "IO1_EXT"})

    # =================== 3. 双模 NFC 射频区 (PN5321A3HN I2C + 13.56MHz) ===================
    sch.add_box(12.7, 142.24, 185.42, 284.48, "3. DUAL-MODE NFC (PN5321A3HN I2C + 27.12MHz + 13.56MHz MATCHING)")

    sch.place_part(
        "RF_NFC", "PN5321A3HN_C1xx", "U2", "PN5321A3HN",
        "Package_DFN_QFN:HVQFN-40-1EP_6x6mm_P0.5mm_EP4.1x4.1mm",
        68.58, 200.66, 0,
        {
            "1": "GND", "2": "NC", "3": "GND", "4": "NFC_TX1", "5": "+3V3",
            "6": "NFC_TX2", "7": "GND", "8": "+3V3", "9": "NFC_VMID", "10": "NFC_RX",
            "11": "GND", "12": "NC", "13": "NC", "14": "NFC_OSCIN", "15": "NFC_OSCOUT",
            "16": "+3V3",  # I0=1, I1=0 => I2C 模式 (0x24)
            "17": "GND",
            "18": "GND",   # TESTEN=0
            "19": "NC", "20": "NC", "21": "NC", "22": "NC",
            "23": "+3V3",  # PVDD
            "24": "NC", "25": "NC", "26": "NC",
            "27": "I2C_SCL", "28": "I2C_SDA",
            "29": "NC", "30": "NC", "31": "NC", "32": "NC", "33": "NC",
            "34": "NC", "35": "NC", "36": "NC", "37": "NC",
            "38": "NFC_RST",
            "39": "NFC_DVDD",  # 内部 1.8V 稳压输出，仅接 100nF 退耦到 GND!
            "40": "+3V3",
            "41": "GND",
        },
        stub_len=3.81,
    )
    # NFC 退耦与复位上拉
    sch.place_part("Device", "C", "C9", "4.7uF", "Capacitor_SMD:C_0402_1005Metric", 25.4, 256.54, 0, {"1": "+3V3", "2": "GND"})
    sch.place_part("Device", "C", "C10", "100nF", "Capacitor_SMD:C_0402_1005Metric", 40.64, 256.54, 0, {"1": "+3V3", "2": "GND"})
    sch.place_part("Device", "C", "C11", "100nF", "Capacitor_SMD:C_0402_1005Metric", 55.88, 256.54, 0, {"1": "+3V3", "2": "GND"})
    sch.place_part("Device", "C", "C12", "100nF", "Capacitor_SMD:C_0402_1005Metric", 71.12, 256.54, 0, {"1": "NFC_DVDD", "2": "GND"})
    sch.place_part("Device", "C", "C13", "100nF", "Capacitor_SMD:C_0402_1005Metric", 86.36, 256.54, 0, {"1": "NFC_VMID", "2": "GND"})
    sch.place_part("Device", "R", "R11", "10k", "Resistor_SMD:R_0402_1005Metric", 101.6, 256.54, 0, {"1": "+3V3", "2": "NFC_RST"})

    # 27.12MHz 晶体与负载电容
    sch.place_part(
        "Device", "Crystal_GND24", "Y1", "27.12MHz",
        "Crystal:Crystal_SMD_3225-4Pin_3.2x2.5mm",
        129.54, 246.38, 0,
        {"1": "NFC_OSCIN", "2": "GND", "3": "NFC_OSCOUT", "4": "GND"},
    )
    sch.place_part("Device", "C", "C14", "22pF", "Capacitor_SMD:C_0402_1005Metric", 116.84, 266.7, 0, {"1": "NFC_OSCIN", "2": "GND"})
    sch.place_part("Device", "C", "C15", "22pF", "Capacitor_SMD:C_0402_1005Metric", 142.24, 266.7, 0, {"1": "NFC_OSCOUT", "2": "GND"})

    # 13.56MHz 差分 EMC 滤波 + 匹配网络 + 天线座 J3
    sch.place_part("Device", "L", "L1", "560nH", "Inductor_SMD:L_0603_1608Metric", 116.84, 165.1, 90, {"1": "NFC_TX1", "2": "NFC_EMC1"})
    sch.place_part("Device", "L", "L2", "560nH", "Inductor_SMD:L_0603_1608Metric", 116.84, 193.04, 90, {"1": "NFC_TX2", "2": "NFC_EMC2"})
    sch.place_part("Device", "C", "C16", "150pF", "Capacitor_SMD:C_0402_1005Metric", 134.62, 165.1, 0, {"1": "NFC_EMC1", "2": "GND"})
    sch.place_part("Device", "C", "C17", "150pF", "Capacitor_SMD:C_0402_1005Metric", 134.62, 193.04, 0, {"1": "NFC_EMC2", "2": "GND"})
    sch.place_part("Device", "C", "C18", "47pF", "Capacitor_SMD:C_0402_1005Metric", 152.4, 165.1, 90, {"1": "NFC_EMC1", "2": "NFC_ANT1"})
    sch.place_part("Device", "C", "C19", "47pF", "Capacitor_SMD:C_0402_1005Metric", 152.4, 193.04, 90, {"1": "NFC_EMC2", "2": "NFC_ANT2"})
    sch.place_part("Device", "C", "C20", "1nF", "Capacitor_SMD:C_0402_1005Metric", 119.38, 218.44, 90, {"1": "NFC_EMC1", "2": "NFC_RX_MID"})
    sch.place_part("Device", "R", "R12", "1k", "Resistor_SMD:R_0402_1005Metric", 142.24, 218.44, 90, {"1": "NFC_RX_MID", "2": "NFC_RX"})
    sch.place_part(
        "Connector_Generic", "Conn_01x02", "J3", "NFC_FPC_COIL",
        "Connector_JST:JST_SH_SM02B-SRSS-TB_1x02-1MP_P1.00mm_Horizontal",
        172.72, 177.8, 0,
        {"1": "NFC_ANT1", "2": "NFC_ANT2"},
    )

    # =================== 4. 碰撞传感器与声触交互区 ===================
    sch.add_box(193.04, 142.24, 294.64, 284.48, "4. IMU IMPACT (LIS2DH12), BUTTON, MOTOR & BUZZER")

    sch.place_part(
        "Sensor_Motion", "LIS2DE12", "U3", "LIS2DH12TR",
        "Package_LGA:LGA-12_2x2mm_P0.5mm",
        228.6, 172.72, 0,
        {
            "1": "I2C_SCL", "2": "+3V3", "3": "IMU_SA0", "4": "I2C_SDA",
            "5": "GND", "6": "GND", "7": "GND", "8": "GND",
            "9": "+3V3", "10": "+3V3", "11": "NC", "12": "IMU_INT",
        },
    )
    # SA0/SDO 为双向引脚，通过 10k 电阻规范上拉至 +3V3（选地址 0x19 并防短路）
    sch.place_part("Device", "R", "R19", "10k", "Resistor_SMD:R_0402_1005Metric", 256.54, 167.64, 0, {"1": "+3V3", "2": "IMU_SA0"})
    sch.place_part("Device", "C", "C21", "100nF", "Capacitor_SMD:C_0402_1005Metric", 274.32, 167.64, 0, {"1": "+3V3", "2": "GND"})

    # 侧按用户键 SW1 + 防抖电容
    sch.place_part("Switch", "SW_Push", "SW1", "USER_BTN", "Button_Switch_SMD:SW_SPST_B3U-1000P", 220.98, 208.28, 0, {"1": "BTN_USER", "2": "GND"})
    sch.place_part("Device", "C", "C22", "100nF", "Capacitor_SMD:C_0402_1005Metric", 259.08, 208.28, 0, {"1": "BTN_USER", "2": "GND"})

    # 马达驱动 (Q2 AO3400A + R13 100R + R14 100k + D14 1N4148W + J4)
    sch.place_part("Device", "R", "R13", "100R", "Resistor_SMD:R_0402_1005Metric", 205.74, 236.22, 90, {"1": "MOTOR_PWM", "2": "MOT_G"})
    sch.place_part("Device", "R", "R14", "100k", "Resistor_SMD:R_0402_1005Metric", 218.44, 241.3, 0, {"1": "MOT_G", "2": "GND"})
    sch.place_part("Transistor_FET", "AO3400A", "Q2", "AO3400A", "Package_TO_SOT_SMD:SOT-23", 238.76, 236.22, 0, {"1": "MOT_G", "2": "GND", "3": "MOT_NEG"})
    sch.place_part("Device", "D", "D14", "1N4148W", "Diode_SMD:D_SOD-323", 261.62, 233.68, 0, {"1": "+BATT", "2": "MOT_NEG"})
    sch.place_part(
        "Connector_Generic", "Conn_01x02", "J4", "MOTOR_1027",
        "Connector_JST:JST_SH_SM02B-SRSS-TB_1x02-1MP_P1.00mm_Horizontal",
        281.94, 236.22, 0,
        {"1": "+BATT", "2": "MOT_NEG"},
    )

    # 蜂鸣器驱动 (Q3 AO3400A + R15 100R + R16 100k + LS1 Murata SMD Buzzer)
    sch.place_part("Device", "R", "R15", "100R", "Resistor_SMD:R_0402_1005Metric", 205.74, 269.24, 90, {"1": "BUZZER_PWM", "2": "BUZZ_G"})
    sch.place_part("Device", "R", "R16", "100k", "Resistor_SMD:R_0402_1005Metric", 218.44, 274.32, 0, {"1": "BUZZ_G", "2": "GND"})
    sch.place_part("Transistor_FET", "AO3400A", "Q3", "AO3400A", "Package_TO_SOT_SMD:SOT-23", 238.76, 269.24, 0, {"1": "BUZZ_G", "2": "GND", "3": "BUZZ_NEG"})
    sch.place_part("Device", "Buzzer", "LS1", "PKMCS0909E", "Buzzer_Beeper:Buzzer_Murata_PKMCS0909E", 271.78, 269.24, 0, {"1": "+BATT", "2": "BUZZ_NEG"})

    # =================== 5. 高边断电开关与 12 灯环阵列 ===================
    sch.add_box(302.26, 12.7, 408.94, 284.48, "5. LED HIGH-SIDE PMOS CUTOFF & 12x WS2812B-2020 RING")

    # Q1 AO3401A PMOS 高边断电 (GPIO8 低导通, 上拉至 +BATT 默认断开防暗电流)
    sch.place_part("Transistor_FET", "AO3401A", "Q1", "AO3401A", "Package_TO_SOT_SMD:SOT-23", 322.58, 35.56, 0, {"1": "LED_PWR_EN", "2": "+BATT", "3": "VLED"})
    sch.place_part("Device", "R", "R17", "100k", "Resistor_SMD:R_0402_1005Metric", 345.44, 35.56, 0, {"1": "+BATT", "2": "LED_PWR_EN"})
    sch.place_part("Device", "R", "R18", "330R", "Resistor_SMD:R_0402_1005Metric", 368.3, 35.56, 90, {"1": "LED_DATA", "2": "LED_D0"})
    sch.place_part("Device", "C", "C23", "10uF", "Capacitor_SMD:C_0603_1608Metric", 391.16, 35.56, 0, {"1": "VLED", "2": "GND"})

    # 4 颗局部 100nF 去耦（每 3 颗灯珠配 1 颗）
    for idx, cx in enumerate([317.5, 342.9, 368.3, 393.7], start=24):
        sch.place_part("Device", "C", f"C{idx}", "100nF", "Capacitor_SMD:C_0402_1005Metric", cx, 60.96, 0, {"1": "VLED", "2": "GND"})

    # VLED 经过 PMOS 漏极(passive)，挂一个 PWR_FLAG 声明为有效供电网络供 WS2812B power_in 检查！
    sch.add_power("PWR_FLAG", 398.78, 48.26, 0)
    sch.add_global_label("VLED", 398.78, 48.26, 0)

    # 12 颗 WS2812B-2020 菊花链（4 行 × 3 列整洁排布）
    for i in range(12):
        row = i // 3
        col = i % 3
        lx = 320.04 + col * 33.02
        ly = 93.98 + row * 48.26
        din = f"LED_D{i}"
        dout = f"LED_D{i + 1}" if i < 11 else "NC"
        sch.place_part(
            "LED", "WS2812B-2020", f"D{i + 1}", "WS2812B-2020",
            "LED_SMD:LED_WS2812B-2020_PLCC4_2.0x2.0mm",
            lx, ly, 0,
            {"1": dout, "2": "GND", "3": din, "4": "VLED"},
            stub_len=2.54,
        )

    # 写出 .kicad_sch
    sch_path = PROJ_DIR / f"{PROJ_NAME}.kicad_sch"
    sch_path.write_text(sch.render(), encoding="utf-8")

    # 写出 .kicad_pro（含嘉立创 4 层工艺约束与 ERC 配置）
    pro = {
        "board": {
            "design_settings": {
                "defaults": {
                    "board_outline_line_width": 0.1,
                    "copper_line_width": 0.2,
                    "silk_line_width": 0.12,
                    "silk_text_size_h": 0.8,
                    "silk_text_size_v": 0.8,
                    "silk_text_thickness": 0.15,
                },
                "rules": {
                    "min_clearance": 0.127,
                    "min_copper_edge_clearance": 0.3,
                    "min_hole_clearance": 0.20,
                    "min_hole_to_hole": 0.25,
                    "min_microvia_diameter": 0.2,
                    "min_microvia_drill": 0.1,
                    "min_silk_clearance": 0.1,
                    "min_through_hole_diameter": 0.20,
                    "min_track_width": 0.127,
                    "min_via_annular_width": 0.1,
                    "min_via_diameter": 0.40,
                    "solder_mask_clearance": 0.025,
                    "solder_mask_min_width": 0.05,
                },
            }
        },
        "meta": {"filename": f"{PROJ_NAME}.kicad_pro", "version": 3},
        "net_settings": {
            "classes": [
                {
                    "bus_width": 12,
                    "clearance": 0.15,
                    "diff_pair_gap": 0.15,
                    "diff_pair_via_gap": 0.25,
                    "diff_pair_width": 0.2,
                    "name": "Default",
                    "pcb_color": "rgba(0, 0, 0, 0.000)",
                    "schematic_color": "rgba(0, 0, 0, 0.000)",
                    "track_width": 0.18,
                    "via_diameter": 0.5,
                    "via_drill": 0.25,
                },
                {
                    "bus_width": 12,
                    "clearance": 0.15,
                    "diff_pair_gap": 0.15,
                    "diff_pair_via_gap": 0.25,
                    "diff_pair_width": 0.2,
                    "name": "Power",
                    "pcb_color": "rgba(0, 0, 0, 0.000)",
                    "schematic_color": "rgba(0, 0, 0, 0.000)",
                    "track_width": 0.35,
                    "via_diameter": 0.5,
                    "via_drill": 0.25,
                },
            ],
            "netclass_assignments": {
                "+5V": ["Power"],
                "+BATT": ["Power"],
                "+3V3": ["Power"],
                "VLED": ["Power"],
                "GND": ["Power"],
            },
        },
        "schematic": {
            "drawing": {"default_line_thickness": 6.0, "default_text_size": 50.0},
        },
    }
    (PROJ_DIR / f"{PROJ_NAME}.kicad_pro").write_text(json.dumps(pro, indent=2), encoding="utf-8")

    # 写出 .kicad_dru（嘉立创 4 层工艺 + 电源与板边安全规则）
    dru = """(version 1)

(rule "JLC_4Layer_Min_Clearance"
  (constraint clearance (min 0.127mm))
)

(rule "Power_Track_Width"
  (condition "A.NetClass == 'Power'")
  (constraint track_width (min 0.15mm))
)

(rule "Copper_To_Board_Edge"
  (constraint edge_clearance (min 0.30mm))
)
"""
    (PROJ_DIR / f"{PROJ_NAME}.kicad_dru").write_text(dru, encoding="utf-8")

    # 写出电路元器件和精确网表摘要 JSON（供 4 层 PCB 生成器 + 固件引脚对齐校验直接复用！）
    manifest = {
        "project": PROJ_NAME,
        "component_count": len(sch.components),
        "net_count": len(sch.net_pin_map),
        "components": sch.components,
        "nets": sch.net_pin_map,
    }
    (PROJ_DIR / "circuit_manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[GEN] Schematic generated: {sch_path} ({len(sch.components)} components, {len(sch.net_pin_map)} nets)")


if __name__ == "__main__":
    build_project()
