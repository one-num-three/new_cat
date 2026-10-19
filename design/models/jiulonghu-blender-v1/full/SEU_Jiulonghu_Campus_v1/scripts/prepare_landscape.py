from PIL import Image,ImageDraw,ImageFilter
from pathlib import Path
import numpy as np,json,os
os.environ['MPLCONFIGDIR']='/tmp/seu-mpl'
import matplotlib;matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy import ndimage
R=Path(__file__).resolve().parents[1]
im=Image.open(R/'reference/seu-jiulonghu-official-masterplan-2025.jpg').convert('RGB')
a=np.array(im).astype(float);r,g,b=a.transpose(2,0,1)
campus=np.zeros(r.shape,bool);campus[164:777,128:918]=1
water=(b-r>60)&(b-g>32)&(b>135)&campus
water=ndimage.binary_closing(water,iterations=2)
water=ndimage.binary_opening(water,iterations=1)
lab,n=ndimage.label(water);areas=np.bincount(lab.ravel());water=areas[lab]>30;water&=lab>0
cs=plt.contour(water.astype(float),levels=[.5]);polys=[]
for seg in cs.allsegs[0]:
 if len(seg)<8:continue
 # retain simple contours, path interpolation compression
 simp=matplotlib.path.Path(seg).cleaned(simplify=True,curves=False).vertices.tolist()
 if simp[-1]==[0,0]:simp=simp[:-1]
 area=sum(simp[i][0]*simp[(i+1)%len(simp)][1]-simp[(i+1)%len(simp)][0]*simp[i][1] for i in range(len(simp)))/2
 if abs(area)>15:polys.append(dict(points=simp,area=area))
plt.close()
# Clean, label-free diagram texture based on water/vegetation/road hues, not aerial photography.
roads=(g>152)&(b>160)&(b-r>3)&(np.maximum.reduce([r,g,b])-np.minimum.reduce([r,g,b])<65)&campus
roads=ndimage.binary_closing(roads,iterations=2)
green=(g>r*1.12)&(g>b*1.14)&(g<151)&(r<110)&(b<110)&campus
tex=np.zeros((*r.shape,3),dtype=np.uint8);tex[:]=(161,177,137)
tex[green]=(129,154,115);tex[roads]=(218,217,200);tex[water]=(67,139,153)
im2=Image.fromarray(tex);d=ImageDraw.Draw(im2)
# source based roads intentionally supplemented with a few clear axis roads
for pts,w in [([(128,180),(128,439),(144,532),(155,673),(169,767),(387,767),(429,754),(888,752),(901,739),(910,175)],8), ([(143,167),(903,167)],8), ([(217,492),(823,492)],8), ([(226,275),(643,275)],8), ([(224,493),(215,674),(232,685),(651,685),(686,675),(823,675)],8), ([(824,236),(827,677)],7)]:d.line(pts,fill=(215,216,199),width=w,joint='curve')
# Building pads erase roof/label artifacts, footprint is editable in Blender above.
for fn in ['north_buildings.json','southwest_buildings.json','east_buildings.json']:
 p=R/'data'/fn
 if p.exists():
  for o in json.load(open(p)):
   pts=[tuple(v) for v in o['footprint_px']]
   d.polygon(pts,fill=(214,215,195));d.line(pts+[pts[0]],fill=(214,215,195),width=3)
# source placement of three running tracks; simple facilities, no claims to measured field dimensions
fields=[(252,703,286,772),(850,299,891,370),(845,585,887,662)]
for x1,y1,x2,y2 in fields:
 d.rounded_rectangle((x1,y1,x2,y2),radius=(x2-x1)//2,fill=(181,128,106))
 d.rounded_rectangle((x1+5,y1+5,x2-5,y2-5),radius=(x2-x1)//2-5,fill=(105,145,104))
 for n in range(1,4):d.rounded_rectangle((x1+n,y1+n,x2-n,y2-n),radius=(x2-x1)//2-n,outline=(209,171,145),width=1)
# courts
for x1,y1,nx,ny,dx,dy in [(294,735,3,2,8,16),(840,382,6,3,8,13),(839,540,5,3,9,13),(576,704,4,3,14,16),(623,701,4,3,10,16)]:
 for ix in range(nx):
  for iy in range(ny):
   x=x1+ix*dx;y=y1+iy*dy;d.rectangle((x,y,x+dx-1,y+dy-1),fill=(130,155,109),outline=(211,218,188),width=1)
im2=im2.resize((2750,1734),Image.Resampling.LANCZOS)
im2.save(R/'reference/landcover_schematic.png')
# Points sampled on plan's dark-green symbols; indicative planting, not an inventory.
rng=np.random.default_rng(63);trees=[]
for y in range(168,775,6):
 for x in range(130,917,6):
  xj=x+int(rng.integers(-2,3));yj=y+int(rng.integers(-2,3))
  if green[yj,xj] and not water[yj,xj]:trees.append([xj,yj,float(rng.uniform(2.7,4.1)),float(rng.uniform(5.0,8.0))])
json.dump(dict(water_contours=polys,tree_points=trees,tree_note='Source-symbol sampling for landscape suggestion; not actual tree inventory.',scale_m_per_px=1.9,scale_note='Approximate graphic-scale reading: 100m ≈52px; rounded to1.9m/px. No survey/georeferencing.'),open(R/'data/landscape.json','w'),ensure_ascii=False,indent=2)
print(len(polys),'water contours,',len(trees),'schematic trees')
