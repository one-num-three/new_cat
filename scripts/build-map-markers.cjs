'use strict';
// Engineering resize only: original image-generation outputs and alpha are retained.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'design/2026-10-16/map-markers-v2');
const assets=path.join(root,'assets/map-markers-v2');
const sources={self:'exec-28256a64-80e1-4463-a141-d77c610438de.png',ally:'exec-39665263-8f3a-41b3-b7f5-1db750fbd789.png',venue:'exec-9625862e-9df8-4a11-8a8f-a4a48faf47f1.png'};
(async()=>{
 fs.mkdirSync(assets,{recursive:true});const entries=[];
 for(const [role,source] of Object.entries(sources)){
  const original=path.join(dir,role+'-original.png');
  if(!fs.existsSync(original))throw Error('Missing preserved generation: '+original);
  const runtime=path.join(assets,role+'.png');
  await sharp(original).resize(192,192,{fit:'inside',kernel:'nearest',withoutEnlargement:true}).png({compressionLevel:9}).toFile(runtime);
  const {data,info}=await sharp(runtime).raw().toBuffer({resolveWithObject:true});
  let transparent=0,opaque=0;for(let i=3;i<data.length;i+=info.channels){if(data[i]===0)transparent++;if(data[i]===255)opaque++;}
  if(info.channels!==4||!transparent||!opaque)throw Error('Not a real transparent sprite: '+role);
  entries.push({role,source,originalSha256:crypto.createHash('sha256').update(fs.readFileSync(original)).digest('hex'),runtime:'assets/map-markers-v2/'+role+'.png',runtimeSha256:crypto.createHash('sha256').update(fs.readFileSync(runtime)).digest('hex'),bytes:fs.statSync(runtime).size,width:info.width,height:info.height,transparentPixels:transparent,opaquePixels:opaque});
 }
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({version:'map-markers-v2',generator:'built-in image_gen',transparentBackground:true,processing:'192x192 nearest-neighbour lossless RGBA PNG; no repainting or background replacement',entries},null,2)+'\n');console.log(JSON.stringify(entries));
})().catch(e=>{console.error(e);process.exitCode=1;});
