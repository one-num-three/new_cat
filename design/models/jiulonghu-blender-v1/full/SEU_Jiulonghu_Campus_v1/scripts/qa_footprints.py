from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,math
R=Path(__file__).resolve().parents[1];B=json.load(open(R/'data/buildings.json'))
# verify source coordinate polygon integrity, not survey correctness
assert len({a['id']for a in B})==len(B)
errs=[]
def cross(a,b,c):return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
for a in B:
 p=a['footprint_px'];n=len(p)
 assert n>=3 and a['height_m']>0
 for i in range(n):
  for j in range(i+2,n):
   if i==0 and j==n-1:continue
   aa,bb=p[i],p[(i+1)%n];cc,dd=p[j],p[(j+1)%n]
   if cross(aa,bb,cc)*cross(aa,bb,dd)<0 and cross(cc,dd,aa)*cross(cc,dd,bb)<0:errs.append(a['id'])
assert not errs,errs
src=Image.open(R/'reference/seu-jiulonghu-official-masterplan-2025.jpg').convert('RGBA');overlay=Image.new('RGBA',src.size);d=ImageDraw.Draw(overlay)
colors={'existing':(19,100,106,210),'under_construction':(202,89,25,240),'planned':(30,100,190,230)}
for a in B:
 p=[tuple(v)for v in a['footprint_px']];c=colors[a['status']];d.polygon(p,fill=(*c[:3],35));d.line(p+[p[0]],fill=c,width=1)
result=Image.alpha_composite(src,overlay).crop((112,148,933,802)).resize((2053,1635),Image.Resampling.LANCZOS).convert('RGB')
canvas=Image.new('RGB',(2160,1830),(247,247,240));canvas.paste(result,(54,135));d=ImageDraw.Draw(canvas)
f='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc';fb='/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
d.text((55,30),'轮廓叠加核对 · 2025 官方总图',font=ImageFont.truetype(fb,38),fill=(30,55,49))
d.text((55,86),'439个体量构件；兰园已建状态已更正，底图保留2025历史颜色。轮廓为近似描摹，非测绘边界。',font=ImageFont.truetype(f,24),fill=(65,80,72))
d.text((55,1782),'深青：已建轮廓  |  橙色：在建轮廓  |  蓝色：规划／未建轮廓',font=ImageFont.truetype(f,24),fill=(50,70,65))
canvas.save(R/'qa/04_轮廓叠加核对.png')
json.dump({'component_count':len(B),'unique_ids':True,'positive_heights':True,'self_intersections':0,'note':'Polygon integrity and manual image overlay check only; not survey accuracy.'},open(R/'qa/footprint_checks.json','w'),indent=2)
print('PASS',len(B),'polygons; no proper self-intersections')
