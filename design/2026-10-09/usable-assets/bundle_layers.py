"""Embed the untouched transparent PNGs into the editable SVG layer documents."""

from pathlib import Path
import base64

ROOT = Path(__file__).resolve().parent
for name in ("home-layered", "map-layered"):
    source = ROOT / f"{name}.svg"
    svg = source.read_text(encoding="utf-8")
    for asset in sorted((ROOT / "source").glob("*.png")):
        data = base64.b64encode(asset.read_bytes()).decode("ascii")
        svg = svg.replace(f"source/{asset.name}", f"data:image/png;base64,{data}")
    output = ROOT / f"{name}-standalone.svg"
    output.write_text(svg, encoding="utf-8")
    print(output)
