'use strict';
const m=window.REGISTRATION, G=window.GeoMapping, features=window.REFERENCE.features;
const art=document.getElementById('art'), geo=document.getElementById('geo');
const ctxA=art.getContext('2d'),ctxG=geo.getContext('2d'),img=new Image();
const $=id=>document.getElementById(id),S=1254;
// Equal Mercator scale in X/Y, padded data hull; never reuse v3/v4 invented bounds.
const xs=m.world.map(p=>p[0]),ys=m.world.map(p=>p[1]);
const center=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];
const span=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))*1.13, scale=S/span;
const north=p=>[(p[0]-center[0])*scale+S/2,(center[1]-p[1])*scale+S/2];
const local=xy=>[center[0]+(xy[0]-S/2)/scale,center[1]-(xy[1]-S/2)/scale];
const projected=ll=>G.merc(ll).map((v,i)=>v-m.origin[i]);
let selected=null;
function line(c,ps,color,width=2,close=false){if(!ps.length)return;c.beginPath();ps.forEach((p,i)=>{if(p)(i?c.lineTo(...p):c.moveTo(...p));});if(close)c.closePath();c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function texture(c){
 c.imageSmoothingEnabled=false;
 for(const ids of m.triangles){
  const src=ids.map(i=>m.pixels[i]),dst=ids.map(i=>north(m.world[i]));
  const [p,q,r]=src,[a,b,d]=dst,det=(q[0]-p[0])*(r[1]-p[1])-(r[0]-p[0])*(q[1]-p[1]);
  const A=((b[0]-a[0])*(r[1]-p[1])-(d[0]-a[0])*(q[1]-p[1]))/det;
  const C=((d[0]-a[0])*(q[0]-p[0])-(b[0]-a[0])*(r[0]-p[0]))/det;
  const B=((b[1]-a[1])*(r[1]-p[1])-(d[1]-a[1])*(q[1]-p[1]))/det;
  const D=((d[1]-a[1])*(q[0]-p[0])-(b[1]-a[1])*(r[0]-p[0]))/det;
  c.save();c.beginPath();dst.forEach((v,i)=>i?c.lineTo(...v):c.moveTo(...v));c.closePath();c.clip();c.setTransform(A,B,C,D,a[0]-A*p[0]-C*p[1],a[1]-B*p[0]-D*p[1]);c.drawImage(img,0,0);c.restore();
 }
}
function vector(c,which){
 for(const f of features){
  const island=f.properties.place==='island',corridor=f.properties.osm_id.startsWith('105009');
  if(island&&!$('shore').checked)continue;if(!island&&!$('lines').checked)continue;
  const coords=f.geometry.coordinates, dense=[];
  for(let i=0;i<coords.length-1;i++){const a=coords[i],b=coords[i+1];for(let j=0;j<32;j++)dense.push(a.map((v,k)=>v+(b[k]-v)*j/32));}dense.push(coords.at(-1));
  const points=dense.map(ll=>{if(which==='geo')return north(projected(ll));const q=G.geoToPixel(ll,m);return q?[q.x,q.y]:null;});
  let part=[];const color=island?'#286745':corridor?'#a52bed':'#ff6b20';
  for(const p of points){if(p)part.push(p);else{line(c,part,color,island?2:3);part=[];}}line(c,part,color,island?2:3);
 }
}
function markers(c,which){
 if($('mesh').checked)for(const ids of m.triangles)line(c,ids.map(i=>which==='art'?m.pixels[i]:north(m.world[i])),'#213f7655',1,true);
 if($('points').checked)for(let i=0;i<m.anchors.length;i++){
  const a=m.anchors[i],p=which==='art'?a.pixel:north(m.world[i]);
  c.beginPath();c.arc(...p,4,0,Math.PI*2);c.fillStyle='white';c.fill();c.strokeStyle='#25392f';c.lineWidth=1;c.stroke();
  if(a.group!=='H'&&a.group!=='Y'){c.font='bold 12px sans-serif';c.lineWidth=3;c.strokeStyle='#fff';c.strokeText(a.id,p[0]+6,p[1]-6);c.fillStyle='#1f3f2f';c.fillText(a.id,p[0]+6,p[1]-6);}
 }
 if(selected){const p=which==='art'?selected.pixel:north(projected(selected.ll));c.beginPath();c.arc(...p,12,0,Math.PI*2);c.strokeStyle='#ef1646';c.lineWidth=4;c.stroke();}
}
function render(){
 ctxA.clearRect(0,0,S,S);ctxA.drawImage(img,0,0);ctxG.clearRect(0,0,S,S);ctxG.fillStyle='#a9d3dd';ctxG.fillRect(0,0,S,S);
 for(const f of features.filter(f=>f.properties.place==='island')){ctxG.beginPath();f.geometry.coordinates.map(ll=>north(projected(ll))).forEach((p,i)=>i?ctxG.lineTo(...p):ctxG.moveTo(...p));ctxG.closePath();ctxG.fillStyle='#cbdcb5';ctxG.fill();}
 ctxG.save();ctxG.globalAlpha=+$('opacity').value;texture(ctxG);ctxG.restore();vector(ctxA,'art');vector(ctxG,'geo');markers(ctxA,'art');markers(ctxG,'geo');
 ctxG.fillStyle='#24483c';ctxG.font='bold 22px sans-serif';ctxG.fillText('↑ N',35,42);ctxG.font='16px sans-serif';ctxG.fillText('EPSG:3857 · WGS84 source',35,68);
 const length=100/Math.cos(32.074*Math.PI/180)*scale;ctxG.strokeStyle='#24483c';ctxG.lineWidth=3;ctxG.beginPath();ctxG.moveTo(35,S-50);ctxG.lineTo(35+length,S-50);ctxG.stroke();ctxG.fillText('≈100 m ground',35,S-65);
}
function pick(pixel,ll,label='自选点'){
 selected={pixel,ll};$('info').textContent=`${label}\n原图像素：${pixel.map(v=>v.toFixed(2)).join(', ')} | 归一化：${pixel.map(v=>(v/S).toFixed(6)).join(', ')}\nWGS84 经度、纬度：${ll.map(v=>v.toFixed(7)).join(', ')}\n状态：OSM 图像配准 / 实地待验`;render();
}
for(const id of ['lines','shore','points','mesh','opacity'])$(id).addEventListener('input',render);
m.anchors.forEach((a,i)=>{const o=document.createElement('option');o.value=i;o.textContent=a.id+' · '+({B1:'樱桥',B2:'白桥',B3:'月影桥',B4:'莲桥',C:'长廊',H:'环洲',Y:'樱洲'}[a.group]);$('anchor').append(o);});
$('anchor').onchange=()=>{if($('anchor').value==='')return;const a=m.anchors[+$('anchor').value];pick(a.pixel,a.wgs84,a.id);};
for(const [c,which] of [[art,'art'],[geo,'geo']])c.onclick=e=>{const b=c.getBoundingClientRect(),p=[(e.clientX-b.left)*S/b.width,(e.clientY-b.top)*S/b.height];if(which==='art'){const q=G.pixelToGeo(p,m);if(q)pick(p,[q.lng,q.lat]);else $('info').textContent='此点在已配准控制点范围以外，返回 null；不推测真实位置。';}else{const ll=G.unmerc(local(p).map((v,i)=>v+m.origin[i])),q=G.geoToPixel(ll,m);if(q)pick([q.x,q.y],ll);else $('info').textContent='此点在有效配准范围以外，返回 null。';}};
function exportRaster(){const c=document.createElement('canvas');c.width=S;c.height=S;texture(c.getContext('2d'));return c.toDataURL('image/png');}
$('export').onclick=()=>{const a=document.createElement('a');a.href=exportRaster();a.download='registered-north-up.png';a.click();};
window.exportRaster=exportRaster;window.viewMeta={width:S,height:S,scale,span,center,origin:m.origin,worldFile:[1/scale,0,0,-1/scale,m.origin[0]+center[0]-span/2+.5/scale,m.origin[1]+center[1]+span/2-.5/scale]};
img.onload=()=>{render();$('info').textContent=`41 个控制点 / 72 个分区三角形 / 无翻折\n请选择桥梁或长廊锚点，或点击地图；图像内配准不等于实地定位验收。`;window.READY=true;};img.src='artwork-original.jpg';
