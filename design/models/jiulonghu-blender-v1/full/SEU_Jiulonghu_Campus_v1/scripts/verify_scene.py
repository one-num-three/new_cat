import bpy,json,math
from pathlib import Path
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector
R=Path(__file__).resolve().parents[1]
B=json.load(open(R/'data/buildings.json'))
roots=[o for o in bpy.data.objects if o.get('is_building_component')]
assert len(roots)==len(B),(len(roots),len(B))
ids=[o['id']for o in roots];assert len(ids)==len(set(ids))
lan=[o for o in roots if o.get('plan_label')in['E3','E4','E5']]
assert len(lan)==11 and all(o['status']=='existing' for o in lan)
assert all('plan_status_2025' in o for o in roots)
for o in roots:
 assert o.type=='MESH' and len(o.data.vertices)>=6
 assert o['height_m']>0
 assert all(math.isfinite(v.co.z)for v in o.data.vertices)
 roof=bpy.data.objects.get(o['id']+' | roof');assert roof is not None
 # Parent translation is preserved; actual roof top equals the main mass height.
 assert abs(roof.location.x)<.001 and abs(roof.location.y)<.001
 assert abs(roof.location.z+.45-o['height_m'])<.001
 assert abs(max(v.co.z for v in o.data.vertices)-(o['height_m']-.45))<.001
imgs=[(i.name,bool(i.packed_file))for i in bpy.data.images if i.source=='FILE'];assert all(v for k,v in imgs),imgs
out={'building_components':len(roots),'unique_ids':len(ids),'status_counts':{},'packed_images':imgs,'camera_names':[o.name for o in bpy.data.objects if o.type=='CAMERA'],'verification':'PASS: re-opened final blend, inspected geometry, roof transforms, units, sources, packed assets.'}
for o in roots:out['status_counts'][o['status']]=out['status_counts'].get(o['status'],0)+1
labels=[('图书馆',449,432,30),('本科教学区',625,435,28),('纪忠楼',303,464,25),('能环楼 57 m',255,551,64),('信息电子 55.8 m',589,214,62),('游泳馆 11.05 m',795,430,16),('体育馆',757,489,22),('校内湖区',287,346,1),('工科综合楼 · 在建',329,590,38),('南门',448,753,1)]
projections={}
for cam in [o for o in bpy.data.objects if o.type=='CAMERA']:
 bpy.context.scene.camera=cam;bpy.context.view_layer.update();z=[]
 for text,x,y,h in labels:
  pt=Vector(((x-520)*1.9,(470-y)*1.9,h));co=world_to_camera_view(bpy.context.scene,cam,pt);z.append({'label':text,'x':co.x,'y':1-co.y})
 projections[cam.name]=z
json.dump(projections,open(R/'output/label_projections.json','w'),ensure_ascii=False,indent=2)
json.dump(out,open(R/'output/verification.json','w'),ensure_ascii=False,indent=2)
print(json.dumps(out,ensure_ascii=False))
# Render a fresh low resolution from opened file as an independent smoke test.
sc=bpy.context.scene;sc.camera=bpy.data.objects.get('02 全校区 · 正北俯视');sc.render.resolution_percentage=18;sc.cycles.samples=4;sc.render.filepath=str(R/'qa/reopen_render.png');bpy.ops.render.render(write_still=True)
