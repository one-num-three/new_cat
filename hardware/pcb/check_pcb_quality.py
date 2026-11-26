"""
CatMouse Band V1.5 硬件工程一键质量门禁脚本：
1. KiCad 10 官方原理图 ERC 电气检测 (--severity-all)
2. KiCad 10 官方 4 层 PCB DRC 设计规则检测 (--severity-all)
3. 官方网表 (.net) <-> EVT 4 层主板固件 (config.h) 12 引脚一致性校验
"""
import collections
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROJ_DIR = ROOT / "pcb" / "catmouse-band-v15"
KICAD_CLI = r"D:\Program Files\KiCad\bin\kicad-cli.exe"
SCH = PROJ_DIR / "catmouse-band-v15.kicad_sch"
PCB = PROJ_DIR / "catmouse-band-v15.kicad_pcb"
ERC_JSON = PROJ_DIR / "erc_report.json"
DRC_JSON = PROJ_DIR / "drc_report.json"


def main():
    print("[GATE 1/3] Running KiCad 10 official Schematic ERC...")
    subprocess.run([KICAD_CLI, "sch", "erc", "--severity-all", "--format", "json", "-o", str(ERC_JSON), str(SCH)], check=False)
    erc = json.loads(ERC_JSON.read_text(encoding="utf-8"))
    erc_v = [v for s in erc.get("sheets", []) for v in s.get("violations", [])]
    print(f"           ERC violations = {len(erc_v)}")
    assert len(erc_v) == 0, f"ERC failed with {len(erc_v)} violations"

    print("[GATE 2/3] Running KiCad 10 official 4-Layer PCB DRC...")
    subprocess.run([KICAD_CLI, "pcb", "drc", "--severity-all", "--format", "json", "-o", str(DRC_JSON), str(PCB)], check=False)
    drc = json.loads(DRC_JSON.read_text(encoding="utf-8"))
    vs = drc.get("violations", [])
    uc = drc.get("unconnected_items", [])
    errs = [v for v in vs if v["severity"] == "error"]
    warns = [v for v in vs if v["severity"] == "warning"]
    print(f"           DRC errors = {len(errs)}, warnings = {len(warns)}, unconnected = {len(uc)}")
    if errs or uc:
        print("           Breakdown:", collections.Counter((v["severity"], v["type"]) for v in vs))

    print("[GATE 3/3] Verifying KiCad official netlist <-> EVT firmware pinout...")
    r = subprocess.run([sys.executable, str(ROOT / "pcb" / "verify_netlist_vs_firmware.py")], capture_output=True, text=True)
    print(r.stdout.strip())
    assert r.returncode == 0, f"Netlist alignment failed:\n{r.stderr}"

    if errs or uc:
        sys.exit(1)
    print("\n=== ALL HARDWARE QUALITY GATES PASSED (0 ERC, 0 DRC ERRORS, 0 UNCONNECTED)! ===")


if __name__ == "__main__":
    main()
