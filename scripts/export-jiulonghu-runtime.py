"""Blender 4.3: --disable-autoexec --background --python this-file.
Read supplied .blend, export base geometry only. Never execute embedded texts.
Quantized interleaved vertices: position i16*3 (0.1m), normal i8*3,
sRGB color u8*3, UV u16*2; uint16 indices; chunks <=60000 vertices.
"""
from pathlib import Path
import bpy, json, math, struct, hashlib
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'design/models/jiulonghu-blender-v1/filtered/东南大学九龙湖_已建与在建_去规划/东南大学九龙湖_已建与在建_去规划.blend'
OUT=ROOT/'campus3d/assets';OUT.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.use_scripts_auto_execute=False
bpy.ops.wm.open_mainfile(filepath=str(SOURCE),load_ui=False,use_scripts=False)
objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and not o.name.startswith(('Studio','REFERENCE'))]
roots=[o for o in objects if o.get('is_building_component')]
assert len(roots)==331 and all(o.get('status') in ['existing','under_construction'] for o in roots)
trees=sorted([o for o in objects if o.name.startswith('Planting_')],key=lambda o:o.name)
# Decorative planting only: evenly retain <=720 source instances. Building roots
# and all independent roofs remain; bevel modifiers intentionally omitted at LOD.
chosen={trees[int(i*len(trees)/min(720,len(trees)))].name for i in range(min(720,len(trees)))}
objects=[o for o in objects if not o.name.startswith('Planting_') or o.name in chosen]
chunks=[];vdata=bytearray();indices=[];lookup={};counts={};bounds=[[1e9]*3,[-1e9]*3]
def flush():
 global vdata,indices,lookup
 if indices:chunks.append((bytes(vdata),struct.pack('<'+'H'*len(indices),*indices)))
 vdata=bytearray();indices=[];lookup={}
def srgb(x):return max(0,min(255,round((12.92*x if x<=.0031308 else 1.055*x**(1/2.4)-.055)*255)))
for ob in objects:
 me=ob.data;me.calc_loop_triangles();matrix=ob.matrix_world;normal=matrix.to_3x3().inverted().transposed()
 is_ground=ob.name.startswith('Ground |');counts[ob.name]=len(me.loop_triangles)
 for tri in me.loop_triangles:
  if len(lookup)+3>60000:flush()
  material=me.materials[min(tri.material_index,len(me.materials)-1)] if me.materials else None
  bs=material.node_tree.nodes.get('Principled BSDF') if material and material.use_nodes else None
  color=tuple(srgb(x) for x in (bs.inputs['Base Color'].default_value[:3] if bs else [.6,.7,.6]))
  n=normal@tri.normal;n.normalize();n=(n.x,n.z,-n.y)
  for vi,li in zip(tri.vertices,tri.loops):
   p=matrix@me.vertices[vi].co;p=(p.x,p.z,-p.y)
   for k in range(3):bounds[0][k]=min(bounds[0][k],p[k]);bounds[1][k]=max(bounds[1][k],p[k])
   uv=me.uv_layers.active.data[li].uv if is_ground else (1,1)
   key=struct.pack('<3h3b3B2H',*(round(x*10) for x in p),*(round(x*127) for x in n),*color,*(round(max(0,min(1,x))*65535) for x in uv))
   if key not in lookup:lookup[key]=len(lookup);vdata.extend(key)
   indices.append(lookup[key])
flush();blob=bytearray();parts=[]
for vertices,ix in chunks:
 parts.append(dict(vertexOffset=len(blob),vertexCount=len(vertices)//16,indexOffset=len(blob)+len(vertices),indexCount=len(ix)//2))
 blob.extend(vertices);blob.extend(ix)
 while len(blob)%4:blob.append(0)
(OUT/'campus.bin').write_bytes(blob)
metadata=dict(schema='campus-mesh-v1',stride=16,positionScale=.1,parts=parts,bounds=bounds,
 sourceBlendSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),meshSha256=hashlib.sha256(blob).hexdigest(),
 buildingComponents=len(roots),statusCounts={s:sum(o.get('status')==s for o in roots) for s in ['existing','under_construction']},
 sourceTrees=len(trees),runtimeTrees=len(chosen),triangles=sum(p['indexCount']//3 for p in parts),
 sourceAxes='Blender +Y north, +Z up',runtimeAxes='+Y up, -Z north',
 fieldVerified=False,georeferencedInSource=False,
 lod='All 331 original building base meshes and roofs, no bevel modifiers; 720 evenly sampled decorative tree instances maximum; hidden reference/studio excluded.')
(OUT/'campus-meta.bin').write_text(json.dumps(metadata,separators=(',',':')),encoding='utf8')
(ROOT/'design/models/jiulonghu-blender-v1/runtime/export-audit.json').write_text(json.dumps(dict(metadata,objectTriangles=counts),ensure_ascii=False,indent=2),encoding='utf8')
print('EXPORTED',len(blob),'bytes;',metadata['triangles'],'triangles;',len(chunks),'draws')
