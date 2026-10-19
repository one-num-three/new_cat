// Build mobile-size derivatives only; original AI art and visual-1.0 stay untouched.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..'),src=path.join(root,'design/2026-10-12/runtime-art/source'),out=path.join(root,'assets/replica-v1');
const sizes={'home-landscape-v2':750,'compact-landscape':750,'preview-park':600,hiding:420,paused:420,cancelled:420,'cat-win-scene':420,'mouse-win-scene':420,'captured-scene':420};
(async()=>{const sourceLock=path.join(root,'design/2026-10-12/runtime-art/source-lock.json');if(fs.existsSync(sourceLock)){for(const r of JSON.parse(fs.readFileSync(sourceLock)).records){const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,r.path))).digest('hex');if(hash!==r.sha256)throw Error('Source art changed: '+r.path);}}const records=[];fs.mkdirSync(out,{recursive:true});for(const [id,width]of Object.entries(sizes)){
 const source=path.join(src,id+'.png'),target=path.join(out,(id==='home-landscape-v2'?'home-landscape':id)+'.png');
 await sharp(source).resize({width}).png({palette:true,colours:192,dither:.3}).toFile(target);
 const info=await sharp(target).metadata(),hash=crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
 records.push({id,source:path.relative(root,source).replaceAll('\\','/'),path:path.relative(root,target).replaceAll('\\','/'),sha256:hash,width:info.width,height:info.height,hasAlpha:info.hasAlpha,bytes:fs.statSync(target).size});
}fs.writeFileSync(path.join(root,'design/2026-10-12/runtime-art/runtime-lock.json'),JSON.stringify({version:'02-01-replica-1',transform:'resize; PNG palette192/dither0.3; no artistic editing',records},null,2));console.log('REPLICA_ART_BUILD='+records.length+' bytes='+records.reduce((n,r)=>n+r.bytes,0));})().catch(e=>{console.error(e);process.exitCode=1;});
