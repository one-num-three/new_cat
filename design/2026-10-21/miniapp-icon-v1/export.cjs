'use strict';
const sharp=require('sharp'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
(async()=>{
 const source=path.join(__dirname,'source-original.png');
 const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 const before=hash(source),files=[];
 for(const size of [144,512]){
  const name='cat-mouse-icon-'+size+'.png',p=path.join(__dirname,name);
  await sharp(source).resize(size,size,{fit:'contain',kernel:'nearest'}).flatten({background:'#fff3bf'}).png({compressionLevel:9}).toFile(p);
  const m=await sharp(p).metadata();if(m.format!=='png'||m.width!==size||m.height!==size||fs.statSync(p).size>=2000000)throw Error('Export failed');
  files.push({file:name,width:m.width,height:m.height,format:m.format,bytes:fs.statSync(p).size,sha256:hash(p)});
 }
 if(before!==hash(source))throw Error('Source changed');
 const result={tool:'built-in image_gen',date:'2026-10-21',sourceSha256:before,sourceUnchanged:true,export:'nearest-neighbor size conversion, opaque PNG',files};
 fs.writeFileSync(path.join(__dirname,'VERIFICATION.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exit(1);});
