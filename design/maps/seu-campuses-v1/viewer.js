'use strict';
const $=x=>document.getElementById(x),G=window.GeoMapping,S=1254;
let m,key,selection=null,artImage,guideImage,config;
function loadImage(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=src;});}
function gp(ll){const w=G.merc(ll);return [(w[0]-m.guide.center[0])/m.guide.span*S+S/2,(m.guide.center[1]-w[1])/m.guide.span*S+S/2];}
function render(){
 for(const id of ['art','real']){
  const c=$(id).getContext('2d');c.clearRect(0,0,S,S);c.drawImage(id==='art'?artImage:guideImage,0,0,S,S);
  if(m.enabled&&$('mesh').checked)for(const t of m.triangles){c.beginPath();t.map(i=>id==='art'?m.pixels[i]:gp(m.anchors[i].wgs84)).forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.strokeStyle='#e5488490';c.lineWidth=1;c.stroke();}
  if(m.enabled&&$('anchors').checked)for(const a of m.anchors){const p=id==='art'?a.pixel:gp(a.wgs84);c.beginPath();c.arc(...p,5,0,Math.PI*2);c.fillStyle='#fff';c.fill();c.strokeStyle='#27513b';c.lineWidth=2;c.stroke();c.font='bold 14px sans-serif';c.strokeStyle='white';c.lineWidth=4;c.strokeText(a.id,p[0]+7,p[1]-6);c.fillStyle='#284a35';c.fillText(a.id,p[0]+7,p[1]-6);}
  if(selection){const p=id==='art'?selection.pixel:gp(selection.ll);c.beginPath();c.arc(...p,14,0,Math.PI*2);c.strokeStyle='#ed1847';c.lineWidth=4;c.stroke();}
 }
}
function pick(pixel,ll,name){selection={pixel,ll};$('info').textContent=`${name||'点选位置'}\nWGS84：${ll.map(v=>v.toFixed(7)).join(', ')}\n原图像素：${pixel.map(v=>v.toFixed(2)).join(', ')}\n状态：图像配准完成 / 实地待验`;render();}
async function change(){window.READY=false;key=$('campus').value;selection=null;m=await fetch(key+'-registration.json').then(r=>r.json());m.enabled=!!config.enabled;[artImage,guideImage]=await Promise.all([loadImage(key+'-art.png'),loadImage(key+'-geometry.png')]);$('pick').innerHTML='<option value="">选择地标</option>';m.anchors.forEach((a,i)=>{const o=document.createElement('option');o.value=i;o.textContent=a.id+' '+a.name;$('pick').append(o);});$('info').textContent=m.enabled?`${key==='jiulonghu'?'九龙湖':'四牌楼'}：20 个控制点 / 31 个三角分区。请选择地标或点击地图。`:'UNREGISTERED / enabled=false / mapping=null';render();window.READY=true;window.currentModel=m;}
$('campus').onchange=change;for(const id of ['anchors','mesh'])$(id).onchange=render;$('reset').onclick=()=>{selection=null;render();};$('pick').onchange=()=>{if(!m.enabled||$('pick').value==='')return;const a=m.anchors[+$('pick').value];pick(a.pixel,a.wgs84,a.name);};
for(const id of ['art','real'])$(id).onclick=e=>{
 if(!m.enabled)return;const b=$(id).getBoundingClientRect(),p=[(e.clientX-b.left)*S/b.width,(e.clientY-b.top)*S/b.height];let ll,pixel;
 if(id==='art'){const r=G.pixelToGeo(p,m);if(r){ll=[r.lng,r.lat];pixel=p;}}
 else{ll=G.unmerc([m.guide.center[0]+(p[0]-S/2)/S*m.guide.span,m.guide.center[1]-(p[1]-S/2)/S*m.guide.span]);const r=G.geoToPixel(ll,m);if(r)pixel=[r.x,r.y];}
 if(pixel)pick(pixel,ll);else $('info').textContent='此点在已确认控制点范围以外，返回 null；不推测真实位置。';
};
const requested=new URLSearchParams(location.search).get('config');const conf=['baseline.json','rollback-test.json'].includes(requested)?requested:'MODIFIED_FILE.json';
fetch(conf).then(r=>r.json()).then(c=>{config=c;return change();}).catch(e=>$('info').textContent='请按 README 启动本地服务。'+e.message);
