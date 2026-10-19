from pathlib import Path
import json,math,hashlib,csv,shutil
import numpy as np
from scipy.spatial import Delaunay
P=Path(__file__).resolve().parent
def dump(n,x):(P/n).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def merc(ll):return [6378137*math.radians(ll[0]),6378137*math.log(math.tan(math.pi/4+math.radians(ll[1])/2))]
# Manually identified roof/footprint centers in each 1254x1254 generated image.
# Ground footprint reference is approximate; perspective roof centers are not surveyed pedestrian points.
controls={
'jiulonghu':{
'300030310':(535,576),'300030325':(304,635),'630686644':(995,636),
'300020042':(479,1004),'1056927514':(730,375),'1056927536':(736,264),
'299961586':(832,511),'299961605':(755,605),'300030315':(598,195),
'300030323':(747,199),'300030330':(78,248),'300165432':(792,162),
'300162243':(1198,609),'299961611':(177,917),'299961596':(191,1089),
'630136460':(1070,268),'630141882':(1077,905),'1301015351':(576,1178),
'1488713409':(161,403),'1056927534':(253,802)},
'sipailou':{
'236944775':(641,498),'236945039':(758,610),'236945093':(576,611),
'236945198':(739,547),'236945199':(563,546),'237316228':(419,405),
'237488978':(392,540),'237316231':(191,558),'237316232':(191,586),
'1056580749':(121,441),'1056580750':(192,448),'189318592':(255,578),
'1056854753':(1130,485),'1056854748':(1078,639),'1056854738':(1143,879),
'1056854730':(1017,1009),'1056854755':(1016,564),'404071182':(792,1018),
'237174909':(1067,685),'1056580741':(496,660)}
}
allmodels={}
for key,points in controls.items():
 guide=json.loads((P/(key+'-guide.json')).read_text(encoding='utf8'))
 known={a['id'].split('/')[1]:a for a in guide['anchors']}
 anchors=[]
 for wid,pixel in points.items():
  a=known[wid];anchors.append(dict(id='A'+str(len(anchors)+1).zfill(2),osmId=a['id'],name=a['name'],wgs84=a['wgs84'],pixel=list(pixel),guidePixel=a['guidePixel'],method='manual visible roof/footprint center matched to OSM vertex-mean; approximate ground projection',estimatedManualUncertaintyPx=10))
 world=np.array([merc(a['wgs84']) for a in anchors]);origin=world.mean(axis=0);world-=origin
 pixels=np.array([a['pixel'] for a in anchors],float);tri=Delaunay(world);ts=tri.simplices.tolist()
 def det(p):return float(np.linalg.det(np.column_stack([p[1]-p[0],p[2]-p[0]])))
 folds=[i for i,t in enumerate(ts) if det(world[t])*det(pixels[t])>=0]
 assert not folds,(key,folds)
 affine=np.linalg.lstsq(np.c_[world,np.ones(len(world))],pixels,rcond=None)[0]
 residual=np.linalg.norm(np.c_[world,np.ones(len(world))]@affine-pixels,axis=1)
 loo=[]
 for i in range(len(world)):
  keep=np.arange(len(world))!=i;t=Delaunay(world[keep]);j=t.find_simplex(world[i])
  if j<0:continue
  z=t.transform[j];b=z[:2]@(world[i]-z[2]);q=np.r_[b,1-b.sum()]@pixels[keep][t.simplices[j]]
  loo.append(dict(id=anchors[i]['id'],errorPx=float(np.linalg.norm(q-pixels[i]))))
 name=key+'-art.png';sha=hashlib.sha256((P/name).read_bytes()).hexdigest()
 m=dict(schema='piecewise-affine-wgs84-art-v1',enabled=True,status='osm-image-registered-field-unverified',image=dict(file=name,width=1254,height=1254,sha256=sha),projection='EPSG:3857',origin=origin.tolist(),world=world.tolist(),pixels=pixels.tolist(),triangles=ts,anchors=anchors,fieldVerified=False,extrapolation=False,guide=guide,quality=dict(folds=folds,affineRmsPx=float(np.sqrt(np.mean(residual**2))),leaveOneOut=loo,leaveOneOutRmsPx=float(np.sqrt(np.mean([x['errorPx']**2 for x in loo]))),note='Same-source image checks; not field accuracy. Manual roof center may differ from ground. Outside control hull returns null.'))
 dump(key+'-registration.json',m);dump(key+'-baseline.json',dict(enabled=False,status='unregistered',image=m['image'],fieldVerified=False))
 with (P/(key+'-anchors.csv')).open('w',newline='',encoding='utf-8-sig') as f:
  w=csv.writer(f);w.writerow(['id','name','osm_id','longitude_wgs84','latitude_wgs84','image_x','image_y','method'])
  for a in anchors:w.writerow([a['id'],a['name'],a['osmId'],*a['wgs84'],*a['pixel'],a['method']])
 # World file applies ONLY to deterministic geometry guide, not generated art.
 span=guide['span'];cx,cy=guide['center'];s=span/2000
 (P/(key+'-geometry.pgw')).write_text('\n'.join(map(str,[s,0,0,-s,cx-span/2+s/2,cy+span/2-s/2]))+'\n',encoding='ascii')
 shutil.copy2(P.parent/'xuanwu-lake/georegistration-v5/registered-north-up.prj',P/(key+'-geometry.prj'))
 allmodels[key]=m
 print(key,'anchors',len(anchors),'triangles',len(ts),'folds',len(folds),'looRmsPx',m['quality']['leaveOneOutRmsPx'])
(P/'data.js').write_text('window.CAMPUSES='+json.dumps(allmodels,ensure_ascii=False)+';\n',encoding='utf8')
shutil.copy2(P.parent/'xuanwu-lake/georegistration-v5/mapping.js',P/'mapping.js')
