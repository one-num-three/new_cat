"""Build small runtime copies from frozen art without changing design masters."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "design/2026-10-09/usable-assets/source"
BRAND = ROOT / "assets/brand"
FROZEN = ROOT / "design/2026-10-09/frozen/v1"

ITEMS = {
    "selected-icon.png": (FROZEN / "selected-icon-master.png", 192),
    "cat-runner.png": (SOURCE / "cat-runner.png", 384),
    "mouse-runner.png": (SOURCE / "mouse-runner.png", 320),
    "captured-mouse.png": (SOURCE / "captured-mouse.png", 288),
    "reconnecting.png": (SOURCE / "reconnecting.png", 288),
    "cat-win.png": (SOURCE / "cat-win.png", 320),
    "mouse-win.png": (SOURCE / "mouse-win.png", 320),
}


def main():
    manifest = json.loads((FROZEN / "art-manifest.json").read_text(encoding="utf-8"))
    locked = {item["path"]: item["sha256"] for item in manifest["assets"] if item["status"] == "locked_master"}
    BRAND.mkdir(parents=True, exist_ok=True)
    for name, (source, bound) in ITEMS.items():
        if not source.exists():
            raise FileNotFoundError(f"Frozen master missing: {source}")
        relative = source.relative_to(ROOT).as_posix()
        if hashlib.sha256(source.read_bytes()).hexdigest() != locked.get(relative):
            raise ValueError(f"Frozen master changed: {relative}; review and version art first")
        with Image.open(source) as image:
            image = image.convert("RGBA")
            image.thumbnail((bound, bound), Image.Resampling.LANCZOS)
            image.save(BRAND / name, format="PNG", optimize=True)
        print(f"{name}: {image.width}x{image.height}, {(BRAND/name).stat().st_size} bytes")


if __name__ == "__main__":
    main()
