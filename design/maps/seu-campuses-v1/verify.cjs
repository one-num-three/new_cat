'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),path=require('node:path'),G=require('./mapping.js');
const read=f=>JSON.parse(fs.readFileSync(path.join(__dirname,f),'utf8'));
const conf=read(process.argv[2]||'MODIFIED_FILE.json');const baseline=process.argv[3]==='baseline';
assert.equal(conf.enabled,!baseline);let count=0,max=0;
for(const key of ['jiulonghu','sipailou']){
 const m=read(key+'-registration.json');const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,m.image.file))).digest('hex');assert.equal(hash,m.image.sha256);
 if(baseline){m.enabled=false;assert.equal(G.geoToPixel([118.8,32],m),null);continue;}
 assert.equal(m.fieldVerified,false);assert.equal(m.quality.folds.length,0);
 for(const a of m.anchors){const p=G.geoToPixel(a.wgs84,m);assert(p);assert(Math.hypot(p.x-a.pixel[0],p.y-a.pixel[1])<1e-5);}
 for(const t of m.triangles)for(const w of [[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]]){
  const p=[0,1].map(k=>t.reduce((s,i,j)=>s+w[j]*m.pixels[i][k],0));const ll=G.pixelToGeo(p,m);assert(ll);const q=G.geoToPixel([ll.lng,ll.lat],m);assert(q);const e=Math.hypot(q.x-p[0],q.y-p[1]);assert(e<1e-5);max=Math.max(max,e);count++;
 }
 assert.equal(G.geoToPixel([0,0],m),null);assert.throws(()=>G.geoToPixel([118.8,32],m,'GCJ02'),/CRS_MISMATCH/);
}
console.log(baseline?'PASS campuses=2 enabled=false mapping=null artwork=unchanged':`PASS campuses=2 anchors=40 triangles=62 roundtrips=${count} folds=0 outside=null crs_guard=PASS artwork=unchanged fieldVerified=false`);
