'use strict';
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),crypto=require('node:crypto');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{const files=[],sprites={};for(const name of ['start','finish']){
 const source=path.join(__dirname,name+'-original.png');const before=hash(source);const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});let yFoot=-1,xFoot=0,clear=0;
 for(let y=0;y<info.height;y++){let xs=[];for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];if(a===0)clear++;if(a>=240)xs.push(x);}if(xs.length>=Math.ceil(info.width*.02)){yFoot=y;xFoot=xs[Math.floor(xs.length/2)];}}
 if(clear<info.width*info.height*.3||yFoot<0)throw Error('Missing alpha or pole foot');
 sprites[name]={source:name+'-original.png',anchor:{u:xFoot/info.width,v:yFoot/info.height},anchorMeaning:'bottom-center of pole foot, normalized to entire sprite canvas',sourceSha256:before,transparentPixels:clear};
 for(const size of [96,192]){const file=name+'-flag-'+size+'.png',p=path.join(__dirname,file);await sharp(source).resize(size,size,{fit:'contain',kernel:'nearest'}).png({compressionLevel:9}).toFile(p);const m=await sharp(p).metadata();if(!m.hasAlpha||m.width!==size||m.height!==size)throw Error('Bad sprite export');files.push({file,width:m.width,height:m.height,bytes:fs.statSync(p).size,sha256:hash(p)});}
 if(before!==hash(source))throw Error('Source changed');
 }
 await sharp(path.join(__dirname,'highlights-poster.png')).jpeg({quality:86,chromaSubsampling:'4:4:4'}).toFile(path.join(__dirname,'highlights-poster.jpg'));
 for(const file of ['highlights-poster.png','highlights-poster.jpg']){const p=path.join(__dirname,file),m=await sharp(p).metadata();files.push({file,width:m.width,height:m.height,bytes:fs.statSync(p).size,sha256:hash(p)});}
 const result={tool:'built-in image_gen',date:'2026-10-21',posterPositions:'illustrative, not actual user records',sprites,files};fs.writeFileSync(path.join(__dirname,'manifest.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exit(1);});
