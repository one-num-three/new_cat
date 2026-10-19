from pathlib import Path
import json,hashlib,zipfile
from PIL import Image
R=Path(__file__).resolve().parents[1]
files=[R/'README_中文.md',R/'SOURCES_研究与证据.md']
files+=sorted((R/'data').glob('*.json'))+sorted((R/'data').glob('*.py'))+sorted((R/'data').glob('*notes.md'))
files+=sorted((R/'scripts').glob('*.py'))
files+=[R/'reference/seu-jiulonghu-official-masterplan-2025.jpg',R/'reference/landcover_schematic.png']
files+=[R/'output/SEU_Jiulonghu_Campus_v1.blend']+[R/'output'/f for f in ['01_全校区鸟瞰.png','02_全校区俯视.png','03_中心教学区.png']]
files+=[R/'qa/04_轮廓叠加核对.png',R/'qa/footprint_checks.json',R/'output/verification.json']
assert all(p.exists()for p in files)
assert (R/'output/SEU_Jiulonghu_Campus_v1.blend').read_bytes()[:7]==b'BLENDER'
render_checks={}
for p in files:
 if p.suffix=='.png' and p.parent.name=='output':
  im=Image.open(p);im.verify();im=Image.open(p);render_checks[p.name]={'pixels':list(im.size),'file_bytes':p.stat().st_size}
manifest={'title':'SEU Jiulonghu campus schematic editable massing v1','date':'2026-10-16','blender_version':'4.3.2','building_components':439,'not_a_building_count':True,'historical_plan_status_counts':{'existing':291,'under_construction':32,'planned':116},'current_model_status_counts':{'existing':302,'under_construction':29,'planned':108},'status_update':'Lan yuan E3/E4/E5 existing per user confirmation2026-10-16; other baseline classifications from2025plan','coordinate_scale_m_per_pixel':1.9,'coordinate_precision':'approximate, not georeferenced','render_checks':render_checks,'verification':json.load(open(R/'output/verification.json')),'files':[]}
for p in files:manifest['files'].append({'path':str(p.relative_to(R)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
mp=R/'MANIFEST.json';mp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
zp=R/'output/SEU_Jiulonghu_Campus_v1_complete.zip'
with zipfile.ZipFile(zp,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for p in files+[mp]:z.write(p,arcname='SEU_Jiulonghu_Campus_v1/'+str(p.relative_to(R)))
with zipfile.ZipFile(zp)as z:assert z.testzip()is None
print('ZIP',zp,zp.stat().st_size,'bytes;',len(files)+1,'files')
