"""Generate the 4-net magnetic-contact flex from the common folded geometry."""

import argparse
import json
from pathlib import Path

import pcbnew as pcb

from generate_schematic import KICAD_SYM_DIR, SchematicBuilder
from generate_strap_halo_board import add_area, at, mm
from strap_halo_geometry import (
    POGO_FLEX_END_Y, POGO_FLEX_FLAT_LENGTH, POGO_FLEX_TANGENT_Y,
    POGO_FLEX_THICKNESS, POGO_FLEX_WIDTH, POGO_SIGNALS, POGO_X, POGO_Y,
)

PROJECT = "catmouse-band-v15-pogo-flex"
DIRECTORY = Path(__file__).resolve().with_name(PROJECT)
LIBRARY = "CatMouse_PogoFlex"
CONTACTS = "Flat_4x2.54_Pogo"


def write_contact_footprint():
    lib_dir = DIRECTORY / f"{LIBRARY}.pretty"
    lib_dir.mkdir(exist_ok=True)
    lands = "\n".join(
        f'  (pad "{i}" smd circle (at {x:g} 0) (size 1.30 1.30) '
        '(layers "F.Cu" "F.Mask") (solder_mask_margin 0.10))'
        for i, x in enumerate(POGO_X, 1)
    )
    (lib_dir / f"{CONTACTS}.kicad_mod").write_text(
        f'''(footprint "{CONTACTS}" (version 20241229) (generator pcbnew) (layer "F.Cu")
  (descr "Solder lands. Copper face points toward both joints after the 180 degree fold.")
  (attr smd exclude_from_pos_files exclude_from_bom)
  (fp_rect (start -4.55 -0.75) (end 4.55 0.75)
    (stroke (width 0.05) (type solid)) (fill no) (layer "F.CrtYd"))
{lands}
)
''', encoding="utf-8",
    )
    (DIRECTORY / "fp-lib-table").write_text(
        f'(fp_lib_table (version 7) (lib (name "{LIBRARY}") (type "KiCad") '
        f'(uri "${"{KIPRJMOD}"}/{lib_dir.name}") (options "") (descr "Pogo flex ends")))\n',
        encoding="utf-8",
    )
    return lib_dir


def write_schematic():
    sch = SchematicBuilder(PROJECT)
    sch.add_box(25.4, 25.4, 177.8, 101.6, "Magnetic contacts to rigid mainboard")
    terminals = {str(i): name for i, name in enumerate(POGO_SIGNALS, 1)}
    identifiers = {}
    for ref, value, x in (("J1", "CASE CONTACTS", 66.04), ("J2", "MAINBOARD J1", 144.78)):
        identifiers[ref] = sch.place_part(
            "Connector_Generic", "Conn_01x04", ref, value, f"{LIBRARY}:{CONTACTS}",
            x, 63.5, pin_nets=terminals, in_bom=False,
        )
    # The dock supplies both nets through the passive case contacts.
    for name, x in (("+5V", 90.17), ("GND", 111.76)):
        sch.add_power("PWR_FLAG", x, 78.74)
        sch.add_wire(x, 78.74, x, 82.55)
        sch.add_power(name, x, 82.55, 180 if name == "+5V" else 0)
    heading = '\t\t(title "CatMouse Band EVT-A - magnetic contact flex")\n\t\t(rev "A")\n'
    (DIRECTORY / f"{PROJECT}.kicad_sch").write_text(sch.render(heading), encoding="utf-8")
    return sch.root_uuid, identifiers


def write_rules():
    example = DIRECTORY.with_name("catmouse-band-v15") / "catmouse-band-v15.kicad_pro"
    config = json.loads(example.read_text(encoding="utf-8"))
    config["meta"]["filename"] = f"{PROJECT}.kicad_pro"
    design = config["board"]["design_settings"]
    design["drc_exclusions"] = []
    design["rules"].update({
        "min_track_width": 0.10, "min_clearance": 0.13, "min_copper_edge_clearance": 0.25,
        "min_via_diameter": 0.55, "min_through_hole_diameter": 0.30,
        "min_via_annular_width": 0.12, "solder_mask_clearance": 0.10,
    })
    (DIRECTORY / f"{PROJECT}.kicad_pro").write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")


def build():
    DIRECTORY.mkdir(parents=True, exist_ok=True)
    local = write_contact_footprint()
    sheet, identifiers = write_schematic()
    write_rules()
    board = pcb.BOARD()
    output = DIRECTORY / f"{PROJECT}.kicad_pcb"
    board.SetFileName(str(output))
    board.GetDesignSettings().SetBoardThickness(mm(POGO_FLEX_THICKNESS))
    board.SetCopperLayerCount(2)
    length = round(POGO_FLEX_FLAT_LENGTH, 6)
    radius = POGO_FLEX_WIDTH / 2
    border = pcb.PCB_SHAPE(board)
    border.SetShape(pcb.SHAPE_T_RECT)
    border.SetStart(at(-radius, 0.0))
    border.SetEnd(at(radius, -length))
    border.SetLayer(pcb.Edge_Cuts)
    border.SetWidth(mm(0.05))
    board.Add(border)

    nets = {}
    for name in POGO_SIGNALS:
        net = pcb.NETINFO_ITEM(board, name)
        board.Add(net)
        nets[name] = net
    end = round(POGO_Y - POGO_FLEX_END_Y, 6)
    for ref, y, value in (("J1", end, "CASE CONTACTS"), ("J2", length - end, "MAINBOARD J1")):
        footprint = pcb.FootprintLoad(str(local), CONTACTS)
        board.Add(footprint)
        footprint.SetFPID(pcb.LIB_ID(LIBRARY, CONTACTS))
        footprint.SetPath(pcb.KIID_PATH(f"/{sheet}/{identifiers[ref]}"))
        footprint.SetReference(ref)
        footprint.SetValue(value)
        footprint.Reference().SetVisible(False)
        footprint.Value().SetVisible(False)
        footprint.SetPosition(at(0, -y))
        for pad in footprint.Pads():
            pad.SetNet(nets[POGO_SIGNALS[int(pad.GetNumber()) - 1]])

    def run_trace(name, width, points):
        for start, stop in zip(points, points[1:]):
            track = pcb.PCB_TRACK(board)
            track.SetLayer(pcb.F_Cu)
            track.SetWidth(mm(width))
            track.SetStart(at(start[0], -start[1]))
            track.SetEnd(at(stop[0], -stop[1]))
            track.SetNet(nets[name])
            board.Add(track)

    for name, x in zip(POGO_SIGNALS[:2], POGO_X):
        run_trace(name, 0.55, [(x, end), (x, length - end)])
    for name, x, coupled_x in zip(POGO_SIGNALS[2:], POGO_X[2:], (2.375, 2.705)):
        start_turn = 2.10
        end_turn = start_turn + abs(coupled_x - x)
        run_trace(name, 0.14,
                  [(x, end), (x, start_turn), (coupled_x, end_turn),
                   (coupled_x, length - end_turn), (x, length - start_turn), (x, length - end)])

    # Vias sit on the flat tails, with at least 1.1 mm to either bend tangent.
    first_tangent = POGO_FLEX_TANGENT_Y - POGO_FLEX_END_Y
    assert first_tangent - 2.25 >= 1.1
    for y in (2.25, length - 2.25):
        via = pcb.PCB_VIA(board)
        via.SetViaType(pcb.VIATYPE_THROUGH)
        via.SetLayerPair(pcb.F_Cu, pcb.B_Cu)
        via.SetPosition(at(POGO_X[1], -y))
        via.SetWidth(mm(0.55))
        via.SetDrill(mm(0.30))
        via.SetNet(nets["GND"])
        via.SetFrontTentingMode(pcb.TENTING_MODE_TENTED)
        via.SetBackTentingMode(pcb.TENTING_MODE_TENTED)
        board.Add(via)
    add_area(board, "FPC ground return", -radius + 0.28, radius - 0.28,
             -length + 0.28, -0.28, (pcb.B_Cu,), nets["GND"])
    board.BuildConnectivity()
    pcb.ZONE_FILLER(board).Fill(board.Zones())
    if not pcb.SaveBoard(str(output), board):
        raise RuntimeError(f"Could not write {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--symbols", type=Path, default=KICAD_SYM_DIR)
    args = parser.parse_args()
    import generate_schematic
    generate_schematic.KICAD_SYM_DIR = args.symbols
    build()
