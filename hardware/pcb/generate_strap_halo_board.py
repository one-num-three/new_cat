"""Create the four-layer KiCad layout from the schematic and shared MCAD geometry."""

import argparse
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

import pcbnew as pcb

from generate_schematic import _extract_block
from generate_strap_halo_schematic import DIRECTORY, LIBRARY, PROJECT

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "cad"))
from strap_halo_geometry import (
    BUTTON_CENTER, BUZZER_CENTER, NFC_CRYSTAL_CENTER, PCB_THICKNESS,
    POGO_X, POGO_Y, RF_COPPER_KEEP_OUT, board_outline,
)

ORIGIN = 100.0
IO = {"J1", "J2", "J4", "TP1", "TP2", "TP3"}
POWER = ("+5V", "+BATT", "+3V3", "VLED", "MOT_NEG")
PLACEMENT = {
    "C1": (6.6, -0.2, 0), "C10": (-1.8, 12.0, 0), "C11": (-5.0, 13.6, 0),
    "C12": (-2.4, 6.2, 90), "C13": (-10.0, 13.0, 90), "C14": (-9.8, 11.0, 90),
    "C15": (-12.0, 3.4, 0), "C16": (-0.6, 10.4, 90), "C17": (-10.4, 14.8, 180),
    "C18": (-6.2, 15.2, 0), "C19": (-8.2, 15.2, 0), "C2": (4.0, 0.6, 0),
    "C20": (-11.6, 13.8, 180), "C21": (-2.4, 4.2, 90), "C22": (12.4, 4.6, 0),
    "C23": (3.4, 14.6, 90), "C24": (-2.8, 14.0, 90), "C25": (-12.8, -13.0, 90),
    "C26": (-12.8, -0.2, 90), "C28": (-6.8, 1.4, 0), "C29": (-4.0, 1.0, 0),
    "C3": (9.2, -12.2, 0), "C30": (-4.0, 2.0, 0), "C31": (10.2, 9.0, 90),
    "C4": (-4.2, 15.8, 90), "C5": (5.8, 16.4, 0), "C6": (1.2, 1.2, 90),
    "C7": (6.0, 7.0, 90), "C8": (-3.8, 0.0, 0), "C9": (-3.6, 11.4, 90),
    "D13": (8.6, 14.0, 90), "D14": (12.4, 7.2, 90), "D15": (2.0, 10.6, 0),
    "J1": (0.0, 14.8, 0), "J2": (4.9, 11.8, 0), "J3": (-6.8, 11.4, 0),
    "J4": (7.5, 14.7, 0), "J5": (0, 14.6, 180), "J6": (-11.2, -5.8, 0),
    "L1": (-2.0, 9.4, 90), "L2": (-7.8, 13.8, 0), "LS1": (*BUZZER_CENTER, 90),
    "Q1": (6.0, 13.6, 90), "Q2": (9.4, 6.2, 180), "Q3": (7.4, 2.4, 90),
    "R1": (9.0, -0.2, 0), "R10": (-0.2, 1.8, 90), "R11": (-2.4, 2.2, 90),
    "R12": (-8.4, 16.4, 180), "R13": (10.0, 12.6, 90), "R14": (10.0, 14.6, 90),
    "R15": (-13.0, 1.8, 90), "R16": (9.8, 1.4, 90), "R17": (-2.8, 16.0, 90),
    "R18": (-12.8, -11.0, 90), "R19": (-1.2, 16.8, 0), "R2": (-9.2, -2.8, 90),
    "R20": (4.8, 8.8, 90), "R21": (-10.4, 16.0, 180), "R22": (11.8, 13.8, 0),
    "R23": (11.2, -12.2, 0), "R24": (-12.8, -9.0, 90), "R3": (3.8, 6.8, 90),
    "R4": (-1.8, 0.6, 0), "R5": (-11.2, -2.4, 0), "R6": (-12.8, -2.2, 90),
    "R7": (11.6, 15.0, 0), "R8": (8.4, 16.2, 180), "R9": (-1.2, 6.6, 90),
    "SW1": (*BUTTON_CENTER, 270), "TP1": (-3.0, 9.0, 0), "TP2": (-6.5, 11.9, 0),
    "TP3": (-6.5, 15.4, 0), "U1": (-1.7, -6.5, 180), "U2": (-6.8, 6.2, 270),
    "U3": (0.5, 4.2, 270), "U4": (7.6, 9.8, 180), "U5": (3.8, 3.6, 90),
    "U6": (1.6, 7.6, 0), "U7": (-10.4, 0.4, 90), "Y1": (*NFC_CRYSTAL_CENTER, 90),
}


def mm(value):
    return pcb.FromMM(value)


def at(x, y):
    return pcb.VECTOR2I(mm(ORIGIN + x), mm(ORIGIN - y))


def layers(*layer_ids):
    result = pcb.LSET()
    for layer in layer_ids:
        result.AddLayer(layer)
    return result


def shape(board, kind, points, layer, width=0.05):
    graphic = pcb.PCB_SHAPE(board)
    graphic.SetShape(kind)
    if kind == pcb.SHAPE_T_ARC:
        graphic.SetArcGeometry(*(at(*point) for point in points))
    else:
        graphic.SetStart(at(*points[0]))
        graphic.SetEnd(at(*points[-1]))
    graphic.SetWidth(mm(width))
    graphic.SetLayer(layer)
    board.Add(graphic)


def make_libraries(standard):
    local = DIRECTORY / f"{LIBRARY}.pretty"
    local.mkdir(exist_ok=True)
    source = (standard / "RF_Module.pretty/ESP32-C6-MINI-1.kicad_mod").read_text(encoding="utf-8")
    # Figure 11-1 of the MINI-1 datasheet specifies the same land map numbered
    # 1–53, including the nine exposed-pad lands numbered 49.
    for marker in ("\n\t(zone", "\n\t(model"):
        index = source.find(marker) + len(marker) - len(marker.lstrip())
        if index >= 2:
            source = source[:index] + source[index + len(_extract_block(source, index)):]
    for match in reversed(list(re.finditer(r"(?m)^\t\(fp_(line|poly)\b", source))):
        block = _extract_block(source, match.start() + 1)
        if '(layer "F.CrtYd")' in block or '(layer "F.SilkS")' in block:
            source = source[:match.start()] + source[match.start() + len(block) + 1:]
    source = source.rstrip().removesuffix(")") + (
        '\t(fp_rect (start -6.85 -11.25) (end 6.85 5.85)'
        ' (stroke (width 0.05) (type solid)) (fill no) (layer "F.CrtYd"))\n)\n'
    )
    source = source.replace("ESP32-C6-MINI-1", "ESP32-C3-MINI-1")
    source = re.sub(r'\(descr "[^"]*"\)', '(descr "Espressif MINI-1, v2.2 Fig 11-1 land pattern")', source)
    source = "\n".join(line.rstrip() for line in source.splitlines()) + "\n"
    (local / "ESP32-C3-MINI-1.kicad_mod").write_text(source, encoding="utf-8")

    # These three placements overhang or pack closely to the edge. Their
    # assembly outlines remain on F.Fab and all land geometry is unchanged.
    for directory, name, shapes in (
        ("Button_Switch_SMD", "SW_SPST_B3U-3000P", "line"),
        ("Buzzer_Beeper", "Buzzer_Murata_PKMCS0909E", "line"),
        ("Package_TO_SOT_SMD", "SOT-23-5", "poly"),
    ):
        art = (standard / f"{directory}.pretty/{name}.kicad_mod").read_text(encoding="utf-8")
        for match in reversed(list(re.finditer(rf"(?m)^\t\(fp_(?:{shapes})\b", art))):
            start = match.start() + 1
            primitive = _extract_block(art, start)
            if '(layer "F.SilkS")' in primitive:
                moved = primitive.replace('(layer "F.SilkS")', '(layer "F.Fab")')
                art = art[:start] + moved + art[start + len(primitive):]
        (local / f"{name}.kicad_mod").write_text(art, encoding="utf-8")

    def write(name, body, pads, *, paste=True, opening=False):
        x, y = body
        paste_layer = ' "F.Paste"' if paste else ""
        fp_type = "smd" if paste else "smd exclude_from_pos_files exclude_from_bom"
        f_paste = -0.025 if opening else 0
        pad_text = "\n".join(
            f'  (pad "{num}" smd {geometry} (at {px} {py}) (size {w} {h}) '
            f'(layers "F.Cu"{paste_layer} "F.Mask") (solder_paste_margin {f_paste}))'
            for num, geometry, px, py, w, h in pads
        )
        guide = (
            f'  (fp_line (start -1.25 {y / 2 + 0.2}) (end 1.25 {y / 2 + 0.2}) '
            '(stroke (width 0.12) (type solid)) (layer "F.Fab"))\n'
            if opening else ""
        )
        (local / f"{name}.kicad_mod").write_text(
            f'''(footprint "{name}" (version 20241229) (generator pcbnew) (layer "F.Cu")
  (attr {fp_type})
  (fp_rect (start {-x / 2} {-y / 2}) (end {x / 2} {y / 2})
    (stroke (width 0.1) (type solid)) (fill no) (layer "F.Fab"))
  (fp_rect (start {-x / 2 - 0.25} {-y / 2 - (0.75 if opening else 0.25)})
    (end {x / 2 + 0.25} {y / 2 + 0.25})
    (stroke (width 0.05) (type solid)) (fill no) (layer "F.CrtYd"))
{guide}{pad_text}
)
''', encoding="utf-8",
        )

    write("Pogo_4x2.54_Flat", (9.42, 1.8), [
        (index, "circle", x, 0, 1.8, 1.8) for index, x in enumerate(POGO_X, start=1)
    ], paste=False)
    write("Wire_Pads_2x2.54", (4.44, 1.5), [
        (1, "rect", -1.27, 0, 1.9, 1.5), (2, "rect", 1.27, 0, 1.9, 1.5)
    ], paste=False)
    write("NFC_Spring_2x2.00", (4.2, 2.4), [
        (1, "rect", -1.0, 0, 0.90, 1.50), (2, "rect", 1.0, 0, 0.90, 1.50)
    ], paste=False)
    write("FH19C-4S-0.5SH", (4.0, 2.5), [
        *((n, "rect", x, -1.5, 0.3, 0.8) for n, x in enumerate((-0.75, -0.25, 0.25, 0.75), 1)),
        ("MP", "rect", -1.75, 1.0, 0.4, 0.8), ("MP", "rect", 1.75, 1.0, 0.4, 0.8),
    ], opening=True)
    (DIRECTORY / "fp-lib-table").write_text(
        f'(fp_lib_table (version 7) (lib (name "{LIBRARY}") (type "KiCad") '
        f'(uri "${"{KIPRJMOD}"}/{local.name}") (options "") (descr "Strap-Halo footprints")))\n',
        encoding="utf-8",
    )
    return local


def configure_project():
    reference = DIRECTORY.with_name("catmouse-band-v15") / "catmouse-band-v15.kicad_pro"
    settings = json.loads(reference.read_text(encoding="utf-8"))
    settings["meta"]["filename"] = f"{PROJECT}.kicad_pro"
    design = settings["board"]["design_settings"]
    design["rules"]["min_via_diameter"] = 0.45
    design["drc_exclusions"] = []
    design["rule_severities"]["missing_courtyard"] = "error"
    design["rule_severities"]["track_not_centered_on_via"] = "error"
    settings["net_settings"]["netclass_patterns"] = [
        {"netclass": "Power", "pattern": name} for name in POWER
    ]
    (DIRECTORY / f"{PROJECT}.kicad_pro").write_text(json.dumps(settings, indent=2) + "\n", encoding="utf-8")
    (DIRECTORY / f"{PROJECT}.kicad_dru").write_text(
        reference.with_suffix(".kicad_dru").read_text(encoding="utf-8"), encoding="utf-8",
    )


def add_area(board, name, x1, x2, y1, y2, layer_ids, net=None):
    area = pcb.ZONE(board)
    area.SetZoneName(name)
    area.SetLayerSet(layers(*layer_ids))
    if net:
        area.SetNet(net)
        area.SetPadConnection(pcb.ZONE_CONNECTION_FULL)
        area.SetLocalClearance(mm(0.15))
        area.SetMinThickness(mm(0.127))
        area.SetIslandRemovalMode(pcb.ISLAND_REMOVAL_MODE_ALWAYS)
    else:
        area.SetIsRuleArea(True)
        area.SetDoNotAllowZoneFills(True)
        area.SetDoNotAllowVias(True)
        area.SetDoNotAllowTracks(True)
        area.SetDoNotAllowPads(True)
    contour = area.Outline()
    contour.NewOutline()
    for x, y in ((x1, y1), (x2, y1), (x2, y2), (x1, y2)):
        point = at(x, y)
        contour.Append(point.x, point.y)
    board.Add(area)


def build(standard, netlist):
    local = make_libraries(standard)
    configure_project()
    if netlist is None:
        return
    components = json.loads((DIRECTORY / "components.json").read_text(encoding="utf-8"))
    parts = components["parts"]
    if set(parts) != set(PLACEMENT):
        raise ValueError(f"Placement and schematic disagree: {sorted(set(parts) ^ set(PLACEMENT))}")
    tree = ET.parse(netlist)
    pin_to_net = {
        (node.attrib["ref"], node.attrib["pin"]): (
            net.attrib["name"].replace("/", "{slash}") if net.attrib["name"].startswith("unconnected-")
            else net.attrib["name"]
        )
        for net in tree.findall("./nets/net") for node in net.findall("node")
    }
    output = DIRECTORY / f"{PROJECT}.kicad_pcb"
    board = pcb.BOARD()
    board.SetFileName(str(output))
    board.SetCopperLayerCount(4)
    board.GetDesignSettings().SetBoardThickness(mm(PCB_THICKNESS))
    for points in board_outline():
        shape(board, pcb.SHAPE_T_ARC if len(points) == 3 else pcb.SHAPE_T_SEGMENT, points, pcb.Edge_Cuts)
    nets = {}
    for name in sorted(set(pin_to_net.values())):
        net = pcb.NETINFO_ITEM(board, name)
        board.Add(net)
        nets[name] = net
    for ref, data in parts.items():
        lib, name = data["footprint"].split(":")
        fp = pcb.FootprintLoad(str(local if lib == LIBRARY else standard / f"{lib}.pretty"), name)
        if fp is None:
            raise ValueError(f"Footprint absent: {data['footprint']}")
        board.Add(fp)
        fp.SetFPID(pcb.LIB_ID(lib, name))
        fp.SetReference(ref)
        fp.SetValue(data["value"])
        fp.SetPath(pcb.KIID_PATH(f"/{components['sheet_uuid']}/{data['symbol_uuid']}"))
        x, y, rotation = PLACEMENT[ref]
        fp.SetPosition(at(x, y))
        if ref in IO:
            fp.Flip(at(x, y), pcb.FLIP_DIRECTION_TOP_BOTTOM)
        fp.SetOrientationDegrees(rotation)
        if not data["assembly"]:
            fp.SetAttributes(fp.GetAttributes() | pcb.FP_EXCLUDE_FROM_BOM | pcb.FP_EXCLUDE_FROM_POS_FILES)
        if data["lcsc"]:
            fp.SetField("LCSC", data["lcsc"])
            fp.GetField("LCSC").SetVisible(False)
        fp.Reference().SetVisible(False)
        fp.Value().SetVisible(False)
        for pad in fp.Pads():
            key = (ref, pad.GetNumber())
            if key in pin_to_net:
                pad.SetNet(nets[pin_to_net[key]])

    add_area(board, "BLE antenna no copper", *RF_COPPER_KEEP_OUT, (pcb.F_Cu, pcb.In1_Cu, pcb.In2_Cu, pcb.B_Cu))
    add_area(board, "L2 ground", -14.2, 14.2, -11.75, 17.7, (pcb.In1_Cu,), nets["GND"])
    add_area(board, "L3 3V3", -14.2, 14.2, -11.75, 17.7, (pcb.In2_Cu,), nets["+3V3"])
    if not pcb.SaveBoard(str(output), board):
        raise RuntimeError(f"Could not save {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--footprints", type=Path, default=Path(r"D:\Program Files\KiCad\share\kicad\footprints"))
    parser.add_argument("--netlist", type=Path, help="KiCad XML netlist. Omit to generate the local libraries and rules.")
    args = parser.parse_args()
    build(args.footprints, args.netlist)
