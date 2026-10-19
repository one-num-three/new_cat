from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
import json,os
R=Path(__file__).resolve().parents[1];O=R/'output'
font='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';bold='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
def f(n,b=False):return ImageFont.truetype(bold if b else font,n)
proj=json.load(open(O/'label_projections.json'))
views=[('01_campus_overview_raw.png','01_全校区鸟瞰.png','全校区 · 东南鸟瞰','01 全校区 · 东南鸟瞰',['图书馆','本科教学区','能环楼 57 m','信息电子 55.8 m','游泳馆 11.05 m']),('02_campus_top_raw.png','02_全校区俯视.png','全校区 · 北向正俯视','02 全校区 · 正北俯视',None),('03_central_close_raw.png','03_中心教学区.png','图书馆与本科教学区 · 局部','03 图书馆与教学区',['图书馆','本科教学区','信息电子 55.8 m','游泳馆 11.05 m'])]
for raw,output,title,key,selected in views:
 if os.environ.get('PREVIEW_NAME') and not raw.startswith(os.environ['PREVIEW_NAME']):continue
 if not (O/raw).exists():continue
 im=Image.open(O/raw).convert('RGB');w,h=im.size;bg=im.getpixel((0,0));canvas=Image.new('RGB',(w,h+310),bg);canvas.paste(im,(0,150));d=ImageDraw.Draw(canvas)
 d.text((66,32),'东南大学 · 九龙湖校区',font=f(47,True),fill=(34,57,50))
 d.text((68,100),title+'  /  可编辑建筑体量示意 v1',font=f(26),fill=(64,82,72))
 d.text((w-430,48),'SEU  /  JIULONGHU',font=f(23,True),fill=(61,81,72))
 d.text((w-430,85),'2025底图 · 兰园现状已校正',font=f(20),fill=(81,95,85))
 for p in proj[key]:
  label=p['label'].replace('九龙湖','校内湖区')
  if selected is not None and label not in selected:continue
  x=int(p['x']*w);y=int(p['y']*h)+150
  if not(95<x<w-150 and 240<y<h+110):continue
  offx,offy=(0,-53)
  if label=='图书馆':offx=-45
  if label.startswith('信息'):offx=42;offy=-65
  if label.startswith('游泳'):offx=42;offy=-28
  if label=='南门':offy=37
  if title.startswith('全校区 · 北'):offx=0;offy=-20
  bb=d.textbbox((0,0),label,font=f(24,True));tw=bb[2]-bb[0];th=bb[3]-bb[1]
  tx=max(40,min(w-tw-40,x+offx-tw/2));ty=y+offy-th
  d.line((x,y,x+offx,ty+th+12),fill=(72,89,79),width=2);d.ellipse((x-4,y-4,x+4,y+4),fill=(45,77,66))
  d.rounded_rectangle((tx-12,ty-7,tx+tw+12,ty+th+14),radius=6,fill=(240,242,231),outline=(180,193,177),width=1)
  d.text((tx,ty-6),label,font=f(24,True),fill=(42,66,55))
 if '正俯视' in title:
  ax,ay=w-95,225;d.line((ax,ay+90,ax,ay+25),fill=(34,57,50),width=4);d.polygon([(ax,ay+12),(ax-12,ay+37),(ax+12,ay+37)],fill=(34,57,50));d.text((ax-10,ay-23),'N',font=f(26,True),fill=(34,57,50))
 y=h+175;d.line((66,y-16,w-66,y-16),fill=(160,175,156),width=2)
 legend=[((226,224,199),'已建 · 高度估算'),((31,91,91),'米数有来源'),((166,186,156),'层数有据 · 米数估算'),((175,104,62),'在建'),((142,174,185),'规划／待核')]
 x=68
 for color,lab in legend:
  d.rounded_rectangle((x,y,x+32,y+24),radius=3,fill=color);d.text((x+44,y-6),lab,font=f(23),fill=(47,66,54));x+=[440,390,530,390,360][legend.index((color,lab))]
 d.text((68,h+225),'439个可编辑体量构件，非439栋楼。轮廓为近似描摹，未核实高度均保留估计标签。',font=f(23),fill=(67,83,70))
 d.text((68,h+262),'2025总图底本，兰园宿舍已按最新确认改为已建；其余状态与高度限制见说明。非测绘／非室内导航。',font=f(21),fill=(84,98,87))
 canvas.save(O/output)
 print(output,canvas.size)
