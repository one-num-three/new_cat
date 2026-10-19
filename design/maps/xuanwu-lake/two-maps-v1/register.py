"""Read-only screenshot analysis; output georeferencing, never resample/edit screenshots."""
from pathlib import Path
import json, math, hashlib, xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
from matplotlib.path import Path as Polygon
from scipy.optimize import minimize

D=Path(__file__).parent
R=6378137.0
def project(p):
    return np.array([R*math.radians(p[0]), R*math.log(math.tan(math.pi/4+math.radians(p[1])/2))])
def inverse(p):
    return [math.degrees(p[0]/R),math.degrees(2*math.atan(math.exp(p[1]/R))-math.pi/2)]
fc=json.loads((D.parent/'source-v1/region.wgs84.geojson').read_text(encoding='utf-8'))
lake=next(f for f in fc['features'] if f['id']=='relation/2138994')
ref=project([118.788,32.073])
rings=[Polygon(np.array([project(p)-ref for p in r])) for r in lake['geometry']['coordinates']]
img=np.array(Image.open(D/'reference-large.png').convert('RGB'))
water=np.all(img==[154,204,223],axis=2)
land=np.all(img==[205,220,183],axis=2)
valid=water|land
yy,xx=np.mgrid[:img.shape[0],:img.shape[1]]
sampling=valid & (xx%2==0) & (yy%2==0)
pixels=np.column_stack([xx[sampling],yy[sampling]])+.5
truth=water[sampling]
def water_at(params, pixels):
    s,tx,ty=params
    ps=(pixels-np.array([tx,ty]))/np.array([s,-s])
    inside=rings[0].contains_points(ps)
    for ring in rings[1:]:inside &= ~ring.contains_points(ps)
    return inside
def loss(params):return np.mean(water_at(params,pixels)!=truth)
fit=minimize(loss,[.45,178.5,207.6],method='Nelder-Mead',options={'maxiter':180,'xatol':.002,'fatol':1e-6})
large_params=fit.x
allpixels=np.column_stack([xx[valid],yy[valid]])+.5
pred=water_at(large_params,allpixels);observed=water[valid]
iou=float(np.sum(pred&observed)/np.sum(pred|observed))

# The small screenshot explicitly identifies source anchors A2, A5, A6.
ad=json.loads((D.parent/'source-v1/anchors-candidates.json').read_text(encoding='utf-8'))
byid={a['id']:a for a in ad['anchors']}
controls=[('A2',[54.5,121.5]),('A5',[104.5,97.5]),('A6',[118.0,21.0])]
A=[];b=[]
for key,(x,y) in controls:
    mx,my=project(byid[key]['wgs84'])-ref
    A.extend([[mx,1,0],[-my,0,1]]);b.extend([x,y])
small_params=np.linalg.lstsq(np.array(A),np.array(b),rcond=None)[0]
residuals=(np.array(A)@small_params-np.array(b)).reshape(-1,2)
rmse=float(np.sqrt(np.mean(np.sum(residuals**2,axis=1))))

def scene(key,title,params,width,height,top):
    s,tx,ty=map(float,params)
    northwest=ref+np.array([-tx/s,(ty-top)/s])
    southeast=ref+np.array([(width-tx)/s,(ty-height)/s])
    return {'id':key,'title':title,'source_image':'reference-'+key+'.png','source_size':[width,height],
      'content_crop':[0,top,width,height-top], 'reference_xy':ref.tolist(),
      'registration_px_per_mercator_m':s,'registration_translation':[tx,ty],
      'world_bounds':[northwest[0],southeast[1],southeast[0],northwest[1]],
      'bounds_wgs84':[inverse([northwest[0],southeast[1]])[0],inverse([northwest[0],southeast[1]])[1],inverse([southeast[0],northwest[1]])[0],inverse([southeast[0],northwest[1]])[1]],
      'output_size':[2400,round(2400*(height-top)/width)],'coordinate_system':'WGS84','source':'OSM','survey_accuracy_m':None}
scenes=[scene('small','解放门 · 七星旱桥',small_params,199,138,0),scene('large','环洲 · 樱洲',large_params,346,350,25)]
meta={'task_date':'2026-10-12','method':'Small: 3 labeled source controls, similarity transform. Large: lake/island silhouette registration, north-up isotropic Mercator scale.','small_control_rmse_source_px':rmse,'large_water_mask_iou':iou,'independent_survey_validation':False,'notes':['Large source has 25px non-map top margin, omitted in map output.','Silhouette IoU excludes roads/buildings/labels and is NOT GPS accuracy.','Small controls are from same OSM dataset and are NOT independent field checks.','Do not interpret generated material patterns as surveyed individual trees.'],'scenes':scenes}
(D/'registration.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
baseline={'version':'source-flat','art_mode':'flat','pixel_grid':False,'coordinate_system':'WGS84','scenes':scenes}
(D/'baseline-config.json').write_text(json.dumps(baseline,ensure_ascii=False,indent=2),encoding='utf-8')
(D/'maps-config.json').write_text(json.dumps(baseline,ensure_ascii=False,indent=2),encoding='utf-8')
(D/'source-data.js').write_text('window.MAP_DATA='+json.dumps(fc,ensure_ascii=False,separators=(',',':'))+';\nwindow.MAP_ANCHORS='+json.dumps(ad,ensure_ascii=False)+';\n',encoding='utf-8')
print(json.dumps({'small_registration_rmse_px':rmse,'large_water_mask_iou':iou,'scenes':[{'id':s['id'],'bounds':s['bounds_wgs84'],'output':s['output_size']} for s in scenes]},ensure_ascii=False,indent=2))
