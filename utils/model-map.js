'use strict';
const boundary=require('./venue-boundary');
const reference=require('./model-reference'),{gcjToWgs}=require('./osm-art-registration');
const ID='seu-jiulonghu-v1',RAD=Math.PI/180;
function inside(p){let yes=false;const a=reference.boundary;for(let i=0,j=a.length-1;i<a.length;j=i++){if((a[i][1]>p[1])!==(a[j][1]>p[1])&&p[0]<(a[j][0]-a[i][0])*(p[1]-a[i][1])/(a[j][1]-a[i][1])+a[i][0])yes=!yes;}return yes;}
function project(p,id=ID){if(id!==ID)return null;const w=gcjToWgs(p,'gcj02');if(!w)return null;const x=(w.lng-reference.origin[0])*111319.49079327358*Math.cos(reference.origin[1]*RAD),y=(w.lat-reference.origin[1])*111319.49079327358;
 const pixel=reference.coefficients.map(c=>c[0]*x+c[1]*y+c[2]);if(!inside(pixel))return null;
 return {x:(pixel[0]-reference.center[0])*reference.scale,y:1,z:(pixel[1]-reference.center[1])*reference.scale,fieldVerified:false};
}
function overlay(data,id){const points=(Array.isArray(data?.points)?data.points:[]).slice(0,61).filter(p=>['self','ally','venue','enemy'].includes(p.tone)).map((p,i)=>{const q=project(p,id);return q?{...q,id:i,tone:p.tone,label:String(p.label||'').slice(0,20)}:null;}).filter(Boolean),regions=[];let omittedRegions=0;
 for(const p of (Array.isArray(data?.regions)?data.regions:[]).slice(0,61)){if(!Number.isFinite(p.radiusM)||p.radiusM<=0||p.radiusM>500){omittedRegions++;continue;}const ring=[];for(let i=0;i<=64;i++){const a=i*Math.PI/32,r=p.radiusM*1.02+2,q=project({lat:p.lat+Math.sin(a)*r/111319.49,lng:p.lng+Math.cos(a)*r/(111319.49*Math.cos(p.lat*RAD))},id);if(!q){ring.length=0;break;}ring.push(q);}if(ring.length)regions.push(ring);else omittedRegions++;}
 const ring=boundary.sample(data?.boundary).map(p=>project(p,id));return {points,regions,omittedRegions,...(data?.boundary?.length?{boundary:ring.every(Boolean)?ring:[],omittedBoundary:ring.some(p=>!p)}:{})};
}
module.exports={available:id=>id===ID,project,overlay};
