'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..'),catalog=require(path.join(root,'utils/venue-images'));
const labels={'xuanwu-v4':['xuanwu','玄武湖·环洲樱洲'],'seu-jiulonghu-v1':['jiulonghu','东大九龙湖校区'],'seu-sipailou-v1':['sipailou','东大四牌楼校区']};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
 const source=path.join(__dirname,'overlay-source.png'),{data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 if(info.width!==941||info.height!==1672)throw Error('Unexpected template dimensions');
 let transparent=0;for(let i=3;i<data.length;i+=4)if(data[i]===0)transparent++;
 if(transparent<700000)throw Error('Missing transparent map window');
 const mapRect={x:0,y:328,width:941,height:941},items=[];
 for(const image of catalog){
  const [key,label]=labels[image.id],mapFile=path.join(root,image.src.slice(1));if(hash(mapFile)!==image.sha256)throw Error('Map hash mismatch');
  const svg=Buffer.from('<svg width="941" height="1672" xmlns="http://www.w3.org/2000/svg"><text x="239" y="386" text-anchor="middle" font-family="Microsoft YaHei,sans-serif" font-size="24" font-weight="700" fill="#123b24">'+label+'</text></svg>');
  const overlay=key+'-overlay.png';await sharp(source).composite([{input:svg}]).png({compressionLevel:9}).toFile(path.join(__dirname,overlay));
  const map=await sharp(mapFile).resize(941,941,{kernel:'nearest'}).toBuffer();
  const preview=key+'-preview.png';await sharp({create:{width:941,height:1672,channels:4,background:'#fcf6d2'}}).composite([{input:map,left:mapRect.x,top:mapRect.y},{input:path.join(__dirname,overlay)}]).png({compressionLevel:9}).toFile(path.join(__dirname,preview));
  items.push({imageId:image.id,key,label,source:image.src,sourceSha256:image.sha256,sourceSize:[image.width,image.height],overlay,preview,mapRect,overlaySha256:hash(path.join(__dirname,overlay)),previewSha256:hash(path.join(__dirname,preview))});
 }
 const layout={schema:'trajectory-share-irregular-v4',date:'2026-10-21',width:941,height:1672,source:'overlay-source.png',sourceSha256:hash(source),transparentPixels:transparent,mapRect,metrics:{distance:{x:193,y:1373},duration:{x:480,y:1373},calories:{x:766,y:1373},fontSize:52,color:'#f47716',note:{x:470,y:1481,fontSize:17}},items};
 fs.writeFileSync(path.join(__dirname,'layout.json'),JSON.stringify(layout,null,2)+'\n');
 console.log('BUILD_PASS variants=3 alpha_window=true routes=empty stats=empty start_finish=absent original_maps=hash_locked');
})().catch(e=>{console.error(e);process.exit(1);});
