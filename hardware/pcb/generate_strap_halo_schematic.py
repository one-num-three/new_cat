"""Build the Strap-Halo schematic from the V1.5 reference circuits and vendor pinouts."""

import argparse
import json
from pathlib import Path

import generate_schematic as legacy

PROJECT = "catmouse-band-v15-strap-halo"
DIRECTORY = Path(__file__).resolve().with_name(PROJECT)
LIBRARY = "CatMouse_StrapHalo"
MODULE = "ESP32-C3-MINI-1-N4X"

# Espressif v2.2, table 3-1. GPIOs in config.h are not package pin numbers.
MINI_GPIO_TO_PAD = {
    0: 12, 1: 13, 2: 5, 3: 6, 4: 18, 5: 19, 6: 20, 7: 21, 8: 22,
    9: 23, 10: 16, 18: 26, 19: 27, 20: 30, 21: 31,
}
MINI_GROUND_PADS = (1, 2, 11, 14, *range(36, 54))
GPIO_NETWORKS = {
    0: "IO0_EXT", 1: "IO1_EXT", 2: "BATT_ADC", 3: "IMU_INT",
    4: "BTN_USER", 5: "MOTOR_PWM", 6: "I2C_SDA", 7: "I2C_SCL",
    8: "LED_PWR_EN", 9: "BOOT_SW", 10: "NFC_RST", 18: "USB_DN",
    19: "USB_DP", 20: "BUZZER_PWM", 21: "LED_DATA",
}
MCU_NETS = {
    **{pad: "GND" for pad in MINI_GROUND_PADS},
    3: "+3V3", 8: "ESP_EN",
    **{pad: GPIO_NETWORKS[gpio] for gpio, pad in MINI_GPIO_TO_PAD.items()},
}

R0402 = "Resistor_SMD:R_0402_1005Metric"
C0402 = "Capacitor_SMD:C_0402_1005Metric"
C0603 = "Capacitor_SMD:C_0603_1608Metric"
C0805 = "Capacitor_SMD:C_0805_2012Metric"
SOT23 = "Package_TO_SOT_SMD:SOT-23"
SOT235 = "Package_TO_SOT_SMD:SOT-23-5"
SOT236 = "Package_TO_SOT_SMD:SOT-23-6"

# Catalog candidates for the engineering BOM. Order availability is checked
# separately in the manufacturing review.
CATALOG_LCSC = {
    "C1": "C5142580", "C2": "C193747", "C6": "C193747", "C23": "C193747",
    **dict.fromkeys(("C4", "C5", "C9"), "C7419425"),
    **dict.fromkeys(("C3", "C7", "C8", "C10", "C11", "C12", "C13", "C21", "C22",
                     "C24", "C25", "C26", "C29", "C30", "C31"), "C387958"),
    "C16": "C541423", "C17": "C541423", "C18": "C2169042", "C19": "C2169042",
    "C20": "C599568", "C28": "C669099", "D13": "C2286", "D14": "C2128",
    "SW1": "C963349", "U3": "C110926", "U6": "C7830",
}


def write_module_symbol():
    effects = "(effects (font (size 1.016 1.016)))"
    pins = []
    for index, gpio in enumerate(MINI_GPIO_TO_PAD):
        number = MINI_GPIO_TO_PAD[gpio]
        name = {20: "RXD0 / IO20", 21: "TXD0 / IO21"}.get(gpio, f"IO{gpio}")
        left = index < 8
        x = -20.32 if left else 20.32
        y = 8.89 - 2.54 * (index % 8)
        pins.append((number, name, "bidirectional", x, y, 0 if left else 180))
    pins.extend([
        (3, "3V3", "power_in", 0, 19.05, 270),
        (8, "EN", "input", 20.32, -8.89, 180),
    ])
    pins.extend((pad, "GND", "power_in", 0, -19.05, 90) for pad in MINI_GROUND_PADS)
    nc_pads = sorted(set(range(1, 54)) - {pin[0] for pin in pins})
    for index, pad in enumerate(nc_pads):
        pins.append((pad, "NC", "no_connect", -16.51 + index * 2.54, -13.97, 90))

    pin_text = "\n".join(
        f'      (pin {kind} line (at {x:g} {y:g} {angle}) '
        f'(length {0 if kind == "no_connect" else 2.54})'
        f'{" (hide yes)" if kind == "no_connect" or (name == "GND" and pad != 1) else ""}'
        f' (name "{name}" {effects}) (number "{pad}" {effects}))'
        for pad, name, kind, x, y, angle in pins
    )
    content = f'''(kicad_symbol_lib (version 20241209) (generator kicad_symbol_editor)
  (symbol "{MODULE}"
    (pin_names (offset 0.8))
    (exclude_from_sim no) (in_bom yes) (on_board yes)
    (property "Reference" "U" (at 0 15.24 0) {effects})
    (property "Value" "{MODULE}" (at 0 12.7 0) {effects})
    (property "Footprint" "{LIBRARY}:ESP32-C3-MINI-1" (at 0 0 0) {effects} (hide yes))
    (property "Datasheet" "https://documentation.espressif.com/esp32-c3-mini-1_datasheet_en.pdf"
      (at 0 0 0) {effects} (hide yes))
    (property "Description" "ESP32-C3 module with integral PCB antenna" (at 0 0 0) {effects} (hide yes))
    (symbol "{MODULE}_0_1"
      (rectangle (start -17.78 11.43) (end 17.78 -11.43)
        (stroke (width 0.254) (type default)) (fill (type background))))
    (symbol "{MODULE}_1_1"
{pin_text}
    )
  )
)
'''
    (DIRECTORY / f"{LIBRARY}.kicad_sym").write_text(content, encoding="utf-8")
    (DIRECTORY / "sym-lib-table").write_text(
        f'(sym_lib_table (version 7) (lib (name "{LIBRARY}") (type "KiCad") '
        f'(uri "${"{KIPRJMOD}"}/{LIBRARY}.kicad_sym") (options "") (descr "Strap-Halo module")))\n',
        encoding="utf-8",
    )


def build(library_dir):
    DIRECTORY.mkdir(parents=True, exist_ok=True)
    legacy.KICAD_SYM_DIR = library_dir
    write_module_symbol()
    sch = legacy.SchematicBuilder(PROJECT, library_dirs={LIBRARY: DIRECTORY})
    parts = {}

    def part(ref, value, symbol, footprint, x, y, nets, *, rot=0, lcsc=None, bom=True):
        lcsc = lcsc or CATALOG_LCSC.get(ref)
        library, name = symbol.split(":")
        pin_nets = {str(number): net for number, net in nets.items()}
        uuid = sch.place_part(
            library, name, ref, value, footprint, round(x / 1.27) * 1.27,
            round(y / 1.27) * 1.27, rot, pin_nets,
            extra_props={"LCSC": lcsc} if lcsc else None, in_bom=bom,
        )
        unknown = set(pin_nets) - set(sch.lib_pins[symbol])
        if unknown:
            raise ValueError(f"{ref} ({symbol}) uses unknown pins {sorted(unknown)}")
        parts[ref] = {"symbol_uuid": uuid, "footprint": footprint, "value": value,
                      "nets": pin_nets, "lcsc": lcsc, "assembly": bom}

    def resistor(ref, value, x, y, positive, negative, *, rot=0):
        part(ref, value, "Device:R", R0402, x, y, {1: positive, 2: negative}, rot=rot)

    def capacitor(ref, value, x, y, net, package=C0402):
        part(ref, value, "Device:C", package, x, y, {1: net, 2: "GND"})

    def flags(*labels):
        for net, x, y in labels:
            sch.add_power("PWR_FLAG", x, y)
            sch.add_wire(x, y, x, y + 3.81)
            if net in ("GND", "+5V", "+BATT", "+3V3"):
                sch.add_power(net, x, y + 3.81)
            else:
                sch.add_global_label(net, x, y + 3.81)

    sch.add_box(10.16, 10.16, 149.86, 124.46, "Power, Li-ion charger and battery sense")
    part("J1", "POGO: +5V / GND / D- / D+", "Connector_Generic:Conn_01x04",
         f"{LIBRARY}:Pogo_4x2.54_Flat", 30.48, 35.56,
         {1: "+5V", 2: "GND", 3: "USB_DN_EXT", 4: "USB_DP_EXT"}, bom=False)
    part("U4", "MCP73831T-2ACI/OT", "Battery_Management:MCP73831-2-OT",
         f"{LIBRARY}:SOT-23-5", 71.12, 40.64, {1: "CHG_STAT", 2: "GND", 3: "+BATT", 4: "+5V", 5: "CHG_PROG"})
    part("J2", "Protected LiPo pack", "Connector_Generic:Conn_01x02",
         f"{LIBRARY}:Wire_Pads_2x2.54", 30.48, 76.2, {1: "+BATT", 2: "GND"}, bom=False)
    part("U5", "AP2112K-3.3TRG1", "Regulator_Linear:AP2112K-3.3",
         SOT235, 71.12, 78.74, {1: "+BATT", 2: "GND", 3: "+BATT", 5: "+3V3"}, lcsc="C51118")
    resistor("R7", "10k", 45.72, 55.88, "CHG_PROG", "GND")
    resistor("R8", "1k", 114.3, 27.94, "+5V", "CHG_LED_A")
    part("D13", "Red charge LED", "Device:LED", "LED_SMD:LED_0603_1608Metric",
         132.08, 40.64, {1: "CHG_STAT", 2: "CHG_LED_A"})
    capacitor("C4", "4.7uF", 104.14, 45.72, "+5V", C0603)
    capacitor("C5", "4.7uF", 121.92, 68.58, "+BATT", C0603)
    capacitor("C6", "10uF", 101.6, 78.74, "+3V3", C0603)
    capacitor("C7", "100nF", 132.08, 81.28, "+3V3")
    resistor("R9", "200k 1%", 22.86, 104.14, "+BATT", "BATT_ADC")
    resistor("R10", "200k 1%", 45.72, 104.14, "BATT_ADC", "GND")
    capacitor("C8", "100nF", 68.58, 104.14, "BATT_ADC")
    flags(("+5V", 100.33, 105.41), ("GND", 130.81, 105.41))

    sch.add_box(154.94, 10.16, 292.10, 124.46, "ESP32-C3-MINI-1 and USB Serial/JTAG")
    part("U1", MODULE, f"{LIBRARY}:{MODULE}", f"{LIBRARY}:ESP32-C3-MINI-1",
         213.36, 53.34, MCU_NETS, lcsc="C9900263492")
    resistor("R1", "10k", 165.1, 83.82, "+3V3", "ESP_EN")
    capacitor("C1", "1uF", 182.88, 83.82, "ESP_EN")
    capacitor("C2", "10uF", 200.66, 88.9, "+3V3", C0603)
    capacitor("C3", "100nF", 218.44, 88.9, "+3V3")
    resistor("R2", "10k", 236.22, 88.9, "+3V3", "BOOT_SW")
    resistor("R3", "3.3k", 175.26, 111.76, "+3V3", "I2C_SDA")
    resistor("R4", "3.3k", 195.58, 111.76, "+3V3", "I2C_SCL")
    resistor("R5", "22R", 250.19, 30.48, "USB_DN", "USB_DN_EXT", rot=90)
    resistor("R6", "22R", 250.19, 78.74, "USB_DP", "USB_DP_EXT", rot=90)
    part("D15", "USBLC6-2SC6", "Power_Protection:USBLC6-2SC6", SOT236, 269.24, 53.34,
         {1: "USB_DN_EXT", 2: "GND", 3: "USB_DP_EXT", 4: "USB_DP_EXT", 5: "+5V", 6: "USB_DN_EXT"})
    for ref, x, net in (("TP1", 220.98, "BOOT_SW"), ("TP2", 245.11, "IO0_EXT"), ("TP3", 269.24, "IO1_EXT")):
        part(ref, net, "Connector:TestPoint", "TestPoint:TestPoint_Pad_D1.5mm",
             x, 111.76, {1: net}, bom=False)

    sch.add_box(10.16, 129.54, 182.88, 284.48, "PN532 C106 I2C and 13.56 MHz antenna")
    part("U2", "PN5321A3HN/C106,55", "RF_NFC:PN5321A3HN_C1xx",
         "Package_DFN_QFN:HVQFN-40-1EP_6x6mm_P0.5mm_EP4.1x4.1mm", 62.23, 197.23,
         {1: "GND", 3: "GND", 4: "NFC_TX1", 5: "NFC_DVDD", 6: "NFC_TX2", 7: "GND",
          8: "NFC_DVDD", 9: "NFC_VMID", 10: "NFC_RX", 11: "GND", 14: "NFC_OSCIN",
          15: "NFC_OSCOUT", 16: "NFC_DVDD", 17: "GND", 18: "GND", 23: "+3V3",
          27: "I2C_SCL", 28: "I2C_SDA", 38: "NFC_RST", 39: "NFC_DVDD", 40: "+3V3", 41: "GND"},
         lcsc="C28925")
    for index, (ref, value, net, package) in enumerate((
        ("C9", "4.7uF", "NFC_DVDD", C0603), ("C10", "100nF", "NFC_DVDD", C0402),
        ("C11", "100nF", "NFC_DVDD", C0402), ("C12", "100nF", "NFC_DVDD", C0402),
        ("C13", "100nF", "NFC_VMID", C0402), ("C28", "10uF", "NFC_DVDD", C0805),
        ("C29", "100nF", "+3V3", C0402), ("C30", "100nF", "+3V3", C0402),
    )):
        capacitor(ref, value, 20.32 + 21.08 * (index % 8), 266.7, net, package)
    resistor("R11", "100k", 20.32, 233.68, "NFC_RST", "GND")
    part("Y1", "27.12MHz CL=12pF", "Device:Crystal_GND24", "Crystal:Crystal_SMD_3225-4Pin_3.2x2.5mm",
         53.34, 245.11, {1: "NFC_OSCIN", 2: "GND", 3: "NFC_OSCOUT", 4: "GND"})
    capacitor("C14", "22pF", 91.44, 241.3, "NFC_OSCIN")
    capacitor("C15", "22pF", 111.76, 241.3, "NFC_OSCOUT")
    for row, suffix in enumerate((1, 2)):
        y = 155.448 + row * 25.4
        emc, ant = f"NFC_EMC{suffix}", f"NFC_ANT{suffix}"
        part(f"L{suffix}", "560nH", "Device:L", "Inductor_SMD:L_0603_1608Metric",
             111.76, y, {1: f"NFC_TX{suffix}", 2: emc}, rot=90)
        capacitor(f"C{15 + suffix}", "150pF C0G", 132.08, y, emc)
        part(f"C{17 + suffix}", "47pF C0G", "Device:C", C0402, 149.86, y, {1: emc, 2: ant}, rot=90)
    part("J3", "J_NFC_SPRING", "Connector_Generic:Conn_01x02",
         f"{LIBRARY}:NFC_Spring_2x2.00", 165.1, 198.12, {1: "NFC_ANT1", 2: "NFC_ANT2"}, bom=False)
    part("C20", "1nF", "Device:C", C0402, 123.19, 215.9, {1: "NFC_RX_AC", 2: "NFC_RX"}, rot=90)
    resistor("R12", "2.7k", 143.51, 215.9, "NFC_EMC1", "NFC_RX_AC", rot=90)
    resistor("R21", "1k", 167.64, 226.06, "NFC_VMID", "NFC_RX")

    sch.add_box(187.96, 129.54, 292.10, 284.48, "Motion, side button, motor and piezo")
    part("U3", "LIS2DH12TR", "Sensor_Motion:LIS2DE12", "Package_LGA:LGA-12_2x2mm_P0.5mm",
         215.9, 158.75, {1: "I2C_SCL", 2: "+3V3", 3: "IMU_SA0", 4: "I2C_SDA", 5: "GND",
                         6: "GND", 7: "GND", 8: "GND", 9: "+3V3", 10: "+3V3", 12: "IMU_INT"})
    resistor("R19", "10k", 251.46, 151.13, "+3V3", "IMU_SA0")
    capacitor("C21", "100nF", 271.78, 151.13, "+3V3")
    capacitor("C31", "100nF", 271.78, 172.72, "+3V3")
    part("SW1", "B3U-3000P", "Switch:SW_Push", f"{LIBRARY}:SW_SPST_B3U-3000P",
         216.535, 190.5, {1: "BTN_USER", 2: "GND"})
    capacitor("C22", "100nF", 251.46, 190.5, "BTN_USER")
    resistor("R22", "47k", 271.78, 190.5, "+3V3", "BTN_USER")
    resistor("R13", "100R", 208.28, 213.36, "MOTOR_PWM", "MOT_G", rot=90)
    resistor("R14", "100k", 215.9, 226.06, "MOT_G", "GND")
    part("Q2", "AO3400A", "Transistor_FET:AO3400A", SOT23, 236.22, 215.9,
         {1: "MOT_G", 2: "GND", 3: "MOT_NEG"}, lcsc="C20917")
    part("D14", "1N4148WS", "Device:D", "Diode_SMD:D_SOD-323",
         258.445, 211.455, {1: "+BATT", 2: "MOT_NEG"})
    part("J4", "1027 motor wires", "Connector_Generic:Conn_01x02",
         f"{LIBRARY}:Wire_Pads_2x2.54", 281.94, 224.79, {1: "+BATT", 2: "MOT_NEG"}, bom=False)
    resistor("R15", "100R", 208.28, 250.19, "BUZZER_PWM", "BUZZ_G", rot=90)
    resistor("R16", "100k", 215.9, 266.7, "BUZZ_G", "GND")
    part("Q3", "AO3400A", "Transistor_FET:AO3400A", SOT23, 236.22, 256.54,
         {1: "BUZZ_G", 2: "GND", 3: "BUZZ_NEG"}, lcsc="C20917")
    part("LS1", "PKMCS0909E4000-R1", "Device:Buzzer", f"{LIBRARY}:Buzzer_Murata_PKMCS0909E",
         266.7, 248.92, {1: "+BATT", 2: "BUZZ_NEG"}, lcsc="C910763")
    resistor("R23", "4.7k", 276.86, 270.51, "+BATT", "BUZZ_NEG")

    sch.add_box(297.18, 10.16, 408.94, 218.44, "Dual FPC wings, power gating and data")
    part("Q1", "AO3401A", "Transistor_FET:AO3401A", SOT23, 351.79, 35.56,
         {1: "LED_PWR_GATE", 2: "+BATT", 3: "VLED"}, lcsc="C15127")
    part("U6", "SN74LVC1G07DCKR", "74xGxx:74LVC1G07",
         "Package_TO_SOT_SMD:SOT-353_SC-70-5", 320.04, 50.8,
         {2: "LED_PWR_EN", 3: "GND", 4: "LED_PWR_GATE", 5: "+3V3"})
    resistor("R17", "100k", 332.74, 26.67, "+BATT", "LED_PWR_GATE")
    resistor("R20", "10k", 307.34, 27.94, "+3V3", "LED_PWR_EN")
    capacitor("C23", "10uF", 377.19, 33.02, "VLED", C0603)
    capacitor("C24", "100nF", 365.76, 57.15, "+3V3")
    part("U7", "SN74LVC1T45DBVR", "Logic_LevelTranslator:SN74LVC1T45DBV", SOT236,
         337.82, 88.9, {1: "+3V3", 2: "GND", 3: "LED_DATA", 4: "LED_DATA_BUF", 5: "+3V3", 6: "VLED"})
    capacitor("C25", "100nF", 308.61, 88.9, "VLED")
    capacitor("C26", "100nF", 372.11, 88.9, "+3V3")
    resistor("R18", "330R", 326.39, 118.11, "LED_DATA_BUF", "LED_DIN_F", rot=90)
    resistor("R24", "330R", 372.11, 149.86, "LED_DOUT_RET", "LED_DIN_R", rot=90)
    for ref, name, y, din, ret in (
        ("J5", "J_LED_F", 139.7, "LED_DIN_F", "LED_DOUT_RET"),
        ("J6", "J_LED_R", 172.72, "LED_DIN_R", "NC"),
    ):
        part(ref, name, "Connector_Generic:Conn_01x04", f"{LIBRARY}:FH19C-4S-0.5SH",
             337.82, y, {1: "VLED", 2: "GND", 3: din, 4: ret}, lcsc="C424650")
    flags(("VLED", 377.19, 185.42))

    title_block = ('\t\t(title "CatMouse Band V1.5 Strap-Halo / Velcro Lite")\n'
                   '\t\t(rev "EVT-A")\n\t\t(date "2026-11-28")\n'
                   '\t\t(comment 1 "Four-layer single-sided PCBA | dual wing FPC")\n')
    schematic = "\n".join(line.rstrip() for line in sch.render(title_block).splitlines()) + "\n"
    (DIRECTORY / f"{PROJECT}.kicad_sch").write_text(schematic, encoding="utf-8")
    (DIRECTORY / "components.json").write_text(
        json.dumps({"sheet_uuid": sch.root_uuid, "parts": parts}, indent=2) + "\n", encoding="utf-8",
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--symbols", type=Path, default=legacy.KICAD_SYM_DIR)
    build(parser.parse_args().symbols)
