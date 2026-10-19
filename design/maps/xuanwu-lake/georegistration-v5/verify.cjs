'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const G=require('./mapping.js');const root=__dirname;
const file=process.argv[2]||'MODIFIED_FILE.json',expected=process.argv[3]||'registered';
const m=JSON.parse(fs.readFileSync(path.resolve(root,file),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(hash(path.join(root,m.image.file)),m.image.sha256);
assert.equal(hash(path.resolve(root,'../../../../assets/maps/xuanwu-lake-v4.jpg')),m.image.sha256);
if(expected==='baseline'){
 assert.equal(m.enabled,false);assert.equal(m.status,'unregistered');assert.equal(G.geoToPixel([118.788,32.074],m),null);
 console.log('PASS enabled=false mapping=null image=unchanged');process.exit(0);
}
assert.equal(m.enabled,true);assert.equal(m.fieldVerified,false);assert.equal(m.extrapolation,false);
assert.equal(m.quality.foldedTriangles.length,0);assert.equal(m.anchors.length,41);
let maxError=0,maxRoundtrip=0;
for(const a of m.anchors){
 const p=G.geoToPixel(a.wgs84,m);assert(p);const error=Math.hypot(p.x-a.pixel[0],p.y-a.pixel[1]);maxError=Math.max(error,maxError);assert(error<1e-6);
 const ll=G.pixelToGeo(a.pixel,m);assert(ll);assert(Math.hypot(ll.lng-a.wgs84[0],ll.lat-a.wgs84[1])<1e-8);
}
let samples=0;
for(const t of m.triangles){
 for(const weights of [[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]]){
  const p=[0,1].map(k=>t.reduce((s,i,j)=>s+weights[j]*m.pixels[i][k],0));
  const ll=G.pixelToGeo(p,m);assert(ll);const q=G.geoToPixel([ll.lng,ll.lat],m);assert(q);const e=Math.hypot(q.x-p[0],q.y-p[1]);maxRoundtrip=Math.max(maxRoundtrip,e);assert(e<1e-5);samples++;
 }
}
// Test geometric injectivity: no nonadjacent mesh edges may cross in image space.
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const edges=[...new Set(m.triangles.flatMap(t=>[[t[0],t[1]],[t[1],t[2]],[t[2],t[0]]].map(x=>x.sort((a,b)=>a-b).join(','))))].map(s=>s.split(',').map(Number));
for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length;j++){
 const [a,b]=edges[i],[c,d]=edges[j];if(new Set([a,b,c,d]).size<4)continue;
 const [p,q,r,s]=[a,b,c,d].map(k=>m.pixels[k]);assert(!(cross(p,q,r)*cross(p,q,s)<-1e-8&&cross(r,s,p)*cross(r,s,q)<-1e-8),'overlapping mesh edges');
}
assert.equal(G.geoToPixel([0,0],m),null);assert.equal(G.pixelToGeo([0,0],m),null);assert.equal(G.pixelToGeo([NaN,0],m),null);
assert.throws(()=>G.geoToPixel([118.788,32.074],m,'GCJ02'),/CRS_MISMATCH/);
assert.equal(hash(path.resolve(root,m.source.file)),m.source.sha256);
console.log(`PASS anchors=${m.anchors.length} triangles=${m.triangles.length} folds=0 crossings=0 roundtrips=${samples} outside=null crs_guard=PASS image=unchanged fieldVerified=false`);
if(process.argv.includes('--report'))fs.writeFileSync(path.join(root,'test-results.json'),JSON.stringify({pass:true,anchors:m.anchors.length,triangles:m.triangles.length,roundtrips:samples,maxControlResidualPixels:maxError,maxRoundtripPixels:maxRoundtrip,imageHash:m.image.sha256,fieldVerified:false},null,2)+'\n');
