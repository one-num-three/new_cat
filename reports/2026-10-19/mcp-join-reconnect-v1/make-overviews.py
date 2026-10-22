"""Compose screenshot contact sheets; original PNGs are never changed."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent
rows = json.loads((root / 'captures.json').read_text(encoding='utf-8'))
font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 18)
small = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 15)
title = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 26)

def compose(names, output, columns, width, heading, captions=None):
    margin, gap, top, footer = 20, 16, 85, 66
    height = round(width * 1402 / 648)
    count_rows = (len(names) + columns - 1) // columns
    canvas = Image.new('RGB', (margin * 2 + columns * width + (columns - 1) * gap,
                               top + count_rows * (height + footer + gap) + margin), '#f5f4eb')
    draw = ImageDraw.Draw(canvas)
    draw.text((margin, 14), heading, font=title, fill='#213638')
    draw.text((margin, 51), '微信 MCP 原始截图拼版 · 1 个模拟器 / 10 个授权 WS · 模拟 GPS', font=small, fill='#596760')
    for i, name in enumerate(names):
        row = next(r for r in rows if r['name'] == name)
        x, y = margin + (i % columns) * (width + gap), top + (i // columns) * (height + footer + gap)
        image = Image.open(root / 'screenshots' / row['screenshot']).convert('RGB')
        scale = width / image.width
        image = image.resize((width, round(image.height * scale)), Image.Resampling.LANCZOS)
        canvas.paste(image, (x, y))
        label = (captions or {}).get(name, row['label'])
        role = '猫' if row['role'] == 'cat' else '鼠'
        state = '已被捕获' if row['status'] == 'captured' else '活跃'
        draw.text((x, y + height + 6), label, font=font, fill='#213638')
        draw.text((x, y + height + 33), f'{role}队 · {state} · {row["captured"]}/{row["target"]}', font=small, fill='#596760')
    canvas.save(root / output)

compose([f'player-{i:02d}' for i in range(1, 11)], 'all-players-overview.png', 5, 250,
        '10 个身份 · 追逐阶段 · 全员同步核对')
compose(['11-network-lost', '12-same-page-recovered', '13-host-resumed', '14-returned-player-active'],
        'reconnect-overview.png', 4, 280, '断线 → 自动重连 → 房主恢复 → 原身份继续', {
            '11-network-lost': '① 断线 · 隐藏位置',
            '12-same-page-recovered': '② 原页连回 · 保持暂停',
            '13-host-resumed': '③ 被捕房主恢复 · 不复活',
            '14-returned-player-active': '④ P09 · 原鼠队身份继续',
        })
print('Created 2 contact sheets; 15 original screenshots preserved.')
