"""Render small transparent map markers from independent vector artwork."""

from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parents[2] / "assets" / "markers-v1"
OUT.mkdir(parents=True, exist_ok=True)
(ROOT / "vector").mkdir(exist_ok=True)


def document(body):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
<title>猫鼠行动地图标记</title>{body}</svg>'''


MARKERS = {
    "cat": document('''<circle cx="48" cy="51" r="42" fill="white"/>
<path d="M16 43 L20 14 Q21 9 27 14 L37 25 Q48 21 59 25 L70 14 Q76 9 77 16 L80 43 Q84 69 65 78 Q48 88 30 78 Q12 69 16 43Z" fill="#F36A34"/>
<ellipse cx="48" cy="56" rx="27" ry="23" fill="#FFF9EE"/>
<ellipse cx="38" cy="53" rx="3" ry="5" fill="#213638"/><ellipse cx="58" cy="53" rx="3" ry="5" fill="#213638"/>
<path d="M45 63 Q48 66 51 63" fill="none" stroke="#213638" stroke-width="3" stroke-linecap="round"/>'''),
    "mouse": document('''<circle cx="48" cy="52" r="42" fill="white"/>
<circle cx="25" cy="30" r="20" fill="#4B535E"/><circle cx="71" cy="30" r="20" fill="#4B535E"/>
<circle cx="25" cy="30" r="11" fill="#F3A7AD"/><circle cx="71" cy="30" r="11" fill="#F3A7AD"/>
<circle cx="48" cy="55" r="30" fill="#4B535E"/>
<ellipse cx="39" cy="53" rx="3" ry="5" fill="white"/><ellipse cx="57" cy="53" rx="3" ry="5" fill="white"/>
<path d="M44 64 Q48 68 52 64" fill="none" stroke="#F3A7AD" stroke-width="3" stroke-linecap="round"/>'''),
    "self": document('''<circle cx="48" cy="48" r="43" fill="white"/>
<circle cx="48" cy="48" r="32" fill="#3D9BE8"/>
<circle cx="48" cy="48" r="15" fill="white"/>'''),
    "venue": document('''<circle cx="48" cy="48" r="43" fill="white"/>
<path d="M48 9 C27 9 14 24 14 43 C14 65 48 88 48 88 C48 88 82 65 82 43 C82 24 69 9 48 9Z" fill="#286B47"/>
<path d="M41 27 V59 M42 28 H64 L57 38 L64 49 H42" fill="none" stroke="#FFF9EE" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>'''),
}


for name, source in MARKERS.items():
    (ROOT / "vector" / f"{name}.svg").write_text(source, encoding="utf-8")
    doc = fitz.open(stream=source.encode("utf-8"), filetype="svg")
    pix = doc[0].get_pixmap(alpha=True)
    pix.save(OUT / f"{name}.png")
    print(OUT / f"{name}.png")
