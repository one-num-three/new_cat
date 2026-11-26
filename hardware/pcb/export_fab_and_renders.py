"""
一键导出嘉立创 4 层板打样生产文件包 + KiCad 10 高清 3D / 2D 视觉质检图：
- Gerbers (F.Cu, In1.Cu, In2.Cu, B.Cu, F.Mask, B.Mask, F.SilkS, B.SilkS, F.Paste, B.Paste, Edge.Cuts)
- Excellon Drill (.drl + map)
- Pick-and-Place 贴片坐标 (CPL .csv)
- 3D 渲染高清预览图 (top_3d.png, bottom_3d.png, iso_3d.png) + 原理图 SVG
"""
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROJ_DIR = ROOT / "pcb" / "catmouse-band-v15"
PROJ_NAME = "catmouse-band-v15"
KICAD_CLI = r"D:\Program Files\KiCad\bin\kicad-cli.exe"
SCH = PROJ_DIR / f"{PROJ_NAME}.kicad_sch"
PCB = PROJ_DIR / f"{PROJ_NAME}.kicad_pcb"
FAB_DIR = PROJ_DIR / "fab_jlcpcb"
PREVIEW_DIR = PROJ_DIR / "previews"


def run(args):
    res = subprocess.run([KICAD_CLI, *args], capture_output=True, text=True)
    if res.returncode != 0:
        print(res.stdout)
        print(res.stderr, file=sys.stderr)
        raise RuntimeError(f"kicad-cli failed: {args}")
    return res.stdout.strip()


def export_all():
    FAB_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    print("[1/5] 导出 4 层 Gerber 文件...")
    run([
        "pcb", "export", "gerbers",
        "-o", str(FAB_DIR),
        "-l", "F.Cu,In1.Cu,In2.Cu,B.Cu,F.Mask,B.Mask,F.SilkS,B.SilkS,F.Paste,B.Paste,Edge.Cuts",
        "--subtract-soldermask",
        str(PCB),
    ])

    print("[2/5] 导出 Excellon 钻孔文件...")
    run([
        "pcb", "export", "drill",
        "-o", str(FAB_DIR) + "\\",
        "--format", "excellon",
        "--drill-origin", "absolute",
        "--excellon-units", "mm",
        str(PCB),
    ])

    print("[3/5] 导出 SMT 贴片坐标文件 (CPL) 与 BOM...")
    run([
        "pcb", "export", "pos",
        "-o", str(FAB_DIR / f"{PROJ_NAME}-cpl.csv"),
        "--format", "csv",
        "--units", "mm",
        "--side", "both",
        str(PCB),
    ])
    run([
        "sch", "export", "bom",
        "-o", str(FAB_DIR / f"{PROJ_NAME}-bom.csv"),
        str(SCH),
    ])

    print("[4/5] 渲染 KiCad 10 高清 3D 预览图 (Top / Bottom / 3D透视)...")
    for name, side, extra in [
        ("top_3d.png", "top", ["--zoom", "0.90"]),
        ("bottom_3d.png", "bottom", ["--zoom", "0.90"]),
        ("iso_3d.png", "top", ["--perspective", "--rotate", "-35,0,25", "--zoom", "0.88"]),
    ]:
        run([
            "pcb", "render",
            "-o", str(PREVIEW_DIR / name),
            "-w", "1400", "-h", "1400",
            "--side", side,
            "--background", "opaque",
            "--quality", "basic",
            *extra,
            str(PCB),
        ])

    print("[5/5] 导出原理图 PDF 与 PCB 2D 分层 SVG...")
    run(["sch", "export", "pdf", "-o", str(PREVIEW_DIR / f"{PROJ_NAME}-schematic.pdf"), str(SCH)])
    run([
        "pcb", "export", "svg",
        "-o", str(PREVIEW_DIR / f"{PROJ_NAME}-all-layers.svg"),
        "-l", "F.Cu,In1.Cu,In2.Cu,B.Cu,F.SilkS,B.SilkS,Edge.Cuts",
        "--page-size-mode", "2",
        str(PCB),
    ])
    print(f"[PASS] 生产包已导出至: {FAB_DIR} ({len(list(FAB_DIR.glob('*')))} 个文件)")
    print(f"[PASS] 视觉质检图已导出至: {PREVIEW_DIR}")


if __name__ == "__main__":
    export_all()
