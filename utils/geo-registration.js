// Canonical geographic registration math. Server distribution is byte-identical.
const images=require('./venue-images.js');
const IMAGE=images.find(x=>x.id==='xuanwu-v4');
const imageFor=id=>images.find(x=>x.id===id)||null;
const DEG=Math.PI/180,R=6371000;
function fail(code){throw Error(code);}
function valid(p){return p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<85&&Math.abs(p.lng)<=180;}
function world(p,o){return {x:(p.lng-o.lng)*DEG*R*Math.cos(o.lat*DEG),y:(p.lat-o.lat)*DEG*R};}
function unworld(p,o){return {lat:o.lat+p.y/(DEG*R),lng:o.lng+p.x/(DEG*R*Math.cos(o.lat*DEG))};}
const cross=(a,b,c)=>(b.u-a.u)*(c.v-a.v)-(b.v-a.v)*(c.u-a.u);
function hull(points){const ps=points.map(p=>({u:p.u,v:p.v})).sort((a,b)=>a.u-b.u||a.v-b.v),lo=[],hi=[];for(const p of ps){while(lo.length>1&&cross(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}for(const p of [...ps].reverse()){while(hi.length>1&&cross(hi[hi.length-2],hi[hi.length-1],p)<=0)hi.pop();hi.push(p);}return lo.slice(0,-1).concat(hi.slice(0,-1));}
function inside(p,h){return h.length>=3&&h.every((a,i)=>cross(a,h[(i+1)%h.length],p)>=-1e-8);}
function solve(matrix,rhs){const m=matrix.map((row,i)=>[...row,rhs[i]]);for(let i=0;i<3;i++){let k=i;for(let j=i+1;j<3;j++)if(Math.abs(m[j][i])>Math.abs(m[k][i]))k=j;[m[k],m[i]]=[m[i],m[k]];if(Math.abs(m[i][i])<1e-9)fail('CALIBRATION_DEGENERATE');const d=m[i][i];for(let j=i;j<4;j++)m[i][j]/=d;for(let k2=0;k2<3;k2++)if(k2!==i){const f=m[k2][i];for(let j=i;j<4;j++)m[k2][j]-=f*m[i][j];}}return m.map(row=>row[3]);}
function rawProject(p,model){const w=world(p,model.origin),[a,b,c]=model.east,[d,e,f]=model.north,det=a*e-b*d;if(Math.abs(det)<1e-6)return null;return {u:(e*(w.x-c)-b*(w.y-f))/det,v:(a*(w.y-f)-d*(w.x-c))/det};}
function pixelToGeo(p,m){if(!m||!Number.isFinite(p.u)||!Number.isFinite(p.v))return null;return unworld({x:m.east[0]*p.u+m.east[1]*p.v+m.east[2],y:m.north[0]*p.u+m.north[1]*p.v+m.north[2]},m.origin);}
function compile(input){
 const image=imageFor(input?.imageId);
 if(!image||input.imageSha256!==image.sha256||input.crs!=='gcj02')fail('CALIBRATION_IMAGE_OR_CRS');
 const ps=input.points;if(!Array.isArray(ps)||ps.length<5||ps.length>16)fail('CALIBRATION_POINTS');
 if(ps.some(p=>!valid(p)||!Number.isFinite(p.u)||!Number.isFinite(p.v)||p.u<0||p.u>1||p.v<0||p.v>1||!['control','check'].includes(p.kind)))fail('CALIBRATION_POINTS');
 const controls=ps.filter(p=>p.kind==='control'),checks=ps.filter(p=>p.kind==='check');if(controls.length<3||checks.length<2)fail('CALIBRATION_CHECKS_REQUIRED');
 const origin={lat:controls[0].lat,lng:controls[0].lng},h=hull(controls);
 let area=0;for(let i=0;i<h.length;i++)area+=h[i].u*h[(i+1)%h.length].v-h[(i+1)%h.length].u*h[i].v;
 if(Math.abs(area)/2<.04)fail('CALIBRATION_DEGENERATE');
 for(let i=0;i<ps.length;i++){const a=world(ps[i],origin);if(Math.hypot(a.x,a.y)>3000)fail('CALIBRATION_SPREAD');for(let j=0;j<i;j++){const b=world(ps[j],origin);if(Math.hypot(a.x-b.x,a.y-b.y)<10||Math.hypot(ps[i].u-ps[j].u,ps[i].v-ps[j].v)<.015)fail('CALIBRATION_DUPLICATE');}}
 const mat=Array.from({length:3},()=>[0,0,0]),bx=[0,0,0],by=[0,0,0];for(const p of controls){const q=[p.u,p.v,1],w=world(p,origin);for(let i=0;i<3;i++){bx[i]+=q[i]*w.x;by[i]+=q[i]*w.y;for(let j=0;j<3;j++)mat[i][j]+=q[i]*q[j];}}
 const model={schema:'affine-gcj02-v1',imageId:image.id,imageSha256:image.sha256,crs:'gcj02',origin,east:solve(mat,bx),north:solve(mat,by),hull:h,status:'registered',fieldVerified:false};
 const error=p=>{const q=pixelToGeo(p,model),a=world(p,origin),b=world(q,origin);return Math.hypot(a.x-b.x,a.y-b.y);};
 const training=controls.map(error),independent=checks.map(error);if(checks.some(p=>!inside(p,h)))fail('CALIBRATION_CHECK_OUTSIDE');
 if(Math.max(...training)>5||Math.max(...independent)>10)fail('CALIBRATION_ERROR');
 const sx=Math.hypot(model.east[0],model.north[0]),sy=Math.hypot(model.east[1],model.north[1]);
 if(sx<50||sy<50||!rawProject(origin,model))fail('CALIBRATION_DEGENERATE');
 model.quality={controlCount:controls.length,checkCount:checks.length,maxErrorM:Math.max(...independent),rmsM:Math.sqrt(independent.reduce((s,x)=>s+x*x,0)/independent.length),trainingMaxM:Math.max(...training)};
 model.points=ps.map(p=>({u:p.u,v:p.v,lat:p.lat,lng:p.lng,kind:p.kind}));return model;
}
function project(p,m,imageId=IMAGE.id){const image=imageFor(imageId);if(!image||m?.imageId!==image.id||!valid(p)||!m||m.schema!=='affine-gcj02-v1'||!valid(m.origin)||!Array.isArray(m.east)||!Array.isArray(m.north)||m.east.length!==3||m.north.length!==3||![...m.east,...m.north].every(Number.isFinite)||!Array.isArray(m.hull)||m.hull.length<3||m.hull.some(p=>!p||!Number.isFinite(p.u)||!Number.isFinite(p.v))||m.status!=='registered'||m.imageSha256!==image.sha256||m.crs!=='gcj02')return null;const q=rawProject(p,m);if(!q||!Number.isFinite(q.u)||!Number.isFinite(q.v)||q.u<0||q.u>1||q.v<0||q.v>1||!inside(q,m.hull))return null;return q;}
function ellipse(p,radius,m,width,height,imageId=IMAGE.id){const q=project(p,m,imageId);if(!q||!Number.isFinite(radius)||radius<=0||radius>500)return null;const [a,b]=m.east,[d,e]=m.north,det=a*e-b*d;const x=[width*e/det,-width*b/det],y=[-height*d/det,height*a/det],aa=x[0]**2+x[1]**2,bb=x[0]*y[0]+x[1]*y[1],cc=y[0]**2+y[1]**2,disc=Math.hypot(aa-cc,2*bb);return {x:q.u*width,y:q.v*height,rx:radius*Math.sqrt(Math.max(0,(aa+cc+disc)/2)),ry:radius*Math.sqrt(Math.max(0,(aa+cc-disc)/2)),angle:Math.atan2(2*bb,aa-cc)*90/Math.PI};}
function frame(data,m,width,height,imageId=IMAGE.id){if(!m||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return {points:[],regions:[]};const points=(Array.isArray(data?.points)?data.points:[]).slice(0,61).map((p,i)=>{const q=project(p,m,imageId);return q?{id:i,x:q.u*width,y:q.v*height,label:String(p.label||'').slice(0,20),tone:['self','ally','venue'].includes(p.tone)?p.tone:'ally'}:null;}).filter(Boolean);const regions=(Array.isArray(data?.regions)?data.regions:[]).slice(0,61).map((p,i)=>{const q=ellipse(p,p?.radiusM,m,width,height,imageId);return q?{id:i,...q}:null;}).filter(Boolean);return {points,regions};}
module.exports={IMAGE,compile,project,pixelToGeo,ellipse,frame,world};
