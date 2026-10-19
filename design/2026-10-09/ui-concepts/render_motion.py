"""Render three independent UI motion studies. These are visual prototypes, not live game screens."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math

OUT = Path(__file__).resolve().parent
W, H = 400, 720
SCALE = 2
FRAMES = 60
FPS = 20
FONT = "C:/Windows/Fonts/msyh.ttc"
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size * SCALE)


def mix(a, b, t):
    return tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))


def ease(t):
    t = max(0, min(1, t))
    return t * t * (3 - 2 * t)


def rect(d, xy, fill, radius=0, outline=None, width=1):
    d.rounded_rectangle(tuple(int(v * SCALE) for v in xy), radius * SCALE,
                        fill=fill, outline=outline, width=width * SCALE)


def ellipse(d, xy, fill, outline=None, width=1):
    d.ellipse(tuple(int(v * SCALE) for v in xy), fill=fill,
              outline=outline, width=width * SCALE)


def line(d, pts, fill, width=1):
    d.line([(int(x * SCALE), int(y * SCALE)) for x, y in pts], fill=fill,
           width=width * SCALE, joint="curve")


def txt(d, xy, value, fill, size=16, bold=False, anchor=None):
    d.text((int(xy[0] * SCALE), int(xy[1] * SCALE)), value, font=font(size, bold),
           fill=fill, anchor=anchor)


PALETTES = {
    "A_城市指南": dict(bg="#F7F5EF", ink="#172C2C", muted="#647372", map="#EAF0E6",
                    road="#FFFFFF", minor="#D6DDD3", cat="#ED632B", clue="#269C9A",
                    water="#C7E9ED", panel="#FFFFFF", border="#D5DDD6"),
    "B_夜间信号": dict(bg="#081828", ink="#F3F8FC", muted="#9AB2C3", map="#0D2638",
                    road="#1D4153", minor="#173444", cat="#F6B239", clue="#4CD9EF",
                    water="#123249", panel="#102B3D", border="#2E596A"),
    "C_户外手册": dict(bg="#F2EBD8", ink="#263B2D", muted="#6C7866", map="#E6E6D2",
                    road="#FFFDF3", minor="#C7CFB8", cat="#BE6947", clue="#426C52",
                    water="#CBDCCE", panel="#FAF7E9", border="#BCC6AA"),
}


def map_layer(d, p, variant):
    rect(d, (0, 156, W, 626), p["map"])
    if variant == "C_户外手册":
        for j in range(7):
            y = 182 + j * 65
            pts = [(0, y + 14 * math.sin((x + j * 23) / 45)) for x in range(0, 401, 8)]
            line(d, pts, p["minor"], 1)
    else:
        for x in [24, 87, 157, 230, 308, 385]:
            line(d, [(x, 156), (x + 55, 626)], p["minor"], 4)
        for y in [211, 283, 357, 438, 537, 600]:
            line(d, [(0, y + 34), (W, y - 16)], p["minor"], 4)
    # Water and paths stay deliberately schematic: the clue is an area, not a target dot.
    d.polygon([(0, 500*SCALE), (75*SCALE, 468*SCALE), (108*SCALE, 626*SCALE),
               (0, 626*SCALE)], fill=p["water"])
    line(d, [(45, 605), (95, 522), (148, 492), (218, 461), (280, 365), (400, 322)],
         p["road"], 15)
    line(d, [(0, 320), (82, 340), (130, 274), (222, 245), (400, 275)], p["road"], 12)
    line(d, [(170, 156), (184, 268), (237, 355), (225, 626)], p["road"], 12)
    if variant == "C_户外手册":
        txt(d, (25, 276), "林间步道", p["muted"], 11)
        txt(d, (281, 504), "草坪", p["muted"], 11)
    else:
        txt(d, (19, 267), "公园入口", p["muted"], 11)
        txt(d, (278, 507), "中央草坪", p["muted"], 11)


def draw_frame(variant, idx):
    p = PALETTES[variant]
    t = idx / FPS
    im = Image.new("RGB", (W*SCALE, H*SCALE), p["bg"])
    d = ImageDraw.Draw(im)
    rect(d, (0, 0, W, H), p["bg"])
    txt(d, (22, 18), "猫鼠行动", p["ink"], 13, True)
    txt(d, (342, 18), "试点规则", p["muted"], 10)
    txt(d, (22, 51), "猫队", p["cat"], 27, True)
    txt(d, (109, 58), "已抓 3 / 4", p["ink"], 15, True)
    txt(d, (375, 59), "04:32", p["ink"], 24, True, "ra")
    txt(d, (22, 112), "下一条区域线索", p["muted"], 11)
    txt(d, (22, 131), "地图仅显示服务端授权信息", p["muted"], 10)
    rect(d, (0, 155, W, 156), p["border"])
    map_layer(d, p, variant)

    # An approximate clue zone blooms and gently pulses, never revealing mouse coordinates.
    pulse = (t * 1.1) % 1
    radius = 66 + 23 * pulse
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    cx, cy = 260, 350
    for ring, alpha in [(radius + 28, 18), (radius + 12, 28), (radius, 46)]:
        ld.ellipse(((cx-ring)*SCALE, (cy-ring)*SCALE, (cx+ring)*SCALE, (cy+ring)*SCALE),
                   fill=tuple(bytes.fromhex(p["clue"][1:])) + (alpha,))
    ld.ellipse(((cx-radius)*SCALE, (cy-radius)*SCALE, (cx+radius)*SCALE, (cy+radius)*SCALE),
               outline=tuple(bytes.fromhex(p["clue"][1:])) + (175,), width=3*SCALE)
    im = Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")
    d = ImageDraw.Draw(im)
    rect(d, (187, 286, 333, 320), p["panel"], 16, p["border"])
    txt(d, (260, 303), "大致位置线索", p["ink"], 12, True, "mm")
    # Blue dot marks only the current user's own reported location.
    ellipse(d, (109, 439, 137, 467), "#FFFFFF")
    ellipse(d, (115, 445, 131, 461), "#3B91D2")
    txt(d, (141, 448), "我的位置", p["ink"], 12, True)
    rect(d, (0, 626, W, H), p["bg"])
    rect(d, (18, 640, 382, 697), p["cat"], 18)
    txt(d, (200, 668), "扫码确认抓捕", "#FFFFFF", 18, True, "mm")

    # A restrained confirmation sheet enters, holds, and exits so the loop is legible.
    show = ease((t - 1.15) / .35) * (1 - ease((t - 2.5) / .35))
    if show > 0:
        y = 720 - show * 224
        shade = Image.new("RGBA", im.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(shade)
        sd.rectangle((0, 0, W*SCALE, H*SCALE), fill=(0, 0, 0, round(55*show)))
        im = Image.alpha_composite(im.convert("RGBA"), shade).convert("RGB")
        d = ImageDraw.Draw(im)
        rect(d, (0, y, W, 740), p["panel"], 24)
        rect(d, (172, y+10, 228, y+14), p["border"], 3)
        ellipse(d, (25, y+34, 69, y+78), p["clue"])
        txt(d, (47, y+56), "✓", "#FFFFFF", 23, True, "mm")
        txt(d, (86, y+31), "抓捕已确认", p["ink"], 19, True)
        txt(d, (86, y+61), "双方状态同步更新", p["muted"], 11)
        rect(d, (20, y+101, 380, y+162), p["bg"], 12)
        txt(d, (39, y+115), "本局进度", p["muted"], 11)
        txt(d, (39, y+133), "已抓 4 / 4  ·  猫队获胜", p["ink"], 16, True)
        txt(d, (200, y+190), "动画演示 · 非实时对局", p["muted"], 10, anchor="mm")
    else:
        txt(d, (200, 711), "动画演示 · 非实时对局", p["muted"], 9, anchor="mm")
    return im.resize((W, H), Image.Resampling.LANCZOS)


def main():
    for variant in PALETTES:
        frames = [draw_frame(variant, i) for i in range(FRAMES)]
        frames[0].save(OUT / f"{variant}.gif", save_all=True, append_images=frames[1:],
                       duration=1000//FPS, loop=0, optimize=True)
        frames[0].save(OUT / f"{variant}_首帧.png")
        print(OUT / f"{variant}.gif")


if __name__ == "__main__":
    main()
