'use strict';
// Packaging derivative only: preserve the entire v3 composition and pixel dimensions.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),source='design/maps/xuanwu-lake/huanzhou-yingzhou-v3/huanzhou-yingzhou-corridor.png';
const output='assets/maps/xuanwu-lake-v3.png',manifest='design/maps/xuanwu-lake/runtime-v1/manifest.json';
const expected='c3abcab8c59bdd55d3529d8457fb03c53a8f852f2529f1dd6515f5447f34b4a6';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const src=fs.readFileSync(path.join(root,source));if(hash(src)!==expected)throw Error('v3 source hash changed');
 if(!process.argv.includes('--verify')){
  fs.mkdirSync(path.dirname(path.join(root,output)),{recursive:true});fs.mkdirSync(path.dirname(path.join(root,manifest)),{recursive:true});
  const data=await sharp(src).png({palette:true,colours:256,dither:0}).toBuffer();
  fs.writeFileSync(path.join(root,output),data);
  fs.writeFileSync(path.join(root,manifest),JSON.stringify({version:'xuanwu-lake-v3-runtime-1',source,sourceSha256:expected,path:output,sha256:hash(data),width:1154,height:1363,bytes:data.length,transform:'PNG palette256; dither0; no crop/resize/rotation; colour quantization only',georeferenced:false,geographicOverlay:false,attribution:'© OpenStreetMap contributors · ODbL 1.0; AI artwork is not a surveyed map',sourceLicenseUrl:'https://www.openstreetmap.org/copyright',supersedesPreviewAssets:'assets/faithful-v2/park-stage-*.png; originals preserved',date:'2026-10-13'},null,2)+'\n');
  fs.writeFileSync(path.join(root,'assets/maps/ATTRIBUTION.txt'),'玄武湖 环洲/樱洲 · 美术场地导览 v3\n地图数据 © OpenStreetMap contributors · ODbL 1.0\nhttps://www.openstreetmap.org/copyright\n源图由用户提供的 image_gen 稿派生；未完成经纬度标定，不叠加实时玩家坐标。\nPNG运行版仅作256色编码优化；原图1154×1363和哈希保留在design/maps/xuanwu-lake。\n');
 }
 const m=JSON.parse(fs.readFileSync(path.join(root,manifest),'utf8')),b=fs.readFileSync(path.join(root,output)),meta=await sharp(b).metadata();
 if(hash(b)!==m.sha256 || meta.width!==1154 || meta.height!==1363 || m.georeferenced!==false || b.length>1100000)throw Error('runtime lock/dimension/budget mismatch');
 console.log(`XUANWU_ART_PASS source=unchanged dimensions=${meta.width}x${meta.height} bytes=${b.length} calibrated=false`);
})().catch(e=>{console.error(e);process.exitCode=1;});
