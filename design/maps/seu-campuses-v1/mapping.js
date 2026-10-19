(function(root){
 'use strict';
 const R=6378137, rad=Math.PI/180;
 const merc=([lng,lat])=>[R*lng*rad,R*Math.log(Math.tan(Math.PI/4+lat*rad/2))];
 const unmerc=([x,y])=>[x/R/rad,(2*Math.atan(Math.exp(y/R))-Math.PI/2)/rad];
 function bary(p,t){
  const ax=t[0][0]-t[2][0],ay=t[0][1]-t[2][1],bx=t[1][0]-t[2][0],by=t[1][1]-t[2][1];
  const det=ax*by-ay*bx;if(Math.abs(det)<1e-10)return null;
  const x=p[0]-t[2][0],y=p[1]-t[2][1],a=(x*by-y*bx)/det,b=(ax*y-ay*x)/det;
  return [a,b,1-a-b];
 }
 function transfer(p,from,to,m){
  if(!m.enabled||!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))return null;
  for(let i=0;i<m.triangles.length;i++){
   const ids=m.triangles[i],b=bary(p,ids.map(j=>from[j]));
   if(b&&b.every(x=>x>=-1e-8&&x<=1+1e-8))return {point:[0,1].map(k=>ids.reduce((v,j,n)=>v+b[n]*to[j][k],0)),triangle:i};
  } return null;
 }
 function geoToPixel(lonlat,m,crs='WGS84'){
  if(crs!=='WGS84')throw Error('CRS_MISMATCH: expected WGS84; do not feed GCJ-02 directly');
  if(!Array.isArray(lonlat)||lonlat.length!==2||!lonlat.every(Number.isFinite)||Math.abs(lonlat[0])>180||Math.abs(lonlat[1])>=85)return null;
  if(!m.enabled)return null;
  const p=merc(lonlat).map((v,i)=>v-m.origin[i]),r=transfer(p,m.world,m.pixels,m);
  return r?{x:r.point[0],y:r.point[1],u:r.point[0]/m.image.width,v:r.point[1]/m.image.height,triangle:r.triangle,fieldVerified:false}:null;
 }
 function pixelToGeo(pixel,m){
  if(!m.enabled)return null;
  const r=transfer(pixel,m.pixels,m.world,m);if(!r)return null;
  const p=unmerc(r.point.map((v,i)=>v+m.origin[i]));return {lng:p[0],lat:p[1],crs:'WGS84',triangle:r.triangle,fieldVerified:false};
 }
 const api={merc,unmerc,bary,transfer,geoToPixel,pixelToGeo};
 if(typeof module!=='undefined')module.exports=api;else root.GeoMapping=api;
})(typeof window==='undefined'?globalThis:window);
