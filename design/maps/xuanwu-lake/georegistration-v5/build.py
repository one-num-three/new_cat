"""Build coordinate registration only. Does not edit/resample artwork pixels."""
from pathlib import Path
import json, math, hashlib, shutil, csv, difflib
import xml.etree.ElementTree as ET
import numpy as np
from scipy.spatial import Delaunay

HERE=Path(__file__).resolve().parent
BASE=HERE.parent
ROOT=BASE.parents[2]
R=6378137.0
def merc(p):
    return [R*math.radians(p[0]),R*math.log(math.tan(math.pi/4+math.radians(p[1])/2))]
def dump(name,data):
    (HERE/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
tree=ET.parse(BASE/'source-v1/osm-source.osm').getroot()
nodes={n.get('id'):[float(n.get('lon')),float(n.get('lat'))] for n in tree.findall('node')}
ways={w.get('id'):{'coordinates':[nodes[n.get('ref')] for n in w.findall('nd')], 'tags':{t.get('k'):t.get('v') for t in w.findall('tag')}} for w in tree.findall('way')}
anchors=[]
def add(id,group,way,geo,xy,kind='control',method='manually matched visible bridge deck / shore junction'):
    anchors.append(dict(id=id,group=group,way=str(way),wgs84=list(geo),pixel=list(xy),kind=kind,method=method,pixelUncertainty=5 if group.startswith('B') else 8))
def at(id,group,way,index,xy,**kw): add(id,group,way,ways[str(way)]['coordinates'][index],xy,**kw)
# Pixel origin is top-left of the ORIGINAL 1254x1254 runtime JPEG. No screenshot coordinates.
for name,way,pixels in [('B1',776728676,[(612,455),(553,416)]),('B2',776728674,[(884,515),(851,558)]),('B3',776728672,[(834,765),(881,795)])]:
    for i,p in enumerate(pixels): at(f'{name}-{i}',name,way,i,p)
# Every visible turn of the zigzag lotus bridge.
for i,p in enumerate([(636,808),(633,814),(620,831),(629,836),(613,859),(621,864),(602,887)]): at(f'B4-{i}','B4',1226671818,i,p)
# Corridor OSM ways are its opposing edges, NOT railway tracks or a traversable centerline.
# Corresponding edge-vertex midpoints approximate the roof-axis ground projection.
c1=ways['1050092971']['coordinates'];c2=ways['1050092972']['coordinates']
for id,way,arr,a,b,xy in [('C0',1050092971,c1,5,6,(658,479)),('C1',1050092971,c1,1,11,(687,453)),('C2',1050092971,c1,0,12,(835,559)),('C3',1050092972,c2,2,18,(830,574)),('C4',1050092972,c2,3,16,(846,588)),('C5',1050092972,c2,4,15,(840,601)),('C6',1050092972,c2,5,14,(856,613)),('C7',1050092972,c2,9,10,(816,692))]:
    add(id,'C',way,(np.array(arr[a])+arr[b])/2,xy,method=f'manual roof-axis; OSM opposing-edge midpoint indices {a},{b}; not surveyed centerline')
# Surrounding controls prevent bridges alone from determining the entire island frame.
at('H-N','H',776728681,2,(646,166))
at('H-W','H',776728680,1,(246,761))
at('H-E','H',776728669,1,(984,917))
for id,index,xy in [('H01',0,(665,179)),('H02',28,(946,470)),('H03',31,(911,542)),('H05',62,(410,687)),('H06',67,(687,925)),('H07',69,(752,952)),('H08',79,(949,842)),('H09',82,(1000,939)),('H10',89,(808,1097)),('H11',90,(761,1117)),('H12',97,(225,796)),('H13',100,(207,751))]:
    at(id,'H',776728664,index,xy,method='manual generalized coastline corner; lower confidence than bridge endpoints')
for id,index,xy in [('Y01',31,(651,405)),('Y02',8,(475,706)),('Y03',11,(742,893)),('Y04',24,(910,598)),('Y05',23,(895,663))]:
    at(id,'Y',776728670,index,xy,method='manual generalized coastline corner; lower confidence than bridge endpoints')
origin=np.mean([merc(a['wgs84']) for a in anchors],axis=0)
world=np.array([merc(a['wgs84']) for a in anchors])-origin
pixels=np.array([a['pixel'] for a in anchors],float)
tri=Delaunay(world)
def orient(p): return float(np.linalg.det(np.column_stack((p[1]-p[0],p[2]-p[0]))))
triangles=tri.simplices.tolist()
# In north-positive projected coordinates and screen y-down pixels, orientation must be opposite.
folds=[i for i,t in enumerate(triangles) if orient(world[t])*orient(pixels[t])>=0]
affine=np.linalg.lstsq(np.c_[world,np.ones(len(world))],pixels,rcond=None)[0]
res=np.linalg.norm(np.c_[world,np.ones(len(world))]@affine-pixels,axis=1)
def map_point(p,w=world,px=pixels,tr=tri):
    ix=int(tr.find_simplex(p))
    if ix<0:return None
    m=tr.transform[ix];ab=m[:2]@(p-m[2]);return np.r_[ab,1-ab.sum()]@px[tr.simplices[ix]]
holds=[]
for group in ['B1','B2','B3','B4','C']:
    keep=np.array([a['group']!=group for a in anchors]);tt=Delaunay(world[keep]);ww=world[keep];pp=pixels[keep]
    errors=[]
    for i,a in enumerate(anchors):
        if a['group']==group:
            q=map_point(world[i],ww,pp,tt)
            if q is not None: errors.append(float(np.linalg.norm(q-pixels[i])))
    holds.append(dict(group=group,checkCount=len(errors),rmsPixels=float(np.sqrt(np.mean(np.square(errors)))) if errors else None,maxPixels=max(errors) if errors else None))
image=ROOT/'assets/maps/xuanwu-lake-v4.jpg'
assert image.exists(),image
shutil.copy2(image,HERE/'artwork-original.jpg')
model=dict(schema='piecewise-affine-wgs84-art-v1',enabled=True,status='osm-image-registered-field-unverified',date='2026-10-15',image=dict(file='artwork-original.jpg',runtimePath='assets/maps/xuanwu-lake-v4.jpg',sha256=sha(image),width=1254,height=1254),source=dict(file='../source-v1/osm-source.osm',sha256=sha(BASE/'source-v1/osm-source.osm'),crs='EPSG:4326',attribution='© OpenStreetMap contributors · ODbL 1.0',url='https://www.openstreetmap.org/copyright',snapshot='2026-10-12'),projection='EPSG:3857',origin=origin.tolist(),world=world.tolist(),pixels=pixels.tolist(),triangles=triangles,anchors=anchors,fieldVerified=False,extrapolation=False,coordinateInput='WGS84 only; GCJ-02 must be independently converted before input',quality=dict(foldedTriangles=folds,affineRmsPx=float(np.sqrt(np.mean(res**2))),affineMaxPx=float(res.max()),fitResidualMeaning='interpolating control residual is NOT geographic accuracy',leaveFeatureOut=holds),affine=affine.tolist())
check_geo=[118.7881729,32.0758439]
check_pixel=[604,349]
check_prediction=map_point(np.array(merc(check_geo))-origin)
model['quality']['withheldShorelineCheck']=dict(wgs84=check_geo,manualPixel=check_pixel,predictedPixel=check_prediction.tolist(),residualPixels=float(np.linalg.norm(check_prediction-check_pixel)),note='Not used in final fit. Initial fit rejected because generalized shoreline created a folded triangle; a diagnosed holdout, not blind independent validation.')
model['quality']['uncertaintyNote']='5-8 pixel manual uncertainty is an estimate, not a measured confidence interval. Corridor centerline is derived from OSM edge midpoints; roof perspective may differ from pedestrian position.'
dump('MODIFIED_FILE.json',model)
baseline=dict(schema=model['schema'],enabled=False,status='unregistered',image=model['image'],fieldVerified=False)
dump('baseline.json',baseline)
dump('anchors.json',anchors)
with (HERE/'anchors.csv').open('w',newline='',encoding='utf-8-sig') as f:
    wr=csv.writer(f);wr.writerow(['id','group','osm_way','longitude_wgs84','latitude_wgs84','pixel_x','pixel_y','manual_uncertainty_px','method'])
    for a in anchors:wr.writerow([a['id'],a['group'],a['way'],*a['wgs84'],*a['pixel'],a['pixelUncertainty'],a['method']])
ids=['776728664','776728670','776728676','776728674','776728672','1226671818','1050092971','1050092972','776728669','776728680','776728681']
features=[dict(type='Feature',id='way/'+id,properties={**ways[id]['tags'],'osm_id':id,'source_url':'https://www.openstreetmap.org/way/'+id},geometry=dict(type='LineString',coordinates=ways[id]['coordinates'])) for id in ids]
dump('reference.geojson',dict(type='FeatureCollection',features=features))
# Fit metrics are entirely image/OSM comparisons; no GPS samples are synthesized.
dump('quality.json',model['quality'])
(HERE/'DIFF_FILE.diff').write_text(''.join(difflib.unified_diff((HERE/'baseline.json').read_text(encoding='utf-8').splitlines(True),(HERE/'MODIFIED_FILE.json').read_text(encoding='utf-8').splitlines(True),fromfile='baseline.json',tofile='MODIFIED_FILE.json')),encoding='utf-8')
(HERE/'bundle.js').write_text('''// Read the authoritative model at startup, so rollback also disables the preview mapping.
const requested=new URLSearchParams(location.search).get('config')||'MODIFIED_FILE.json';
const config=['MODIFIED_FILE.json','baseline.json','rollback-test.json'].includes(requested)?requested:'MODIFIED_FILE.json';
Promise.all([fetch(config).then(r=>r.json()),fetch('reference.geojson').then(r=>r.json())]).then(([m,r])=>{
 window.REGISTRATION=m;window.REFERENCE=r;
 if(!m.enabled){const image=new Image();image.onload=()=>{document.getElementById('art').getContext('2d').drawImage(image,0,0);document.getElementById('info').textContent='UNREGISTERED / enabled=false / mapping=null / image=unchanged';document.getElementById('export').disabled=true;window.READY=true;};image.src=m.image.file;return;}
 const s=document.createElement('script');s.src='viewer.js';document.body.appendChild(s);
}).catch(e=>{document.getElementById('info').textContent='请用 node serve.cjs 启动本地预览服务。 '+e.message;});
''',encoding='utf-8')
print(json.dumps(dict(anchors=len(anchors),triangles=len(triangles),folds=folds,affineRmsPx=model['quality']['affineRmsPx'],holdouts=holds),ensure_ascii=False))
assert not folds, f'Folded triangles: {folds}; inspect correspondence before delivery'

