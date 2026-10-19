"""Bundle untouched generated PNGs into editable layered SVG concepts."""
from pathlib import Path
from base64 import b64encode
from xml.etree import ElementTree as ET

ROOT = Path(__file__).parent
SKILLS = [
    ("invisible", "隐身", "轮廓渐隐", "#D9F2FF"),
    ("eagle-eye", "鹰眼", "宽域展开", "#D9F2FF"),
    ("golden-body", "金身", "保护圈轻脉冲", "#FFF0B8"),
    ("bombard-area", "区域标记", "区域柔和落印", "#FFE2C9"),
    ("speed", "加速", "短距离动线", "#D9F2FF"),
    ("radar", "雷达", "宽域扫描", "#D9F2FF"),
]


def img(name):
    source = ROOT / "source" / f"{name}.png"
    return "data:image/png;base64," + b64encode(source.read_bytes()).decode("ascii")


def motion(name, label, caption, tint):
    # PNG stays embedded byte-for-byte; all animation is editable SVG transform/opacity.
    anim = {
        "invisible": '<animate attributeName="opacity" values="1;.28;1" dur="2.4s" repeatCount="indefinite"/>',
        "eagle-eye": '<animateTransform attributeName="transform" type="scale" values="1;1.065;1" dur="2.4s" repeatCount="indefinite"/>',
        "golden-body": '<animateTransform attributeName="transform" type="scale" values="1;1.055;1" dur="2.4s" repeatCount="indefinite"/>',
        "bombard-area": '<animateTransform attributeName="transform" type="translate" values="0 -8;0 3;0 -8" dur="2.4s" repeatCount="indefinite"/>',
        "speed": '<animateTransform attributeName="transform" type="translate" values="-8 0;10 0;-8 0" dur="1.4s" repeatCount="indefinite"/>',
        "radar": '<animateTransform attributeName="transform" type="rotate" values="-7;7;-7" dur="2.4s" repeatCount="indefinite"/>',
    }[name]
    ring = '' if name not in ('golden-body', 'radar', 'bombard-area') else f'''<circle cx="180" cy="172" r="123" fill="none" stroke="{tint}" stroke-width="9" opacity="0"><animate attributeName="opacity" values="0;.85;0" dur="2.4s" repeatCount="indefinite"/><animate attributeName="r" values="106;134;134" dur="2.4s" repeatCount="indefinite"/></circle>'''
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="360" height="420" viewBox="0 0 360 420">
<rect width="360" height="420" rx="34" fill="#F8FCFA"/>
<rect x="16" y="16" width="328" height="388" rx="27" fill="white" stroke="#DCEDE5" stroke-width="2"/>
<circle cx="180" cy="172" r="132" fill="{tint}"/>
{ring}
<g transform="translate(180 172)"><g>{anim}<image x="-126" y="-126" width="252" height="252" href="{img(name)}"/></g></g>
<text x="32" y="346" fill="#203A34" font-family="Microsoft YaHei,Arial,sans-serif" font-size="27" font-weight="700">{label}</text>
<text x="32" y="379" fill="#5B756C" font-family="Microsoft YaHei,Arial,sans-serif" font-size="16">{caption} · 概念动效</text>
</svg>'''
    (ROOT / "motion" / f"{name}.svg").write_text(svg, encoding="utf-8")


def panel():
    rows = []
    for index, (name, label, caption, tint) in enumerate(SKILLS):
        col, row = index % 2, index // 2
        x, y = 28 + col * 182, 205 + row * 180
        rows.append(f'''<g inkscape:groupmode="layer" inkscape:label="卡片 {index+1} {label}" id="card-{name}">
<rect x="{x}" y="{y}" width="168" height="164" rx="22" fill="white" stroke="#DCEDE5" stroke-width="2"/>
<circle cx="{x+47}" cy="{y+51}" r="37" fill="{tint}"/>
<image x="{x+10}" y="{y+14}" width="74" height="74" href="{img(name)}"/>
<text x="{x+15}" y="{y+112}" fill="#203A34" font-family="Microsoft YaHei,Arial,sans-serif" font-size="20" font-weight="700">{label}</text>
<text x="{x+15}" y="{y+139}" fill="#5B756C" font-family="Microsoft YaHei,Arial,sans-serif" font-size="13">{caption}</text>
</g>''')
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="390" height="844" viewBox="0 0 390 844">
<g inkscape:groupmode="layer" inkscape:label="背景" id="background"><rect width="390" height="844" fill="#F8FCFA"/><path d="M0 0H390V164H0Z" fill="#D9F2FF"/></g>
<g inkscape:groupmode="layer" inkscape:label="标题与未启用状态" id="header"><text x="28" y="69" fill="#203A34" font-family="Microsoft YaHei,Arial,sans-serif" font-size="28" font-weight="700">技能视觉库</text><text x="28" y="105" fill="#496960" font-family="Microsoft YaHei,Arial,sans-serif" font-size="15">未来规则概念 · 当前试点未启用</text><rect x="28" y="124" width="146" height="28" rx="14" fill="#FFFFFF"/><text x="45" y="143" fill="#7A5D36" font-family="Microsoft YaHei,Arial,sans-serif" font-size="13">仅供设计评审</text></g>
''' + '\n'.join(rows) + '''
<g inkscape:groupmode="layer" inkscape:label="底部说明" id="footer"><text x="28" y="779" fill="#5B756C" font-family="Microsoft YaHei,Arial,sans-serif" font-size="14">正式启用需要新规则版本与服务端裁决。</text><text x="28" y="806" fill="#5B756C" font-family="Microsoft YaHei,Arial,sans-serif" font-size="14">图标不代表现行技能或可购买道具。</text></g>
</svg>'''
    (ROOT / "skill-panel-layered.svg").write_text(svg, encoding="utf-8")


if __name__ == "__main__":
    for item in SKILLS:
        motion(*item)
    panel()
    for svg in [ROOT / 'skill-panel-layered.svg', *(ROOT / 'motion').glob('*.svg')]:
        ET.parse(svg)
    print('Built 6 animated SVGs and layered panel')
