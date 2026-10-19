"""Run with Blender 4.3+: blender -b --python scripts/build_campus.py
Actual editable massing model; no external add-ons or network used.
Modify data/buildings.json height_m / footprint_px and rerun.
"""
import bpy, math, json, random, os
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output';OUT.mkdir(exist_ok=True)
S=1.9;CX,CY=520,470
B=json.load(open(ROOT/'data/buildings.json'))
L=json.load(open(ROOT/'data/landscape.json'))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for d in list(bpy.data.collections):
 if d.name!='Collection':bpy.data.collections.remove(d)
base=bpy.data.collections.get('Collection');base.name='00_SITE | 场地与地景'
def col(name):
 c=bpy.data.collections.new(name);bpy.context.scene.collection.children.link(c);return c
cols={'existing':col('01_EXISTING | 已建与最新确认'), 'under_construction':col('02_CONSTRUCTION | 在建'), 'planned':col('03_PLANNED | 规划待核')}
treecol=col('04_LANDSCAPE | 示意植栽');refcol=col('90_REFERENCE | 官方总图 对照用');camcol=col('99_CAMERAS_LIGHTS | 视角与灯光')
# Store the plan classification; later status research is metadata, not falsely current mapping.
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
scene['project']='东南大学九龙湖校区 · 全校区三维体量示意 v1'
scene['coordinate_system']='Local image coordinates; north is +Y; no geographic reference.'
scene['scale_note']='Approximate graphic scale1.9m/px, from100m≈52px; not a survey.'
scene['status_note']='2025masterplan baseline; Lan yuan dormitory E3/E4/E5 changed to existing per user confirmation2026-10-16. Historical plan_status_2025 retained. Other current statuses not exhaustively verified.'
scene['accuracy_note']='Whole-campus schematic. Footprints manually traced from1375×867 plan; most heights estimated. Not an indoor route or construction model.'
scene['building_component_count']=len(B)
def mat(name,color,rough=.7,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
M={
 'existing':mat('01 既有建筑 · 暖白体块',(0.78,.78,.68)),
 'under_construction':mat('02 在建 · 陶土橙',(.67,.32,.16)),
 'planned':mat('03 规划待核 · 蓝灰',(.49,.63,.68)),
 'roof_estimated':mat('高度估算 · 米白屋面',(.91,.89,.77)),
 'roof_floor':mat('层数有据高度换算 · 浅鼠尾草',(.63,.72,.61)),
 'roof_known':mat('米数来源已核 · 深青屋面',(.065,.29,.31)),
 'plinth':mat('展示底座 · 石墨绿',(.14,.22,.20)),
 'water':mat('水系 · 蓝绿',(.045,.30,.37),.22,.12),
 'island':mat('岛屿地面',(.40,.51,.32)),
 'bridge':mat('桥梁/主要道路',(.73,.73,.65)),
 'studio':mat('摄影棚背景',(.80,.83,.79)),
 'roof_dark':mat('教学楼示意坡屋顶',(.18,.24,.23)),
 'tree1':mat('植栽深绿',(.22,.38,.23)),
 'tree2':mat('植栽中绿',(.30,.45,.27)),
 'tree3':mat('植栽浅绿',(.38,.51,.30)),
}
def xy(p):return((p[0]-CX)*S,(CY-p[1])*S)
def poly_obj(name,px,z,h,material,collection=base,bevel=0):
 pts=[xy(p) for p in px]
 # Ensure CCW in world XY
 area=sum(pts[i][0]*pts[(i+1)%len(pts)][1]-pts[(i+1)%len(pts)][0]*pts[i][1] for i in range(len(pts)))
 if area<0:pts.reverse()
 cx=sum(p[0] for p in pts)/len(pts);cy=sum(p[1] for p in pts)/len(pts)
 n=len(pts);vs=[(x-cx,y-cy,0)for x,y in pts]+[(x-cx,y-cy,h)for x,y in pts]
 faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],faces);me.materials.append(material);me.update()
 ob=bpy.data.objects.new(name,me);collection.objects.link(ob);ob.location=(cx,cy,z)
 if bevel:
  mod=ob.modifiers.new('Edge softness · 示意倒角','BEVEL');mod.width=bevel;mod.segments=1
  mod.affect='EDGES'
  ob.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return ob
boundary=[[120,154],[925,154],[925,780],[898,793],[173,793],[155,773],[139,670],[122,463]]
plinth=poly_obj('CAMPUS_PLINTH | 全校区展示底座',boundary,-17,17,M['plinth'],bevel=4)
# image-based schematic landcover, has no labels, arbitrary source image hues removed
m=bpy.data.materials.new('Ground | 由总图分类生成的示意地表');m.use_nodes=True
bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.9
tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ROOT/'reference/landcover_schematic.png'));tex.image.pack()
m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
ground=poly_obj('Ground | 地表分类底图',boundary,.03,.2,m)
uv=ground.data.uv_layers.new(name='Masterplan image coordinates')
for face in ground.data.polygons:
 for li in face.loop_indices:
  v=ground.data.vertices[ground.data.loops[li].vertex_index].co+ground.location
  px=v.x/S+CX;py=CY-v.y/S;uv.data[li].uv=(px/1375,1-py/867)
# Lake contours inferred from source pixels; negative rings are islands placed over water.
for i,c in enumerate(L['water_contours']):
 material=M['water']if c['area']>0 else M['island'];z=.28 if c['area']>0 else .62
 poly_obj('Water_'+str(i) if c['area']>0 else 'Island_'+str(i),c['points'],z,.25,material)
# bridges at lake crossings preserve access in the visual, but no route graph is asserted
for n,p in [('North bridge',[[247,270],[286,270],[286,278],[242,278]]),('Main east-west axis',[[337,486],[558,486],[558,495],[337,495]]),('Library east bridge',[[492,445],[543,445],[543,451],[492,451]])]:poly_obj(n,p,1,1,M['bridge'])
# Building extrusion plus independent flat roof finish; all dimensions remain editable.
for b in B:
 c=cols[b['status']];h=float(b['height_m']);name=b['id']+' | '+b['name_cn']
 ob=poly_obj(name,b['footprint_px'],.55,h-.45,M[b['status']],c,.28 if h>10 else .15)
 for k,v in b.items():
  if k=='footprint_px':ob['footprint_px_json']=json.dumps(v)
  elif isinstance(v,(dict,list)):ob[k]=json.dumps(v,ensure_ascii=False)
  else:ob[k]=v
 ob['is_building_component']=True;ob['height_editing']='Set height in data/buildings.json and rerun; or scale Z around this ground-level origin.'
 conf=b['height_confidence'];roofmat=M['roof_known']if conf in ['source_height','source_supported','official_reported'] else M['roof_floor']if conf=='floor_derived' else M['roof_estimated']
 if b['status']!='existing':roofmat=M[b['status']]
 roof=poly_obj(b['id']+' | roof',b['footprint_px'],h+.10,.45,roofmat,c,.15)
 # maintain current world position while assigning the root as parent
 roof.parent=ob;roof.location=(0,0,h-.45)
 roof['role']='Schematic roof finish, not an extra floor'
 # simplified low pitched roof for 8 teaching bars, observed in official photos but dimensions estimated
 if b['id'].startswith('A1_bar_'):
  px=b['footprint_px'];x1=min(p[0]for p in px);x2=max(p[0]for p in px);y1=min(p[1]for p in px);y2=max(p[1]for p in px)
  coords=[xy(p)for p in [[x1,y1],[x2,y1],[x2,y2],[x1,y2],[(x1+x2)/2,y1],[(x1+x2)/2,y2]]]
  # ridge follows long x direction
  coords=[xy(p)for p in [[x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,(y1+y2)/2],[x2,(y1+y2)/2]]]
  v=[(x,y,h+1.0+(2.3 if i>=4 else 0))for i,(x,y)in enumerate(coords)]
  me=bpy.data.meshes.new('Teaching roof mesh');me.from_pydata(v,[],[(0,1,5,4),(4,5,2,3),(0,4,3),(1,2,5)]);me.materials.append(M['roof_dark'])
  ro=bpy.data.objects.new(b['id']+' | conceptual pitched roof',me);c.objects.link(ro);ro['note']='Pitched roof relation from2012officialphoto;2.3m ridge rise estimated, not surveyed.'
# Tree instances from source green symbols, reject building footprints.
def inside(x,y,p):
 c=False;j=len(p)-1
 for i in range(len(p)):
  xi,yi=p[i];xj,yj=p[j]
  if (yi>y)!=(yj>y)and x<(xj-xi)*(y-yi)/(yj-yi)+xi:c=not c
  j=i
 return c
bounds=[(min(x for x,y in b['footprint_px'])-1,min(y for x,y in b['footprint_px'])-1,max(x for x,y in b['footprint_px'])+1,max(y for x,y in b['footprint_px'])+1,b['footprint_px'])for b in B]
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1);proto=bpy.context.object;mesh0=proto.data.copy();bpy.data.objects.remove(proto,do_unlink=True)
meshes=[]
for k in ['tree1','tree2','tree3']:
 me=mesh0.copy();me.materials.append(M[k]);meshes.append(me)
rng=random.Random(2026);n=0
for x,y,r,h in L['tree_points']:
 if any(x1<=x<=x2 and y1<=y<=y2 for x1,y1,x2,y2 in [(247,699,290,775),(839,294,897,432),(836,536,892,668),(550,695,679,751),(239,609,302,674),(290,729,335,771)]):continue
 blocked=any(x1<x<x2 and y1<y<y2 and inside(x,y,p) for x1,y1,x2,y2,p in bounds)
 if blocked:continue
 ob=bpy.data.objects.new('Planting_%04d'%n,meshes[n%3]);treecol.objects.link(ob);ob.location=(*xy((x,y)),h*.58);ob.scale=(r,r,h*.52);ob.rotation_euler.z=rng.random()*6.28;n+=1
scene['schematic_tree_instances']=n
# Reference plane hidden by default but packed; exact overlay same XY transformation.
rm=bpy.data.materials.new('REFERENCE official masterplan');rm.use_nodes=True
rt=rm.node_tree.nodes.new('ShaderNodeTexImage');rt.image=bpy.data.images.load(str(ROOT/'reference/seu-jiulonghu-official-masterplan-2025.jpg'));rt.image.pack();rm.node_tree.links.new(rt.outputs['Color'],rm.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
ref=poly_obj('REFERENCE | 2025 官方总图 开启本集合对照',[[0,0],[1375,0],[1375,867],[0,867]],-.2,.01,rm,refcol)
uv=ref.data.uv_layers.new(name='Full reference')
for face in ref.data.polygons:
 for li in face.loop_indices:
  v=ref.data.vertices[ref.data.loops[li].vertex_index].co+ref.location;uv.data[li].uv=((v.x/S+CX)/1375,1-(CY-v.y/S)/867)
refcol.hide_render=True;refcol.hide_viewport=True
# Studio floor
poly_obj('Studio floor',[[-3000,-3000],[4000,-3000],[4000,4000],[-3000,4000]],-22,1,M['studio'])
# cameras
from mathutils import Vector
def camera(name,loc,target,scale):
 ca=bpy.data.cameras.new(name);ob=bpy.data.objects.new(name,ca);camcol.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler();ca.type='ORTHO';ca.ortho_scale=scale;ca.clip_end=10000;return ob
main=camera('01 全校区 · 东南鸟瞰',(1250,-1650,1850),(0,10,0),2180)
top=camera('02 全校区 · 正北俯视',(0,0,2600),(0,0,0),1780);top.rotation_euler=(0,0,0)
close=camera('03 图书馆与教学区',(600,-1100,1200),(80,105,0),1160)
def light(name,typ,loc,power,color,size):
 da=bpy.data.lights.new(name,typ);da.energy=power;da.color=color
 if typ=='AREA':da.shape='DISK';da.size=size
 if typ=='SUN':da.angle=size
 ob=bpy.data.objects.new(name,da);camcol.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector((0,0,0))-ob.location).to_track_quat('-Z','Y').to_euler();return ob
light('Sun · southwest','SUN',(-900,-1100,2100),3.0,(1,.91,.77),.08)
light('Large soft sky','AREA',(500,500,2200),400000,(.78,.86,1),1800)
scene.world.color=(.5,.5,.5);scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.65,.72,.77,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.5
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=64;scene.cycles.use_denoising=False;scene.cycles.max_bounces=4
scene.render.resolution_x=2400;scene.render.resolution_y=1800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
scene.render.threads_mode='FIXED';scene.render.threads=12
scene.camera=main
# Embed editable source and important caveats inside the .blend as Text Editor entries.
for nm,p in [('BUILDINGS_EDITABLE.json',ROOT/'data/buildings.json'),('GENERATOR.py',Path(__file__))]:
 tx=bpy.data.texts.new(nm);tx.write(p.read_text())
readme=ROOT/'README_中文.md'
if readme.exists():tx=bpy.data.texts.new('README_先读说明');tx.write(readme.read_text())
# Useful initial viewport
for ws in bpy.data.workspaces:
 for screen in [ws.screens[0]] if hasattr(ws,'screens') else []:pass
for area in bpy.context.screen.areas if bpy.context.screen else []:
 if area.type=='VIEW_3D':
  area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.color_type='MATERIAL';area.spaces.active.region_3d.view_distance=2100;area.spaces.active.region_3d.view_location=(0,0,0);area.spaces.active.clip_end=10000
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'SEU_Jiulonghu_Campus_v1.blend'))
print('SAVED_BLEND',len(B),'building components;',n,'planting instances')
# Three views; env PREVIEW_ONLY makes a fast render for composition QA.
if os.environ.get('PREVIEW_ONLY')=='1':
 scene.cycles.samples=12;scene.render.resolution_percentage=35;scene.render.filepath=str(OUT/'test_overview.png');bpy.ops.render.render(write_still=True)
else:
 for cam,name in [(main,'01_campus_overview_raw.png'),(top,'02_campus_top_raw.png'),(close,'03_central_close_raw.png')]:
  scene.camera=cam;scene.render.filepath=str(OUT/name);bpy.ops.render.render(write_still=True)
 scene.camera=main;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'SEU_Jiulonghu_Campus_v1.blend'))
print('DONE')
