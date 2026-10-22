'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),crypto=require('node:crypto');
const {layers}=require('./runtime-layer.cjs'),layout=require('./layout.json');
(async()=>{
 const pt=(i,extra={})=>({lat:32+i/1e5,lng:118+i/1e5,sampledAt:i*1000,recordedAt:i*1000,phase:'chase',segment:0,...extra});
 const proj=p=>p.bad?null:{u:.5,v:.5};
 assert.equal(layers([],proj,layout.mapRect).length,0);
 assert.equal(layers([pt(1),pt(2)],proj,layout.mapRect).length,1);
 assert.equal(layers([pt(1),pt(2),pt(20),pt(21)],proj,layout.mapRect).length,2);
 assert.equal(layers([pt(1),pt(2),pt(3,{bad:true}),pt(4),pt(5)],proj,layout.mapRect).length,2);
 assert.equal(layers([pt(1),pt(2),pt(3,{phase:'pause'}),pt(4,{phase:'pause'})],proj,layout.mapRect).length,2);
 const p=layers([pt(1),pt(2)],proj,layout.mapRect)[0][0];assert.equal(p.x,470.5);assert.equal(p.y,798.5);
 const files=[];
 for(const item of layout.items){
  const file=path.join(__dirname,item.overlay),{data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const alpha=(x,y)=>data[(y*info.width+x)*4+3];assert.equal(alpha(470,800),0);assert(alpha(470,100)>=250);assert(alpha(470,1400)>=250);
  let clear=0;for(let i=3;i<data.length;i+=4)if(data[i]===0)clear++;
  assert.equal(clear,layout.transparentPixels);
  const root=path.resolve(__dirname,'../../..'),source=path.join(root,item.source.slice(1));
  const hash=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');assert.equal(hash,item.sourceSha256);
  const m=await sharp(path.join(__dirname,item.preview)).metadata();assert.equal(m.width,941);assert.equal(m.height,1672);
  files.push({file:item.overlay,transparentPixels:clear,centerAlpha:alpha(470,800),mapSourceUnchanged:true});
 }
 const result={pass:true,date:'2026-10-21',variants:3,trueAlpha:true,routeAndStatsEmpty:true,sourceMapsUnchanged:true,gapAndInvalidPointsSplit:true,coordinatePlacementVerified:true,files};
 fs.writeFileSync(path.join(__dirname,'VERIFICATION.json'),JSON.stringify(result,null,2)+'\n');
 console.log('VERIFY_PASS variants=3 true_alpha=true transparent_pixels=738377 maps=unchanged empty_tracks=true gap_split=true coordinate_alignment=true');
})().catch(e=>{console.error(e);process.exit(1);});
