from pathlib import Path
import json,math,xml.etree.ElementTree as E
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon
P=Path(__file__).resolve().parent
for key in ['sipailou','jiulonghu']:
 if not (P/(key+'.osm')).exists():continue
 r=E.parse(P/(key+'.osm')).getroot();ns={n.get('id'):[float(n.get('lon')),float(n.get('lat'))] for n in r.findall('node')}
 ws={w.get('id'):w for w in r.findall('way')};features=[];boundary=[]
 for rel in r.findall('relation'):
  t={x.get('k'):x.get('v') for x in rel.findall('tag')}
  if t.get('amenity')=='university' and ('四牌楼' if key=='sipailou' else '九龙湖') in t.get('name',''):
   for x in rel.findall('member'):
    if x.get('type')=='way' and x.get('ref') in ws:
     boundary.extend([ns[n.get('ref')] for n in ws[x.get('ref')].findall('nd') if n.get('ref') in ns])
 if not boundary:
  for w in ws.values():
   t={x.get('k'):x.get('v') for x in w.findall('tag')}
   if t.get('amenity')=='university' and '东南' in t.get('name',''):boundary.extend([ns[n.get('ref')] for n in w.findall('nd') if n.get('ref') in ns])
 if not boundary:raise Exception('Campus boundary missing '+key)
 xmin=min(x[0] for x in boundary)-.0005;xmax=max(x[0] for x in boundary)+.0005;ymin=min(x[1] for x in boundary)-.0005;ymax=max(x[1] for x in boundary)+.0005
 def project(p):return [6378137*math.radians(p[0]),6378137*math.log(math.tan(math.pi/4+math.radians(p[1])/2))]
 lo=project([xmin,ymin]);hi=project([xmax,ymax]);size=2000;span=max(hi[0]-lo[0],hi[1]-lo[1]);cx=(hi[0]+lo[0])/2;cy=(hi[1]+lo[1])/2
 def pix(p):
  x,y=project(p);return [(x-cx)/span*size+size/2,(cy-y)/span*size+size/2]
 fig,ax=plt.subplots(figsize=(10,10),dpi=200);fig.subplots_adjust(0,0,1,1);ax.set(xlim=(0,size),ylim=(size,0));ax.set_facecolor('#dce6ce');ax.set_axis_off();anchors=[]
 for w in ws.values():
  t={x.get('k'):x.get('v') for x in w.findall('tag')};co=[ns[n.get('ref')] for n in w.findall('nd') if n.get('ref') in ns]
  if len(co)<2 or not any(xmin<=x<=xmax and ymin<=y<=ymax for x,y in co):continue
  if not any(k in t for k in ['building','highway','natural','water','landuse','leisure','amenity','barrier']):continue
  xy=[pix(p) for p in co];closed=co[0]==co[-1]
  color=None
  if t.get('natural')=='water' or 'water' in t:color='#98cbd9'
  elif 'building' in t:color='#cbb29a'
  elif t.get('leisure') in ['pitch','track','sports_centre']:color='#9abe94'
  elif t.get('landuse') in ['grass','forest'] or t.get('natural')=='wood':color='#bfd2a7'
  if closed and color:ax.add_patch(Polygon(xy,facecolor=color,edgecolor='#9ba28c',linewidth=.35))
  if 'highway' in t:ax.plot(*zip(*xy),color='#fff9e8',linewidth=2 if t['highway'] in ['footway','path','steps'] else 4,zorder=4)
  if 'barrier' in t:ax.plot(*zip(*xy),color='#8e9b80',linewidth=.5)
  features.append(dict(type='Feature',id='way/'+w.get('id'),properties=t,geometry=dict(type='Polygon' if closed else 'LineString',coordinates=[co] if closed else co)))
  if 'building' in t and t.get('name'):
   center=[sum(x[k] for x in co[:-1])/len(co[:-1]) for k in [0,1]] if closed else co[0]
   anchors.append(dict(id='way/'+w.get('id'),name=t['name'],wgs84=center,guidePixel=pix(center),method='OSM named building vertex-mean; candidate only'))
 fig.savefig(P/(key+'-geometry.png'),dpi=200);plt.close(fig)
 (P/(key+'-reference.geojson')).write_text(json.dumps(dict(type='FeatureCollection',features=features),ensure_ascii=False),encoding='utf8')
 (P/(key+'-guide.json')).write_text(json.dumps(dict(size=[size,size],projection='EPSG:3857',center=[cx,cy],span=span,bbox=[xmin,ymin,xmax,ymax],anchors=anchors),ensure_ascii=False,indent=2),encoding='utf8')
 print(key,len(features),len(anchors),[xmin,ymin,xmax,ymax])
