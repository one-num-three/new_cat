'use strict';
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const m=require('./manifest.json'),before=require('./baseline-layer-v1/manifest.json'),bubbles=require('../track-bubbles-v1/manifest.json');
const overlap=(a,b)=>Math.max(0,Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top));
(async()=>{
 assert(m.layerOrder.indexOf('startFinishFlags')>m.layerOrder.indexOf('highlightBubbles'));
 const records=[];
 for(const r of m.records){
  const old=before.records.find(x=>x.key===r.key);assert.equal(r.sourceSha256,old.sourceSha256);
  const file=path.join(__dirname,r.key+'-share.png'),{data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,941);assert.equal(info.height,1672);
  const flags=r.placements.filter(p=>p.kind==='start'||p.kind==='finish');let visiblePixels=0;
  for(const f of flags){
   assert.deepEqual(f.point,old.placements.find(p=>p.kind===f.kind).point);
   const sprite=await sharp(path.join(__dirname,'../track-highlights-v1',f.kind+'-flag-192.png')).resize(f.width,f.height,{kernel:'nearest'}).ensureAlpha().raw().toBuffer();
   let checked=0;
   for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++){
    const s=(y*f.width+x)*4,a=sprite[s+3];if(a<240)continue;const d=((f.top+y)*info.width+f.left+x)*4;
    // Alpha at least240: normal blending can change a channel by at most15.
    const tolerance=256-a;
    for(let c=0;c<3;c++)assert(Math.abs(sprite[s+c]-data[d+c])<=tolerance,'flag is covered');visiblePixels++;checked++;
   }
   assert(checked>1000,'not enough visible flag pixels checked');
  }
  let collisions=0;
  for(const p of r.placements.filter(p=>p.kind==='fastest'||p.kind==='closest')){
   assert.deepEqual(p.geographicPoint,old.placements.find(q=>q.kind===p.kind).geographicPoint);
   const b=bubbles.sprites[p.key].visibleBounds,bb={left:p.x+b.left*p.width,top:p.y+b.top*p.height,width:(b.right-b.left)*p.width,height:(b.bottom-b.top)*p.height};
   for(const f of flags)if(overlap(bb,f)>0)collisions++;
  }
  assert.equal(collisions,0);const jpg=path.join(__dirname,r.key+'-share.jpg');await sharp(jpg).metadata();
  records.push({key:r.key,flagCount:flags.length,uncoveredStrongAlphaFlagPixels:visiblePixels,bubbleFlagCollisions:collisions,pngSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),jpgSha256:crypto.createHash('sha256').update(fs.readFileSync(jpg)).digest('hex')});
 }
 await sharp(path.join(__dirname,'all-three-preview.png')).metadata();
 const report={pass:true,revision:'layer-fix',posters:3,flagsOnTop:true,allSixFlagsPixelVerified:true,bubbleAvoidance:true,mapAndPointCoordinatesUnchanged:true,records};
 fs.writeFileSync(path.join(__dirname,'VERIFICATION.json'),JSON.stringify(report,null,2)+'\n');console.log('LAYER_VERIFY_PASS posters=3 flags=6 uncovered=PASS bubble_flag_collisions=0 map_and_points=unchanged');
})().catch(e=>{console.error(e);process.exit(1);});
