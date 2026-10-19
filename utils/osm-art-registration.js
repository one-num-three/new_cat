'use strict';
const model=require('./osm-art-model'),affine=require('./geo-registration');
const config=require('./venue-art-config');
const catalog=require('./venue-catalog'),campus=require('./campus-art-models');
const models={'xuanwu-v4':model,...campus};
const {wgs84togcj02}=require('./vendor/coordtransform');
const R=6378137,RAD=Math.PI/180;
const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<85&&Math.abs(p.lng)<=180;
// Iterative inverse of the approximate forward formula; convergence is a
// numerical property, not a statement of real-world GPS/map accuracy.
function gcjToWgs(p,crs){
 if(crs!=='gcj02'||!valid(p))return null;
 let lng=p.lng,lat=p.lat;
 for(let i=0;i<8;i++){const q=wgs84togcj02(lng,lat),dx=q[0]-p.lng,dy=q[1]-p.lat;lng-=dx;lat-=dy;if(Math.max(Math.abs(dx),Math.abs(dy))<1e-10)return {lng,lat};}
 return null;
}
const local=(p,m)=>[R*p.lng*RAD-m.origin[0],R*Math.log(Math.tan(Math.PI/4+p.lat*RAD/2))-m.origin[1]];
function bary(p,t){const a=t[0],b=t[1],c=t[2],det=(a[0]-c[0])*(b[1]-c[1])-(a[1]-c[1])*(b[0]-c[0]);if(Math.abs(det)<1e-10)return null;const x=p[0]-c[0],y=p[1]-c[1],u=(x*(b[1]-c[1])-y*(b[0]-c[0]))/det,v=((a[0]-c[0])*y-(a[1]-c[1])*x)/det;return [u,v,1-u-v];}
function transfer(p,ids,m){const b=bary(p,ids.map(i=>m.world[i]));return b?[0,1].map(k=>ids.reduce((sum,i,n)=>sum+b[n]*m.pixels[i][k],0)):null;}
function raw(p,m){for(const t of m.triangles){const b=bary(p,t.map(i=>m.world[i]));if(b&&b.every(x=>x>=-1e-8&&x<=1+1e-8))return transfer(p,t,m);}return null;}
function available(imageId=catalog.DEFAULT_ID){const m=models[imageId],image=catalog.get(imageId);return !!m&&!!image&&config.osmReferenceEnabled===true&&(imageId!==catalog.DEFAULT_ID||config.src===image.src)&&image.src==='/'+m.image.runtimePath&&m.enabled===true&&m.schema==='piecewise-affine-wgs84-art-v1'&&m.source.crs==='EPSG:4326'&&m.projection==='EPSG:3857'&&m.image.sha256===image.sha256&&m.image.width===image.width&&m.image.height===image.height;}
function project(p,crs,imageId=catalog.DEFAULT_ID){if(!available(imageId))return null;const m=models[imageId],q=gcjToWgs(p,crs);if(!q)return null;const r=raw(local(q,m),m);return r?{u:r[0]/m.image.width,v:r[1]/m.image.height,fieldVerified:false}:null;}
// Clip each triangle to a conservative Mercator box around the authorized
// region. Its mapped bounds enclose the whole uncertainty region even across
// triangle boundaries; never turn coarse enemy intelligence into a point pin.
function clip(poly,axis,bound,sign){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ia=sign*(a[axis]-bound)>=0,ib=sign*(b[axis]-bound)>=0;if(ia)out.push(a);if(ia!==ib){const t=(bound-a[axis])/(b[axis]-a[axis]);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}}return out;}
function region(p,width,height,imageId=catalog.DEFAULT_ID){
 if(!available(imageId)||!Number.isFinite(p?.radiusM)||p.radiusM<=0||p.radiusM>500)return null;
 const m=models[imageId],q=gcjToWgs(p,'gcj02');if(!q)return null;const c=local(q,m),r=p.radiusM/Math.cos(q.lat*RAD)*1.02+1;
 const corners=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,y])=>[c[0]+x*r,c[1]+y*r]);
 if(corners.some(p=>!raw(p,m)))return null; // Never truncate a clue at the hull.
 const pixels=[];
 for(const t of m.triangles){let poly=t.map(i=>m.world[i]);for(const [axis,bound,sign] of [[0,c[0]-r,1],[0,c[0]+r,-1],[1,c[1]-r,1],[1,c[1]+r,-1]])poly=clip(poly,axis,bound,sign);for(const p of poly)pixels.push(transfer(p,t,m));}
 if(!pixels.length)return null;
 const xs=pixels.map(p=>p[0]*width/m.image.width),ys=pixels.map(p=>p[1]*height/m.image.height),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
 return {x:(left+right)/2,y:(top+bottom)/2,rx:(right-left)/Math.SQRT2,ry:(bottom-top)/Math.SQRT2,angle:0};
}
function frame(data,width,height,imageId=catalog.DEFAULT_ID){
 const empty={points:[],regions:[],omittedRegions:0};if(!available(imageId)||!(width>0&&height>0)||!Number.isFinite(width)||!Number.isFinite(height))return empty;
 const points=(Array.isArray(data?.points)?data.points:[]).slice(0,61).map((p,i)=>{const q=project(p,'gcj02',imageId);return q?{id:i,x:q.u*width,y:q.v*height,label:String(p.label||'').slice(0,20),tone:['self','ally','venue'].includes(p.tone)?p.tone:'ally'}:null;}).filter(Boolean);
 const source=(Array.isArray(data?.regions)?data.regions:[]).slice(0,61),regions=source.map((p,i)=>{const q=region(p,width,height,imageId);return q?{id:i,...q}:null;}).filter(Boolean);
 return {points,regions,omittedRegions:source.length-regions.length};
}
// A present but invalid room model must fail closed, never silently fall back.
function overlay(data,registration,width,height,imageId=catalog.DEFAULT_ID){return registration?affine.frame(data,registration,width,height,imageId):frame(data,width,height,imageId);}
module.exports={project,frame,overlay,gcjToWgs,available,region};
