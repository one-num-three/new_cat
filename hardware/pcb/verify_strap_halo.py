"""Cross-check the current schematic, PCB pads, firmware and KiCad verification reports."""

import argparse
from collections import Counter
import json
from pathlib import Path
import subprocess
import tempfile
import xml.etree.ElementTree as ET

import pcbnew as pcb

from generate_strap_halo_schematic import DIRECTORY, MINI_GPIO_TO_PAD, PROJECT
from verify_netlist_vs_firmware import FW_MACRO_TO_SCH_NET, parse_evt_firmware_pins

HARDWARE = Path(__file__).resolve().parents[1]


def run_checks(cli, directory):
    project = directory / PROJECT
    board_file = project.with_suffix('.kicad_pcb')
    schematic = project.with_suffix('.kicad_sch')
    board = pcb.LoadBoard(str(board_file))
    with tempfile.TemporaryDirectory(prefix='strap-halo-', dir=directory) as scratch:
        tmp = Path(scratch)
        export = tmp / 'schematic.xml'
        erc = tmp / 'erc.json'
        drc = tmp / 'drc.json'
        for args in (
            ('sch', 'export', 'netlist', '--format', 'kicadxml', '-o', export, schematic),
            ('sch', 'erc', '--format', 'json', '--severity-all', '-o', erc, schematic),
            ('pcb', 'drc', '--format', 'json', '--severity-all', '--schematic-parity', '-o', drc, board_file),
        ):
            subprocess.run([str(cli), *map(str, args)], check=True)
        xml = ET.parse(export)
        erc_report = json.loads(erc.read_text(encoding='utf-8'))
        drc_report = json.loads(drc.read_text(encoding='utf-8'))

    schematic_pins = {
        (node.attrib['ref'], node.attrib['pin']): net.attrib['name'].lstrip('/')
        for net in xml.findall('./nets/net') for node in net.findall('node')
    }
    pcb_pins = {
        (footprint.GetReference(), pad.GetNumber()): pad.GetNetname().lstrip('/')
        for footprint in board.GetFootprints() for pad in footprint.Pads()
    }
    config = (HARDWARE / 'firmware/include/config.h').read_text(encoding='utf-8')
    flags = (HARDWARE / 'firmware/platformio.ini').read_text(encoding='utf-8')
    evt = flags.split('[env:evt_4layer_pcb]', 1)[1].split('[env:', 1)[0]
    if '-DCATMOUSE_EVT_4LAYER_PCB' not in evt or '-DARDUINO_USB_CDC_ON_BOOT=1' not in evt:
        raise ValueError('Expected the EVT pin map and USB CDC in platformio.ini')
    firmware = parse_evt_firmware_pins(config)
    expected = [(key, firmware[key], net) for key, net in FW_MACRO_TO_SCH_NET.items()]
    expected += [('USB_D-', 18, 'USB_DN'), ('USB_D+', 19, 'USB_DP'), ('BOOT_STRAP', 9, 'BOOT_SW')]
    pinout = []
    for signal, gpio, expected_net in expected:
        number = str(MINI_GPIO_TO_PAD[gpio])
        key = ('U1', number)
        schematic_net = schematic_pins.get(key)
        pcb_net = pcb_pins.get(key)
        pinout.append({'signal': signal, 'gpio': gpio, 'mini_1_pad': int(number), 'expected': expected_net,
                       'schematic': schematic_net, 'pcb': pcb_net, 'match': schematic_net == pcb_net == expected_net})

    # PCB parity alone cannot verify whether the subcircuit implements the intended contact order.
    interface_pins = {
        'J1': {1: '+5V', 2: 'GND', 3: 'USB_DN_EXT', 4: 'USB_DP_EXT'},
        'J3': {1: 'NFC_ANT1', 2: 'NFC_ANT2'},
        'J5': {1: 'VLED', 2: 'GND', 3: 'LED_DIN_F', 4: 'LED_DOUT_RET'},
        'J6': {1: 'VLED', 2: 'GND', 3: 'LED_DIN_R'},
        'R24': {1: 'LED_DOUT_RET', 2: 'LED_DIN_R'},
        'U2': {5: 'NFC_DVDD', 8: 'NFC_DVDD', 16: 'NFC_DVDD', 17: 'GND', 18: 'GND',
               27: 'I2C_SCL', 28: 'I2C_SDA', 38: 'NFC_RST', 39: 'NFC_DVDD'},
        'U6': {2: 'LED_PWR_EN', 4: 'LED_PWR_GATE'},
        'Q1': {1: 'LED_PWR_GATE', 2: '+BATT', 3: 'VLED'},
    }
    interfaces = {}
    for ref, expected_nets in interface_pins.items():
        interfaces[ref] = all(schematic_pins.get((ref, str(pin))) == pcb_pins.get((ref, str(pin))) == net
                              for pin, net in expected_nets.items())

    bottom = [fp for fp in board.GetFootprints() if fp.GetLayer() == pcb.B_Cu]
    back_fitted = [fp.GetReference() for fp in bottom
                   if not (fp.GetAttributes() & pcb.FP_EXCLUDE_FROM_POS_FILES)]
    nfc = next(fp for fp in board.GetFootprints() if fp.GetReference() == 'U2')
    exposed_pad = next(pad for pad in nfc.Pads() if pad.GetNumber() == '41').GetEffectiveShape(pcb.F_Cu)
    stencil_openings = [pad.GetEffectiveShape(pcb.F_Cu) for pad in nfc.Pads()
                        if not pad.GetNumber() and pad.IsOnLayer(pcb.F_Paste)]
    thermal_vias = [via for via in board.GetTracks()
                    if isinstance(via, pcb.PCB_VIA) and via.GetNetname() == 'GND'
                    and via.GetViaType() == pcb.VIATYPE_THROUGH
                    and exposed_pad.Collide(via.GetPosition())]
    thermal_drills_outside_paste = all(
        not opening.Collide(via.GetPosition(), via.GetDrillValue() // 2)
        for opening in stencil_openings for via in thermal_vias
    )
    rf_areas = [area for area in board.Zones() if area.GetZoneName() == 'BLE antenna no copper']
    rf_keepout = len(rf_areas) == 1 and all(
        area.GetIsRuleArea()
        and all(area.GetLayerSet().Contains(layer) for layer in (pcb.F_Cu, pcb.In1_Cu, pcb.In2_Cu, pcb.B_Cu))
        and area.GetDoNotAllowTracks() and area.GetDoNotAllowVias()
        and area.GetDoNotAllowZoneFills() and area.GetDoNotAllowPads()
        for area in rf_areas
    )

    erc_issues = [issue for sheet in erc_report['sheets'] for issue in sheet['violations']]
    drc_issues = drc_report['violations']
    audit = {
        'kicad': drc_report['kicad_version'],
        'board': board_file.name,
        'copper_layers': board.GetCopperLayerCount(),
        'thickness_mm': pcb.ToMM(board.GetDesignSettings().GetBoardThickness()),
        'bottom_assembly_components': back_fitted,
        'rf_keepout_all_four_layers': rf_keepout,
        'nfc_exposed_pad_ground_vias': len(thermal_vias),
        'nfc_exposed_pad_drills_outside_paste': thermal_drills_outside_paste,
        'erc': dict(Counter(v['severity'] for v in erc_issues)),
        'drc': dict(Counter(v['severity'] for v in drc_issues)),
        'drc_types': dict(Counter(v['type'] for v in drc_issues)),
        'drc_ignored': [v['key'] for v in drc_report['ignored_checks']],
        'unconnected_items': len(drc_report['unconnected_items']),
        'schematic_parity_issues': len(drc_report['schematic_parity']),
        'pinout': pinout,
        'interface_pinouts_match': interfaces,
    }
    audit['eda_checks_pass'] = (
        all(pin['match'] for pin in pinout) and all(interfaces.values())
        and audit['copper_layers'] == 4 and audit['thickness_mm'] == 1 and not back_fitted and rf_keepout
        and len(thermal_vias) >= 4 and thermal_drills_outside_paste
        and not any(audit[key] for key in ('erc', 'drc', 'unconnected_items', 'schematic_parity_issues'))
    )
    return audit, erc_report, drc_report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cli', type=Path, required=True)
    parser.add_argument('--project-directory', type=Path, default=DIRECTORY)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    audit, erc, drc = run_checks(args.cli, args.project_directory.resolve())
    args.out.mkdir(parents=True, exist_ok=True)
    for filename, contents in [('audit.json', audit), ('erc.json', erc), ('drc.json', drc)]:
        (args.out / filename).write_text(json.dumps(contents, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"GPIO checks: {sum(pin['match'] for pin in audit['pinout'])}/{len(audit['pinout'])}")
    print(f"Unconnected: {audit['unconnected_items']}; parity: {audit['schematic_parity_issues']}")
    raise SystemExit(0 if audit['eda_checks_pass'] else 1)
