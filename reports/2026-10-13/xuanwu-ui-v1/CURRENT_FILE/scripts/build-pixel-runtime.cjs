'use strict';
// Deterministic packaging derivatives of the approved fifteen-state HTML replica.
// The source PNGs / HTML / CSS / JS are read-only. No artwork generation, stretching,
// background replacement or map extraction is performed here.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const sourceDir = 'design/2026-10-12/pixel-day-replica-v1';
const outputDir = 'assets/pixel-v1';
const manifestPath = 'design/2026-10-13/pixel-runtime-v1/manifest.json';
const targetBudget = 650000;
// The integration package retains the 1,045,507-byte new map. Its approved PNG
// envelope is 790,000 bytes after excluding superseded runtime assets at packaging.
const budget = 790000;
const base59Sha256 = '58fbcef3ee6471cc36f8c0fb9a3ef112644086e1e7fcdc8e9f4aec920c810fe7';
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => fs.readFileSync(path.join(root, p));
const locks = {
  'replica.js': 'cd3cd6fdf62d34017d8eb85cc01454fc8a8dcc59c9cb0c0ddcd1ada01f9fcc33',
  'replica.css': '25fb69f0ba4dec1edcc28cd6db50ef53555947ac23b7e9714233409285fecc4f',
  'sources.json': '1127bec8194a0a2a53c07198ae06819fda037fbd89cb8930d033aa7f7504e100',
  'index.html': 'cf77bcd05f8800d3b70adc6cca9d6ea7fdb30242f3ade07d595fe84b2ff82a50',
  'assets/ui-variable.woff': '11e128112254d25a1439408158c8a8aac7cda64ca07772705b2d1aa769463819',
  'assets/FONT-LICENSE.txt': 'e9d9b525d384aa7d1e39650ac03047621c5d79e3a88c698aa0c522bd5d87d493'
};
const pages = {
  '01-home': [130,108,764,1354], '02-create': [110,102,802,1368],
  '03-ready': [145,106,734,1354], '04-cat': [128,103,766,1353],
  '05-mouse': [166,108,690,1348], '06-alert': [164,96,696,1365],
  '07-hiding': [146,100,732,1364], '08-code': [128,108,768,1356],
  '09-captured': [135,107,752,1353], '10-paused': [139,101,746,1363],
  '11-offline': [128,110,768,1350], '12-cat-win': [135,105,751,1355],
  '13-mouse-win': [135,102,751,1366], '14-cancelled': [164,109,696,1352],
  '15-details': [143,103,738,1365]
};
const specs = [];
function art(id, source, crop, options = {}) {
  specs.push({id, source, crop, kind: 'illustration', maxWidth: 480, colours: 64, ...options});
}
function button(id, source, rect) {
  const [x,y,w,h] = rect, [px,py,pw,ph] = pages[source], pad = 8;
  const l = Math.min(pad,x-px), t = Math.min(pad,y-py);
  const r = Math.min(pad,px+pw-x-w), b = Math.min(pad,py+ph-y-h);
  if ([l,t,r,b].some(n => n < 0)) throw Error('Button outside replica screen: ' + id);
  specs.push({id:'button-'+id,source,kind:'button',rect,padding:{left:l,top:t,right:r,bottom:b},
    crop:[x-l,y-t,w+l+r,h+t+b],maxWidth:420,colours:64});
}
art('home-hero','01-home',[130,198,764,577]);
art('home-footer','01-home',[130,1340,764,122]);
art('create-hero','02-create',[110,177,802,201]);
art('ready-hero','03-ready',[145,190,734,265]);
art('code-role','08-code',[128,194,768,140]);
art('hiding-scene','07-hiding',[164,1084,458,222]);
art('offline-hero','11-offline',[128,449,768,194]);
art('catwin-hero','12-cat-win',[135,189,751,503]);
art('mousewin-hero','13-mouse-win',[135,181,751,443]);
art('cancelled-hero','14-cancelled',[164,189,696,674]);
// Stop above the source's "organizer paused" sign: pause reason remains live text.
art('paused-scene','10-paused',[158,509,709,497]);
art('logo','01-home',[172,121,65,64],{kind:'icon'});
art('role-cat','04-cat',[184,197,121,116],{kind:'icon'});
art('role-mouse','05-mouse',[200,207,130,110],{kind:'icon'});
art('rules-icon-clock','02-create',[231,1090,65,70],{kind:'icon'});
art('rules-icon-cat','02-create',[725,1090,77,72],{kind:'icon'});
art('rules-icon-capture','03-ready',[196,680,72,68],{kind:'icon'});
for(let i=0;i<8;i++) art('ready-avatar-'+i,'03-ready',[i<4?188:531,934+(i%4)*81,69,64],{kind:'avatar'});
button('home-join','01-home',[162,1078,700,129]);
button('home-create','01-home',[163,1220,700,102]);
button('create-minus','02-create',[326,466,66,66]);
button('create-plus','02-create',[634,464,67,67]);
button('create-submit','02-create',[135,1352,754,114]);
button('create-location','02-create',[151,882,293,92]);
button('ready-start','03-ready',[170,1253,684,99]);
button('ready-cancel','03-ready',[173,1362,676,84]);
button('ready-copy','03-ready',[761,528,64,70]);
button('cat-scan','04-cat',[150,1306,397,136]);
button('cat-details','04-cat',[559,1306,317,136]);
button('mouse-code','05-mouse',[184,1334,385,106]);
button('mouse-details','05-mouse',[577,1334,263,106]);
button('alert-code','06-alert',[184,1231,659,112]);
button('alert-details','06-alert',[184,1357,659,81]);
button('hiding-details','07-hiding',[174,1327,677,112]);
button('code-back','08-code',[164,1281,694,121]);
button('captured-details','09-captured',[157,1327,710,121]);
button('paused-resume','10-paused',[164,1206,696,123]);
button('paused-details','10-paused',[164,1349,696,100]);
button('offline-team','11-offline',[147,1332,356,116]);
button('offline-rules','11-offline',[522,1332,356,116]);
button('catwin-replay','12-cat-win',[179,1071,664,143]);
button('catwin-details','12-cat-win',[179,1230,664,123]);
button('catwin-home','12-cat-win',[269,1374,490,60]);
button('mousewin-replay','13-mouse-win',[181,1190,660,115]);
button('mousewin-details','13-mouse-win',[181,1323,660,82]);
button('mousewin-home','13-mouse-win',[302,1415,424,50]);
button('cancelled-replay','14-cancelled',[194,1057,638,143]);
button('cancelled-details','14-cancelled',[194,1223,638,113]);
button('cancelled-home','14-cancelled',[298,1360,427,70]);
button('drawer-close','15-details',[782,373,75,70]);
button('drawer-pause','15-details',[173,1263,678,99]);
button('drawer-leave','15-details',[173,1378,678,78]);
// Small details come from the same approved source rectangles, not substitute art.
// Only the code illustration is reduced to 240px width to fit the runtime package.
art('code-demo-art','08-code',[312,746,401,162],{maxWidth:240});
art('drawer-cat-avatar','15-details',[187,584,77,80],{kind:'avatar'});
art('drawer-mouse-avatar','15-details',[459,582,77,80],{kind:'avatar'});
art('drawer-title-icon','15-details',[177,379,65,77],{kind:'icon'});
art('drawer-event-icon','15-details',[177,890,45,45],{kind:'icon'});
art('drawer-rules-icon','15-details',[177,1072,44,44],{kind:'icon'});

async function checkSources() {
  const records = [];
  for(const [file,sha256] of Object.entries(locks)) {
    const p = sourceDir+'/'+file, b = read(p);
    if(hash(b)!==sha256) throw Error('Source lock mismatch: '+p);
    records.push({path:p,sha256,bytes:b.length});
  }
  const sources = JSON.parse(read(sourceDir+'/sources.json'));
  if(sources.length!==15) throw Error('Expected exactly fifteen source states');
  for(const source of sources) {
    const p=sourceDir+'/assets/'+source.page+'.png', b=read(p), m=await sharp(b).metadata();
    if(hash(b)!==source.sha256 || m.width!==source.width || m.height!==source.height || b.length!==source.bytes)
      throw Error('Source PNG lock mismatch: '+source.page);
    // The replica copy and the authoritative design file must both match the lock.
    const original = path.relative(root,source.absolutePath).replaceAll('\\','/');
    if(hash(read(original))!==source.sha256) throw Error('Original design PNG changed: '+original);
    records.push({path:p,original,sha256:source.sha256,bytes:b.length,width:m.width,height:m.height});
  }
  return records;
}
function paletteColours(buffer) {
  for(let offset=8;offset<buffer.length;) {
    const length=buffer.readUInt32BE(offset), type=buffer.toString('ascii',offset+4,offset+8);
    if(type==='PLTE') return length/3;
    offset+=length+12;
  }
  throw Error('Expected indexed PNG with an explicit PLTE chunk');
}
async function render(spec) {
  const [left,top,width,height] = spec.crop;
  const resized = await sharp(read(sourceDir+'/assets/'+spec.source+'.png'))
    .extract({left,top,width,height})
    .resize({width:Math.min(spec.maxWidth,width),withoutEnlargement:true,kernel:'lanczos3'})
    .png().toBuffer();
  // libvips rounds 32/64/128-colour requests to an 8-bit palette ceiling. Merely
  // declaring `colours:64` can therefore emit 256 entries. Search deterministically
  // for the highest quality meeting the *actual* PLTE cap, and record both values.
  let low=0, high=100, best=null;
  while(low<=high) {
    const paletteQuality=Math.floor((low+high)/2);
    const data=await sharp(resized).png({palette:true,colours:spec.colours,dither:0,
      quality:paletteQuality,compressionLevel:9,effort:10}).toBuffer();
    const actualColours=paletteColours(data);
    if(actualColours<=spec.colours) {best={data,paletteQuality,actualColours};low=paletteQuality+1;}
    else high=paletteQuality-1;
  }
  if(!best) throw Error('Could not satisfy the declared PLTE cap: '+spec.id);
  return best;
}
async function main() {
  sharp.cache(false); sharp.concurrency(1);
  const sources = await checkSources();
  if(process.argv.includes('--check-sources')) {
    console.log('PIXEL_SOURCE_PASS states=15 locks=21 originals=unchanged html=unchanged'); return;
  }
  const verify = process.argv.includes('--verify');
  const records = [];
  if(!verify) fs.mkdirSync(path.join(root,outputDir),{recursive:true});
  for(const spec of specs) {
    const file=outputDir+'/'+spec.id+'.png', encoded=await render(spec), b=encoded.data;
    if(verify) {
      if(!read(file).equals(b)) throw Error('Runtime output differs from deterministic crop: '+file);
    } else if(!fs.existsSync(path.join(root,file)) || !read(file).equals(b)) {
      fs.writeFileSync(path.join(root,file),b);
    }
    // Re-open every emitted runtime file rather than relying on encoder output alone.
    const disk=read(file), m=await sharp(disk).metadata();
    const expectedWidth=Math.min(spec.maxWidth,spec.crop[2]);
    if(m.width!==expectedWidth || Math.abs(m.height-spec.crop[3]*m.width/spec.crop[2])>.51)
      throw Error('Aspect-ratio/dimensions changed: '+file);
    records.push({...spec,path:file,source:sourceDir+'/assets/'+spec.source+'.png',
      sourceSha256:sources.find(s=>s.path.endsWith('/'+spec.source+'.png')).sha256,
      width:m.width,height:m.height,dimensions:{width:m.width,height:m.height},
      aspectRatio:spec.crop[2]/spec.crop[3],bytes:disk.length,sha256:hash(disk),
      actualColours:paletteColours(disk),paletteQuality:encoded.paletteQuality,
      transform:'exact integer crop; width-only Lanczos3 resize; PNG actual PLTE<=64; dither0; no artistic edit'});
  }
  const baseRecords=records.slice(0,59);
  const actualBase59Sha256=hash(Buffer.from(baseRecords.map(r=>r.id+':'+r.sha256).join('\n')));
  if(actualBase59Sha256!==base59Sha256) throw Error('The original 59 runtime PNGs changed');
  const files=[];
  for(const name of ['ui-variable.woff','FONT-LICENSE.txt']) {
    const source=sourceDir+'/assets/'+name, file=outputDir+'/'+name, data=read(source);
    if(verify) {if(!read(file).equals(data)) throw Error('Font/license differs: '+file);}
    else if(!fs.existsSync(path.join(root,file)) || !read(file).equals(data)) fs.writeFileSync(path.join(root,file),data);
    const disk=read(file);files.push({path:file,source,bytes:disk.length,sha256:hash(disk),transform:'verbatim copy'});
  }
  const pngBytes=records.reduce((n,r)=>n+r.bytes,0);
  const manifest={version:'pixel-runtime-v1',date:'2026-10-13',sourceDir,outputDir,
    renderer:{sharp:sharp.versions.sharp,vips:sharp.versions.vips},
    rules:{originalsUnchanged:true,htmlUnchanged:true,widthOnlyResize:true,mapsExtracted:false,
      buttons:'replica.js textButton original rectangle plus sourceButton pad8, bounded by its PAGES rectangle',
      pausedScene:'[158,509,709,497] excludes timer/capture HUD and organizer-specific pause-reason sign',
      base59Sha256,
      supplementalArt:'6 exact source crops; code-demo-art width-only resized to240; five drawer icons/avatars retain original dimensions',
      font:'Variable WOFF retained verbatim with original OFL license; root WXSS can embed the same bytes'},
    budget:{pngBytes,supplementalPngBytes:records.slice(59).reduce((n,r)=>n+r.bytes,0),
      pngTargetBytes:targetBudget,pngWithinTarget:pngBytes<=targetBudget,
      pngLimitBytes:budget,pngWithinBudget:pngBytes<=budget,fontBytes:files[0].bytes,
      fontBase64Bytes:4*Math.ceil(files[0].bytes/3),licenseBytes:files[1].bytes,
      runtimeAssetBytes:pngBytes+files.reduce((n,r)=>n+r.bytes,0)},sources,records,files};
  const content=JSON.stringify(manifest,null,2)+'\n';
  if(verify) {
    if(read(manifestPath).toString('utf8')!==content) throw Error('Manifest differs from verified runtime records');
  } else {
    fs.mkdirSync(path.dirname(path.join(root,manifestPath)),{recursive:true});
    fs.writeFileSync(path.join(root,manifestPath),content);
  }
  JSON.parse(read(manifestPath));
  await checkSources();
  console.log(`PIXEL_RUNTIME_${verify?'VERIFY':'BUILD'}_PASS pngs=${records.length} pngBytes=${pngBytes} pngTarget=${targetBudget} withinTarget=${pngBytes<=targetBudget} pngBudget=${budget} withinBudget=${pngBytes<=budget} paletteMax=${Math.max(...records.map(r=>r.actualColours))} fontBytes=${files[0].bytes} originals=unchanged html=unchanged`);
  if(pngBytes>budget) process.exitCode=2;
}
main().catch(e=>{console.error(e.stack||e.message);process.exitCode=1;});
