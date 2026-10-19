"""Record SHA-256 of selected art, concept art and runtime derivatives."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "design/2026-10-09/frozen/v1/art-manifest.json"
GROUPS = {
    "locked_master": [ROOT / "design/2026-10-09/frozen/v1/selected-icon-master.png",
                      ROOT / "design/2026-10-09/usable-assets/source",
                      ROOT / "design/2026-10-09/usable-assets/vector",
                      ROOT / "design/2026-10-09/skills/source"],
    "runtime_derivative": [ROOT / "assets/brand", ROOT / "assets/markers-v1"],
    "reference_only": [ROOT / "design/2026-10-09/brand-exploration",
                       ROOT / "design/2026-10-09/selected-style-system",
                       ROOT / "design/2026-10-09/ui-concepts",
                       ROOT / "design/2026-10-09/usable-assets/home-layered.svg",
                       ROOT / "design/2026-10-09/usable-assets/home-layered-standalone.svg",
                       ROOT / "design/2026-10-09/usable-assets/home-layered-preview.png",
                       ROOT / "design/2026-10-09/usable-assets/map-layered.svg",
                       ROOT / "design/2026-10-09/usable-assets/map-layered-standalone.svg",
                       ROOT / "design/2026-10-09/usable-assets/map-layered-preview.png",
                       ROOT / "design/2026-10-09/skills/motion",
                       ROOT / "design/2026-10-09/skills/skill-panel-layered.svg",
                       ROOT / "design/2026-10-09/skills/skill-panel-preview.png",
                       ROOT / "assets/markers"],
}
EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".svg"}


def files(path):
    return [path] if path.is_file() else sorted(p for p in path.rglob("*") if p.is_file() and p.suffix.lower() in EXTENSIONS)


def entries():
    items = []
    seen = set()
    for status, paths in GROUPS.items():
        for path in paths:
            for file in files(path):
                relative = file.relative_to(ROOT).as_posix()
                if relative in seen:
                    raise ValueError(f"Duplicate manifest entry: {relative}")
                seen.add(relative)
                items.append({"path": relative, "status": status, "bytes": file.stat().st_size,
                              "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})
    return sorted(items, key=lambda item: item["path"])


def main():
    import sys
    result = {"version": "visual-1.0", "selected_reference": "brand-exploration/02_小程序图标_12款.png #01",
              "note": "reference_only is archived exploration, not approved runtime art",
              "assets": entries()}
    payload = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if "--update" not in sys.argv:
        if not DEST.exists() or DEST.read_text(encoding="utf-8") != payload:
            raise SystemExit("Art manifest mismatch: inspect changes before regenerating")
        print(f"Verified {len(result['assets'])} frozen art files")
    else:
        DEST.parent.mkdir(parents=True, exist_ok=True)
        DEST.write_text(payload, encoding="utf-8")
        print(f"Recorded {len(result['assets'])} art files in {DEST}")


if __name__ == "__main__":
    main()
