'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{const sprites={};
 for(const kind of ['fastest','closest'])for(const edge of ['left','right']){
  const key=kind+'-edge-'+edge,source=path.join(__dirname,key+'-original.png'),before=hash(source),{data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let tipX=0,tipY=-1,x0=info.width,y0=info.height,x1=0,y1=0,clear=0;
  for(let y=0;y<info.height;y++){const row=[];for(let x=0;x<info.width;x++){const a=data[(y*info.width+x)*4+3];if(a===0)clear++;if(a>16){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}if(a>=240)row.push(x);}if(row.length>=Math.ceil(info.width*.005)){tipY=y;tipX=row[Math.floor(row.length/2)];}}
  if(clear<info.width*info.height*.25||tipY<0)throw Error('Missing transparency or tip');
  if(edge==='left'&&tipX/info.width>.4||edge==='right'&&tipX/info.width<.6)throw Error('Wrong tail orientation');
  const item={kind,edge,text:kind==='fastest'?'你在这里跑得最快':'你在这里离猫最近',source:key+'-original.png',sourceSha256:before,anchor:{u:tipX/info.width,v:tipY/info.height},visibleBounds:{left:x0/info.width,top:y0/info.height,right:(x1+1)/info.width,bottom:(y1+1)/info.height},transparentPixels:clear,files:[]};
  for(const width of [320,640]){const file=key+'-'+width+'.png',p=path.join(__dirname,file);await sharp(source).resize({width,kernel:'nearest'}).png({compressionLevel:9}).toFile(p);const m=await sharp(p).metadata();if(!m.hasAlpha)throw Error('Alpha lost');item.files.push({file,width:m.width,height:m.height,bytes:fs.statSync(p).size,sha256:hash(p)});}
  if(hash(source)!==before)throw Error('Source changed');sprites[key]=item;
 }
 fs.writeFileSync(path.join(__dirname,'manifest.json'),JSON.stringify({version:'track-bubbles-v1',date:'2026-10-21',tool:'built-in image_gen',textMirrored:false,sprites},null,2)+'\n');
 console.log('EXPORT_PASS bubbles=4 alpha=true sizes=320,640 tail_directions=PASS text_mirrored=false');
})().catch(e=>{console.error(e);process.exit(1);});
