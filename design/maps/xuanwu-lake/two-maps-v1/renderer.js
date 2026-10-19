'use strict';
const R=6378137, rad=Math.PI/180;
const project=p=>[R*p[0]*rad,R*Math.log(Math.tan(Math.PI/4+p[1]*rad/2))];
const inverse=p=>[p[0]/R/rad,(2*Math.atan(Math.exp(p[1]/R))-Math.PI/2)/rad];
const config=window.MAP_CONFIG;
const features=MAP_DATA.features.map(f=>({...f,world:f.geometry.type==='Polygon'?f.geometry.coordinates.map(r=>r.map(project)):f.geometry.type==='LineString'?f.geometry.coordinates.map(project):project(f.geometry.coordinates)}));
const lakes=features.filter(f=>f.properties.layer==='water'&&f.geometry.type==='Polygon');
const parks=features.filter(f=>f.properties.layer==='land'&&f.geometry.type==='Polygon');
const roads=features.filter(f=>f.properties.layer==='road').sort((a,b)=>(Number(a.properties.tags.layer)||0)-(Number(b.properties.tags.layer)||0));
const buildings=features.filter(f=>f.properties.layer==='building');
const map=document.querySelector('#map'),overlay=document.querySelector('#overlay'),stage=document.querySelector('#stage');
const atlas=new Image();
let current=config.scenes[0],zoom=1,angle=0,pan=[0,0],wire=false,anchors=false;
const patternTiles={},sprites=[];
function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function path(f){const p=new Path2D(),rs=f.geometry.type==='Polygon'?f.world:[f.world];for(const r of rs){if(!r.length)continue;p.moveTo(...r[0]);for(let i=1;i<r.length;i++)p.lineTo(...r[i]);if(f.geometry.type==='Polygon')p.closePath();}return p;}
for(const f of features)if(f.geometry.type!=='Point')f.path=path(f);
function prepareMaterials(){
 const h=atlas.width/2,v=atlas.height/2;
 for(const [key,qx,qy] of [['grass',0,0],['water',1,0],['canopy',0,1],['roof',1,1]]){
  const c=makeCanvas(160,160),x=c.getContext('2d');x.imageSmoothingEnabled=false;x.drawImage(atlas,qx*h,qy*v,h,v,0,0,160,160);
  if(key==='grass'||key==='water'){x.fillStyle=key==='grass'?'rgba(185,214,116,.40)':'rgba(95,198,224,.48)';x.fillRect(0,0,160,160);}patternTiles[key]=c;
 }
 for(let i=0;i<3;i++){
  const c=makeCanvas(48,48),x=c.getContext('2d');x.imageSmoothingEnabled=false;
  x.fillStyle='#426d3a';x.fillRect(21,33,7,13);x.fillStyle='#9a6634';x.fillRect(23,34,3,10);
  x.beginPath();[[9,9],[18,9],[18,4],[31,4],[31,8],[38,8],[38,15],[43,15],[43,29],[39,29],[39,35],[30,35],[30,39],[16,39],[16,35],[8,35],[8,29],[4,29],[4,17],[9,17]].forEach(([a,b],j)=>j?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.clip();
  x.drawImage(atlas,i*h/3,v,h/3,v/3,2,2,44,39);sprites.push(c);
 }
}
function material(ctx,key,meters){const p=ctx.createPattern(patternTiles[key],'repeat');p.setTransform(new DOMMatrix().scale(meters/160,meters/160));return p;}
function insideRing(p,r){let b=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],z=r[j];if((a[1]>p[1])!==(z[1]>p[1])&&p[0]<(z[0]-a[0])*(p[1]-a[1])/(z[1]-a[1])+a[0])b=!b;}return b;}
function contains(f,p){return insideRing(p,f.world[0])&&!f.world.slice(1).some(r=>insideRing(p,r));}
function distanceSegment(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
const segments=roads.flatMap(f=>{const r=f.geometry.type==='Polygon'?f.world[0]:f.world;return r.slice(1).map((p,i)=>[r[i],p]);});
const hash=(x,y)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263);n=(n^(n>>>13));return ((Math.imul(n,1274126177)^(n>>>16))>>>0)/4294967296;};
function trees(bounds){
 const [x0,y0,x1,y1]=bounds,result=[];
 for(let gx=Math.floor(x0/29);gx<=Math.ceil(x1/29);gx++)for(let gy=Math.floor(y0/29);gy<=Math.ceil(y1/29);gy++){
  const h=hash(gx,gy);if(h>.56)continue;const p=[gx*29+(hash(gy,gx)-.5)*20,gy*29+(hash(gx+8,gy+3)-.5)*20];
  if(!parks.some(f=>contains(f,p))||lakes.some(f=>contains(f,p)))continue;
  if(segments.some(([a,b])=>distanceSegment(p,a,b)<13))continue;
  if(buildings.some(f=>f.geometry.type==='Polygon'&&contains(f,p)))continue;
  // Shoreline and footprint clearance: decorative crowns never hide the geometry.
  if([...lakes,...buildings].some(f=>f.geometry.type==='Polygon'&&f.world.some(r=>r.slice(1).some((b,i)=>distanceSegment(p,r[i],b)<11))))continue;
  result.push([p,13+hash(gy+11,gx)*5,Math.floor(h*5)%3]);
 }
 return result;
}
const treeCache=new Map();
function camera(scene,w,h,z=1,a=0,p=[0,0]){
 const [x0,y0,x1,y1]=scene.world_bounds,s=w/(x1-x0)*z,cx=(x0+x1)/2,cy=(y0+y1)/2;
 return {s,cx,cy,w,h,a,p,point(q){const x=(q[0]-cx)*s,y=-(q[1]-cy)*s;return [w/2+p[0]+Math.cos(a)*x-Math.sin(a)*y,h/2+p[1]+Math.sin(a)*x+Math.cos(a)*y];},unpoint(q){let x=q[0]-w/2-p[0],y=q[1]-h/2-p[1];return [cx+(Math.cos(a)*x+Math.sin(a)*y)/s,cy-(-Math.sin(a)*x+Math.cos(a)*y)/s];}};
}
function applyCamera(ctx,c){ctx.translate(c.w/2+c.p[0],c.h/2+c.p[1]);ctx.rotate(c.a);ctx.scale(c.s,-c.s);ctx.translate(-c.cx,-c.cy);}
function draw(scene,target,z=1,a=0,p=[0,0]){
 const grid=config.pixel_grid?3:1,low=makeCanvas(Math.ceil(target.width/grid),Math.ceil(target.height/grid)),ctx=low.getContext('2d');ctx.imageSmoothingEnabled=false;
 const cam=camera(scene,low.width,low.height,z,a,p.map(v=>v/grid));
 ctx.fillStyle='#faf8ef';ctx.fillRect(0,0,low.width,low.height);ctx.save();applyCamera(ctx,cam);
 const sb=scene.world_bounds;ctx.beginPath();ctx.rect(sb[0],sb[1],sb[2]-sb[0],sb[3]-sb[1]);ctx.clip();
 const pix=config.art_mode==='pixel';
 ctx.fillStyle=pix?material(ctx,'grass',62):'#cddcb7';
 const visible=[cam.unpoint([0,0]),cam.unpoint([low.width,0]),cam.unpoint([low.width,low.height]),cam.unpoint([0,low.height])];
 const bounds=[Math.min(...visible.map(p=>p[0])),Math.min(...visible.map(p=>p[1])),Math.max(...visible.map(p=>p[0])),Math.max(...visible.map(p=>p[1]))];
 ctx.fillRect(bounds[0]-100,bounds[1]-100,bounds[2]-bounds[0]+200,bounds[3]-bounds[1]+200);
 for(const f of lakes){
  ctx.fillStyle=pix?material(ctx,'water',190):'#9accdf';ctx.fill(f.path,'evenodd');
  if(pix){ctx.save();ctx.clip(f.path,'evenodd');ctx.strokeStyle='#80d8d8';ctx.lineWidth=11;ctx.stroke(f.path);ctx.strokeStyle='#b7ede0';ctx.lineWidth=5;ctx.stroke(f.path);ctx.restore();}
  ctx.strokeStyle=pix?'#e7d7a0':'#b8ccb0';ctx.lineWidth=pix?2:1;ctx.stroke(f.path);
 }
 if(pix){
  // World-fixed decoration, reused at all zoom levels; no changes to geographic features.
  const key=scene.id;if(!treeCache.has(key))treeCache.set(key,trees([scene.world_bounds[0]-250,scene.world_bounds[1]-250,scene.world_bounds[2]+250,scene.world_bounds[3]+250]));
  for(const [q,size,i] of treeCache.get(key)){
   ctx.save();ctx.translate(q[0],q[1]);ctx.scale(1,-1);ctx.fillStyle='#65894966';ctx.fillRect(-size*.4,1,size*.9,size*.28);ctx.drawImage(sprites[i],-size/2,-size*.8,size,size);ctx.restore();
  }
 }
 for(const f of features.filter(f=>f.properties.layer==='wall')){ctx.strokeStyle=pix?'#4c604c':'#7d8277';ctx.lineWidth=8;ctx.stroke(f.path);ctx.strokeStyle=pix?'#a4a889':'#a9ad92';ctx.lineWidth=5;ctx.stroke(f.path);if(pix){ctx.setLineDash([3,2]);ctx.strokeStyle='#c0b899';ctx.lineWidth=2;ctx.stroke(f.path);ctx.setLineDash([]);}}
 for(const f of roads){
  const t=f.properties.tags,bridge=t.bridge&&t.bridge!=='no';
  const defaultWidth={footway:3,path:2.5,steps:3.2,cycleway:3,pedestrian:5,service:5,living_street:6,unclassified:7,tertiary:8,primary:11};
  const width=Number.parseFloat(t.width)||defaultWidth[t.highway]||6;
  ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash(t.tunnel==='yes'?[4,3]:[]);
  if(f.geometry.type==='Polygon'){ctx.fillStyle='#f6e5b0';ctx.fill(f.path);}
  ctx.strokeStyle=pix?(bridge?'#896238':'#b9a66c'):'#d7d7c1';ctx.lineWidth=width+(pix?1.7:1);ctx.stroke(f.path);
  ctx.strokeStyle=pix?(bridge?'#e0b971':'#fff0c4'):'#fffdf6';ctx.lineWidth=width;ctx.stroke(f.path);
  if(pix&&(bridge||t.highway==='steps')){ctx.strokeStyle=bridge?'#9e793e':'#c5b785';ctx.lineWidth=width*.7;ctx.setLineDash([.35,2]);ctx.stroke(f.path);}ctx.setLineDash([]);
 }
 for(const f of features.filter(f=>f.properties.layer==='waterway')){ctx.strokeStyle='#58b3cf';ctx.lineWidth=2;ctx.stroke(f.path);}
 for(const f of buildings){
  if(f.geometry.type!=='Polygon')continue;
  if(pix){ctx.save();ctx.translate(1.6,-1.8);ctx.fillStyle='#5a683f77';ctx.fill(f.path);ctx.restore();}
  ctx.fillStyle=pix?material(ctx,'roof',30):'#d5ccbd';ctx.fill(f.path);ctx.strokeStyle=pix?'#855835':'#b8b9a6';ctx.lineWidth=pix?1.1:.6;ctx.stroke(f.path);
 }
 ctx.restore();const out=target.getContext('2d');out.imageSmoothingEnabled=false;out.clearRect(0,0,target.width,target.height);out.drawImage(low,0,0,target.width,target.height);
 return camera(scene,target.width,target.height,z,a,p);
}
function overlayDraw(cam){
 const ctx=overlay.getContext('2d');ctx.clearRect(0,0,overlay.width,overlay.height);
 if(wire){ctx.save();applyCamera(ctx,cam);ctx.lineWidth=1.25/cam.s;ctx.strokeStyle='#cf2557';for(const f of features)if(f.path)ctx.stroke(f.path);ctx.restore();}
 if(anchors){for(const v of MAP_ANCHORS.anchors){if(v.duplicate_of)continue;const p=cam.point(project(v.wgs84));if(p[0]<0||p[0]>overlay.width||p[1]<0||p[1]>overlay.height)continue;ctx.beginPath();ctx.arc(...p,6,0,Math.PI*2);ctx.fillStyle='#f58132';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.font='bold 16px sans-serif';ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.strokeText(v.id,p[0]+10,p[1]-10);ctx.fillStyle='#173e44';ctx.fillText(v.id,p[0]+10,p[1]-10);}}
 ctx.fillStyle='#234939';ctx.font='bold 16px sans-serif';ctx.save();ctx.translate(34,34);ctx.rotate(cam.a);ctx.fillText('↑ N',-14,0);ctx.restore();
 const meters=zoom<2?100:20,bar=meters/Math.cos(current.bounds_wgs84[1]*rad)*cam.s;
 ctx.fillRect(20,overlay.height-24,bar,3);ctx.font='12px sans-serif';ctx.fillText(meters+' m',20,overlay.height-31);
}
let currentCamera;
function render(){
 const width=Math.min(stage.clientWidth,1200),height=Math.round(width*current.output_size[1]/current.output_size[0]);stage.style.height=height+'px';map.width=overlay.width=width;map.height=overlay.height=height;
 currentCamera=draw(current,map,zoom,angle,pan);overlayDraw(currentCamera);
 document.querySelector('#status').textContent=current.title+' · '+zoom.toFixed(2)+'× · '+Math.round(angle/rad)+'° · '+(wire?'真实矢量叠加':config.art_mode==='pixel'?'像素美术层':'基线平面底图');
}
async function post(name,data){const r=await fetch('/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,data})});if(!r.ok)throw Error('Export '+r.status);}
async function exportScene(scene){const c=makeCanvas(...scene.output_size);draw(scene,c);await post('map-'+scene.id+'.png',c.toDataURL('image/png'));}
function reset(){zoom=1;angle=0;pan=[0,0];render();}
document.querySelector('#scene').onchange=e=>{current=config.scenes.find(s=>s.id===e.target.value);reset();};
document.querySelector('#plus').onclick=()=>{zoom=Math.min(8,zoom*1.3);render();};
document.querySelector('#minus').onclick=()=>{zoom=Math.max(.5,zoom/1.3);render();};
document.querySelector('#rotate').onclick=()=>{angle+=15*rad;render();};
document.querySelector('#reset').onclick=reset;
document.querySelector('#wire').onchange=e=>{wire=e.target.checked;render();};document.querySelector('#anchors').onchange=e=>{anchors=e.target.checked;render();};
document.querySelector('#save').onclick=async()=>{await exportScene(current);document.querySelector('#status').textContent='已保存 map-'+current.id+'.png · '+current.output_size.join('×');};
let drag=null;
map.onpointerdown=e=>{drag=[e.clientX,e.clientY,...pan];map.setPointerCapture(e.pointerId);};
map.onpointermove=e=>{if(drag){pan=[drag[2]+e.clientX-drag[0],drag[3]+e.clientY-drag[1]];render();}const rect=map.getBoundingClientRect(),p=inverse(currentCamera.unpoint([e.clientX-rect.left,e.clientY-rect.top]));document.querySelector('#coords').textContent='WGS84 '+p.map(v=>v.toFixed(7)).join(', ')+' · 拖动平移 / 滚轮缩放';};
map.onpointerup=map.onpointercancel=()=>drag=null;
map.onwheel=e=>{e.preventDefault();zoom=Math.max(.5,Math.min(8,zoom*(e.deltaY<0?1.12:1/1.12)));render();};
window.onresize=()=>render();
atlas.onload=async()=>{try{prepareMaterials();render();if(window.CONFIG_FILE==='maps-config.json'){for(const s of config.scenes)await exportScene(s);await post('browser-check.json',{result:'PASS',atlas_size:[atlas.width,atlas.height],exports:config.scenes.map(s=>({id:s.id,size:s.output_size})),geometry_source:'WGS84 OSM',decoration:'non-surveyed tree/grass/water/roof texture only',product_files_modified:false});}document.body.dataset.ready='true';}catch(e){document.querySelector('#status').textContent=e.message;console.error(e);}};
atlas.onerror=()=>{document.querySelector('#status').textContent='材质载入失败';};atlas.src='materials-atlas.png';
