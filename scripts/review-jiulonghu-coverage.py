"""Diagnostic overlay only; never edits the map artwork shipped to the app."""
from pathlib import Path
import json,math
import numpy as np
from scipy.spatial import Delaunay,ConvexHull
from PIL import Image,ImageDraw,ImageFont

root=Path(__file__).resolve().parents[1]
source=root/'design/maps/seu-campuses-v1'
m=json.loads((root/'design/maps/seu-jiulonghu-registration-v3/jiulonghu-registration.json').read_text(encoding='utf8'))
old=json.loads((root/'design/maps/seu-jiulonghu-registration-v2/jiulonghu-registration.json').read_text(encoding='utf8'))
geo=json.loads((source/'jiulonghu-reference.geojson').read_text(encoding='utf8'))
ring=next(f for f in geo['features'] if f['id']=='way/171389014')['geometry']['coordinates'][0]
world=np.array(m['world']);pixels=np.array(m['pixels']);tri=Delaunay(world)
def merc(ll):
    return np.array([6378137*math.radians(ll[0]),6378137*math.log(math.tan(math.pi/4+math.radians(ll[1])/2))])
def art(ll):
    q=merc(ll)-m['origin'];i=int(tri.find_simplex(q));z=tri.transform[i];b=z[:2]@(q-z[2]);return tuple(np.r_[b,1-b.sum()]@pixels[tri.simplices[i]])
g=m['guide']
def guide(ll):
    x,y=merc(ll);return ((x-g['center'][0]+g['span']/2)/g['span']*1254,(g['center'][1]+g['span']/2-y)/g['span']*1254)
font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',18)
panels=[]
for title,file,project in [('SAVED OSM GEOMETRY','jiulonghu-geometry.png',guide),('RUNTIME ART REFERENCE (NOT SURVEYED GPS)','jiulonghu-art.png',art)]:
    im=Image.open(source/file).convert('RGB').resize((1254,1254));overlay=Image.new('RGBA',im.size);d=ImageDraw.Draw(overlay)
    def coords(ids):return [project(m['anchors'][i]['wgs84']) for i in ids]
    for t in m['triangles']:d.line(coords([*t,t[0]]),fill=(20,20,20,90),width=1)
    ids=ConvexHull(world).vertices.tolist();d.line(coords([*ids,ids[0]]),fill=(0,155,255,255),width=5)
    oldids=ConvexHull(np.array(old['world'])).vertices.tolist();d.line(coords([*oldids,oldids[0]]),fill=(215,25,45,255),width=4)
    dense=[]
    for a,b in zip(ring[:-1],ring[1:]):
        for i in range(8):dense.append(project([a[k]+(b[k]-a[k])*i/8 for k in (0,1)]))
    d.line(dense+[dense[0]],fill=(0,235,75,255),width=4)
    for i,a in enumerate(m['anchors']):
        x,y=project(a['wgs84']);d.ellipse((x-5,y-5,x+5,y+5),fill='white',outline='black',width=2)
        if i>=23:d.text((max(3,min(1190,x+8)),max(3,y-20)),a['id'],font=font,fill='white',stroke_fill='black',stroke_width=2)
    im=Image.alpha_composite(im.convert('RGBA'),overlay).convert('RGB')
    panel=Image.new('RGB',(1254,1350),'white');panel.paste(im,(0,40));d=ImageDraw.Draw(panel);d.text((15,10),title,font=font,fill='black')
    d.text((15,1306),'GREEN: saved campus boundary | RED: old hull | BLUE: new finite hull',font=font,fill='black')
    d.text((15,1330),'31 controls / 53 triangles. Artwork unchanged. Reference coverage is not field accuracy.',font=font,fill='black')
    panels.append(panel)
out=Image.new('RGB',(2508,1350),'white');out.paste(panels[0],(0,0));out.paste(panels[1],(1254,0))
target=root/'reports/2026-10-18/jiulonghu-campus-coverage-v3/coverage-review.png';out.save(target);print(target)

# A clean boundary-only view for the user, without triangulation or old-model clutter.
im=Image.open(source/'jiulonghu-art.png').convert('RGBA')
d=ImageDraw.Draw(im);ids=ConvexHull(world).vertices.tolist()
outer=[art(m['anchors'][i]['wgs84']) for i in [*ids,ids[0]]]
campus=[]
for a,b in zip(ring[:-1],ring[1:]):
    for i in range(8):campus.append(art([a[k]+(b[k]-a[k])*i/8 for k in (0,1)]))
campus.append(campus[0])
d.line(outer,fill='white',width=12);d.line(outer,fill='#087ddd',width=6)
d.line(campus,fill='white',width=11);d.line(campus,fill='#00843b',width=5)
canvas=Image.new('RGB',(1314,1494),'#faf8ef');canvas.paste(im.convert('RGB'),(30,132))
d=ImageDraw.Draw(canvas);ch=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',27);heading=ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc',38)
d.text((30,24),'九龙湖校区 · 区域边界图',font=heading,fill='#20372b')
d.line([(32,102),(82,102)],fill='#00843b',width=7);d.text((96,82),'校园参考校界',font=ch,fill='#20372b')
d.line([(530,102),(580,102)],fill='#087ddd',width=7);d.text((594,82),'当前定位参考覆盖边界',font=ch,fill='#20372b')
d.text((30,1400),'31 个控制点 · 53 个三角分区 · 已覆盖保存校界的全部区域',font=ch,fill='#20372b')
d.text((30,1446),'来源：保存的 OSM 校界与原画配准；不是实测边界或游戏可通行区。',font=ch,fill='#526255')
target=target.with_name('campus-boundary.png');canvas.save(target);print(target)
