"""Draw motion studies in the adopted flat-cartoon palette. No generated image pixels are edited."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math

OUT = Path(__file__).resolve().parent
W, H, S, FPS, FRAMES = 400, 700, 2, 20, 48
FONT = "C:/Windows/Fonts/msyh.ttc"
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
INK, MUTED = "#213638", "#60756C"
GREEN, ORANGE, BLUE = "#EAF7DC", "#F36A34", "#3D9BE8"


def f(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size*S)


def box(d, xy, fill, r=0, outline=None, width=1):
    d.rounded_rectangle(tuple(int(v*S) for v in xy), radius=r*S, fill=fill,
                        outline=outline, width=width*S)


def oval(d, xy, fill, outline=None, width=1):
    d.ellipse(tuple(int(v*S) for v in xy), fill=fill, outline=outline, width=width*S)


def line(d, pts, fill, width):
    d.line([(int(x*S), int(y*S)) for x, y in pts], fill=fill, width=width*S, joint="curve")


def text(d, xy, value, size, color=INK, bold=False, anchor=None):
    d.text((int(xy[0]*S), int(xy[1]*S)), value, font=f(size,bold), fill=color, anchor=anchor)


def smooth(t):
    t=max(0,min(1,t))
    return t*t*(3-2*t)


def base(role="猫队", timer="04:32"):
    im=Image.new("RGB",(W*S,H*S),"#F5FAF1")
    d=ImageDraw.Draw(im)
    box(d,(0,0,400,112),"#FFFFFF")
    box(d,(16,16,88,50),"#FFF0E4" if role=="猫队" else GREEN,12)
    text(d,(52,33),role,16,"#C95828" if role=="猫队" else "#286B47",True,"mm")
    text(d,(16,63),"已抓 3 / 4",21,INK,True)
    text(d,(382,67),timer,27,INK,True,"ra")
    box(d,(0,112,400,600),"#BFE9AB")
    for x,y,r in [(39,168,33),(360,185,39),(95,231,27),(334,279,26),(39,348,38),
                  (368,397,31),(80,530,27),(324,532,37),(185,181,24),(226,550,25)]:
        oval(d,(x-r,y-r,x+r,y+r),"#55AD60")
        oval(d,(x-r+8,y-r+8,x+r-6,y+r-6),"#72BE65")
    line(d,[(0,246),(75,274),(146,250),(220,303),(400,270)],"#FFF5D7",18)
    line(d,[(22,600),(84,508),(158,464),(224,385),(400,357)],"#FFF5D7",24)
    line(d,[(168,112),(182,210),(217,303),(214,600)],"#FFF5D7",19)
    oval(d,(78,422,112,456),"#FFFFFF")
    oval(d,(85,429,105,449),BLUE)
    text(d,(119,430),"我的位置",11,INK,True)
    box(d,(0,600,400,700),"#FFFFFF")
    box(d,(18,615,382,670),ORANGE,17)
    text(d,(200,643),"扫码确认抓捕" if role=="猫队" else "展示动态码",18,"#FFFFFF",True,"mm")
    return im


def clue(i):
    im=base(); t=i/(FRAMES-1)
    r=88*smooth(min(1,t/.46))
    lay=Image.new("RGBA",im.size,(0,0,0,0)); d=ImageDraw.Draw(lay)
    if r>0:
        d.ellipse(((257-r)*S,(350-r)*S,(257+r)*S,(350+r)*S),fill=(243,106,52,57),outline=(243,106,52,220),width=3*S)
    im=Image.alpha_composite(im.convert("RGBA"),lay).convert("RGB"); d=ImageDraw.Draw(im)
    if t>.25:
        box(d,(184,274,330,307),"#FFFFFF",15)
        text(d,(257,291),"大致线索区域",12,INK,True,"mm")
    return im


def warning(i):
    im=base("鼠队"); t=i/(FRAMES-1); d=ImageDraw.Draw(im)
    y=700-178*smooth(t/.35)*(1-smooth((t-.77)/.23))
    if y<699:
        box(d,(10,y,390,y+154),"#FFFFFF",23)
        box(d,(23,y+17,377,y+78),"#FFF0E4",17)
        oval(d,(38,y+36,61,y+59),ORANGE)
        text(d,(50,y+48),"!",15,"#FFFFFF",True,"mm")
        text(d,(72,y+31),"附近有猫",17,"#9E4626",True)
        text(d,(72,y+55),"留意周围，安全移动",11,"#9E4626")
        text(d,(200,y+112),"没有敌方位置或方向",11,MUTED,anchor="mm")
    return im


def capture(i):
    im=base(); t=i/(FRAMES-1)
    show=smooth(t/.3)*(1-smooth((t-.8)/.2))
    if show>0:
        y=700-222*show; d=ImageDraw.Draw(im)
        box(d,(0,y,400,720),"#FFFFFF",25)
        oval(d,(168,y+19,232,y+83),"#4BAF5B")
        line(d,[(183,y+51),(196,y+63),(218,y+38)],"#FFFFFF",5)
        text(d,(200,y+106),"抓捕已确认",22,INK,True,"mm")
        text(d,(200,y+143),"双方结果已同步",12,MUTED,anchor="mm")
        box(d,(25,y+171,375,y+211),GREEN,12)
        text(d,(200,y+191),"已抓 4 / 4 · 猫队获胜",15,"#286B47",True,"mm")
    return im


def hiding(i):
    t=i/(FRAMES-1)
    sec=3-min(3,math.floor(t*4))
    im=base("鼠队",f"00:0{sec}"); d=ImageDraw.Draw(im)
    box(d,(77,246,323,407),"#FFFFFF",26)
    box(d,(96,264,304,301),"#DDF3FF",13)
    text(d,(200,283),"躲藏阶段" if sec else "追逐开始",16,"#315961",True,"mm")
    text(d,(200,355),str(sec) if sec else "出发",48,ORANGE,True,"mm")
    return im


def main():
    for name,fn in [("01_躲藏转追逐",hiding),("02_区域线索",clue),
                    ("03_近距预警",warning),("04_抓捕确认",capture)]:
        frames=[fn(i).resize((W,H),Image.Resampling.LANCZOS) for i in range(FRAMES)]
        frames[0].save(OUT/f"{name}.gif",save_all=True,append_images=frames[1:],
                       duration=1000//FPS,loop=0,optimize=True)
        print(OUT/f"{name}.gif")


if __name__=="__main__":
    main()
