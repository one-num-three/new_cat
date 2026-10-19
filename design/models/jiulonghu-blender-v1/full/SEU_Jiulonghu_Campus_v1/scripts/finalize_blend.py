# Refresh human-facing metadata and the initial viewport without changing geometry.
import bpy,json
from pathlib import Path
R=Path(__file__).resolve().parents[1]
B=json.load(open(R/'data/buildings.json'))
for b in B:
 ob=next(o for o in bpy.data.objects if o.get('is_building_component')and o.get('id')==b['id'])
 for k,v in b.items():
  if k=='footprint_px':ob['footprint_px_json']=json.dumps(v)
  elif isinstance(v,(dict,list)):ob[k]=json.dumps(v,ensure_ascii=False)
  else:ob[k]=v
for nm,p in [('BUILDINGS_EDITABLE.json',R/'data/buildings.json'),('GENERATOR.py',R/'scripts/build_campus.py'),('README_先读说明',R/'README_中文.md'),('SOURCES_来源与证据',R/'SOURCES_研究与证据.md')]:
 tx=bpy.data.texts.get(nm)or bpy.data.texts.new(nm);tx.clear();tx.write(p.read_text())
bpy.context.scene.camera=bpy.data.objects.get('01 全校区 · 东南鸟瞰')
bpy.context.scene.render.resolution_percentage=100
bpy.context.scene.cycles.samples=64
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.color_type='MATERIAL';area.spaces.active.clip_end=10000
bpy.ops.wm.save_as_mainfile(filepath=str(R/'output/SEU_Jiulonghu_Campus_v1.blend'))
print('FINALIZED')
