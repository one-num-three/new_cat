// Deterministic crops of approved page art. No generated or repainted art.
// Build: node scripts/build-faithful-art.cjs
// Verify without writes: node scripts/build-faithful-art.cjs --verify
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const ROOT = path.resolve(__dirname, '..');
const SOURCE = 'design/2026-10-11/page-concepts-v1';
const DESIGN = 'design/2026-10-12/faithful-art';
const OUTPUT = 'assets/faithful-v2';
const MANIFEST = path.join(ROOT, DESIGN, 'manifest.json');
const digest = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const relative = p => path.relative(ROOT, p).replaceAll('\\', '/');
const screens = JSON.parse(fs.readFileSync(path.join(ROOT, SOURCE, 'screens.json'), 'utf8')).screens;
const selected = new Map(screens.map(s => [s.file, s]));
const creamProtections = {
  hiding: [[[181,1223],[217,1191],[265,1190],[292,1164],[324,1167],[358,1190],[397,1201],[428,1230],[433,1274],[415,1307],[354,1310],[297,1300],[256,1284],[213,1290],[185,1270]]],
  paused: [[[177,1164],[211,1127],[269,1110],[304,1136],[346,1141],[372,1165],[386,1192],[380,1215],[348,1225],[298,1224],[266,1213],[226,1220],[184,1208]]],
  catWin: [[[476,1149],[493,1096],[526,1095],[548,1053],[580,1060],[613,1081],[649,1091],[684,1085],[698,1119],[667,1151],[650,1180],[618,1225],[579,1220],[542,1196],[507,1203],[475,1185]], [[794,1018],[831,1016],[848,1031],[848,1075],[798,1075],[787,1061]]],
  mouseWin: [[[407,1041],[425,1004],[466,990],[497,962],[526,964],[552,997],[583,1001],[616,1022],[633,1061],[620,1093],[589,1106],[551,1108],[511,1091],[476,1084],[441,1090],[410,1075]]],
  cancelled: [[[186,1154],[223,1124],[274,1104],[299,1126],[338,1133],[366,1154],[391,1198],[389,1218],[360,1228],[308,1226],[266,1217],[232,1220],[195,1208]]],
};
const specs = [
  { id:'hero-home', file:'01-home.png', box:[156,380,712,396], kind:'hero', key:'sky', width:712, clearRects:[[156,380,420,40]], reason:'Extend the original running-scene crop upward by40 source pixels to preserve right-side bushes above y420 and remove the left subtitle in alpha; original bottom y776 is unchanged. Remove only edge-connected original blue sky in alpha so native sky underlays do not expose a rectangular gradient seam in large-text layouts; all original foreground RGB is retained.' },
  { id:'hero-create', file:'02-create.png', box:[156,180,712,340], kind:'hero', width:712 },
  { id:'hero-ready', file:'03-ready.png', box:[156,162,712,258], kind:'hero', width:712, clearRects:[[684,162,174,16],[156,386,529,34]] },
  { id:'hero-code', file:'08-code.png', box:[156,178,712,288], kind:'hero', width:712 },
  { id:'hero-gallery', file:'15-dev.png', box:[156,157,712,279], kind:'hero', width:712, clearRects:[[685,157,173,21]] },
  { id:'create-cloud', file:'02-create.png', box:[156,130,223,103], kind:'element', key:'cloud-white', width:223, reason:'Restore the complete visible original upper-left cloud that hero-create clips at y180; remove original sky and the green tree occlusion in alpha only.' },
  { id:'ready-cloud', file:'03-ready.png', box:[218,107,186,61], kind:'element', key:'cloud-white', width:186, reason:'Restore the complete original upper-left cloud that hero-ready clips at y162; no status-bar or navigation text is inside this crop.' },
  { id:'gallery-cloud', file:'15-dev.png', box:[156,120,154,60], kind:'element', key:'gallery-sky', width:154, clearRects:[[156,120,1,60]], reason:'Separate the complete visible original upper-left cloud; hero-gallery begins at y157 and clips the cloud top. Key the blue sky/light fringe and exclude the single left phone-frame column, retaining the original cloud RGB.' },
  { id:'home-cloud', file:'01-home.png', box:[156,111,188,88], kind:'element', key:'sky', width:188 },
  { id:'home-canopy', file:'01-home.png', box:[591,196,277,318], kind:'element', key:'sky', width:277 },
  { id:'map-canopy-left', file:'05-cat.png', box:[156,149,258,43], kind:'element', key:'sky', width:258 },
  { id:'map-canopy-right', file:'05-cat.png', box:[579,149,289,43], kind:'element', key:'sky', width:289, clearRects:[[685,149,175,29]] },
  { id:'state-mouse', file:'06-mouse-v2.png', box:[173,1058,294,180], kind:'state', key:'cream', width:294 },
  { id:'state-hiding', file:'04-hiding-v2.png', box:[170,1087,371,234], kind:'state', key:'cream', protect:creamProtections.hiding, width:371 },
  { id:'state-captured', file:'09-captured.png', box:[174,1121,310,195], kind:'state', key:'cream', width:310 },
  { id:'state-paused', file:'10-paused.png', box:[169,1022,364,208], kind:'state', key:'cream', protect:creamProtections.paused, width:364 },
  { id:'state-offline', file:'11-offline.png', box:[163,1086,315,224], kind:'state', key:'blue-card', width:315 },
  { id:'state-catWin', file:'12-catWin.png', box:[449,964,401,276], kind:'state', key:'cream', protect:creamProtections.catWin, width:401, clearRects:[[449,1087,4,13]], reason:'Remove only an isolated original adjacent-title vertical stroke at the crop left edge (x449,y1089..1097); no cat-face ink or visible character RGB is changed.' },
  { id:'state-mouseWin', file:'13-mouseWin.png', box:[378,893,468,255], kind:'state', key:'cream', protect:creamProtections.mouseWin, width:420, clean:'mouseWin' },
  { id:'state-cancelled', file:'14-cancelled.png', box:[170,1018,364,214], kind:'state', key:'cream', protect:creamProtections.cancelled, width:364 },
  { id:'avatar-cat', file:'04-hiding-v2.png', box:[203,221,66,65], kind:'icon', key:'cream', width:66 },
  { id:'avatar-mouse', file:'06-mouse-v2.png', box:[202,219,71,68], kind:'icon', key:'cream', width:71 },
  { id:'avatar-mouse-green', file:'13-mouseWin.png', box:[203,220,66,65], kind:'icon', key:'cream', width:66 },
];
const iconBoxes = {
  home:[201,649,53,51], create:[422,649,57,57], ready:[641,653,54,46],
  catMap:[203,820,58,57], mouseMap:[423,819,58,58], alert:[638,821,61,56],
  hiding:[197,917,70,52], code:[427,916,54,54], captured:[198,1090,70,59],
  paused:[421,1087,62,62], offline:[638,1091,68,58], catWin:[199,1262,67,62],
  mouseWin:[422,1269,59,52], cancelled:[639,1264,57,57],
};
for (const [id,box] of Object.entries(iconBoxes)) {
  specs.push({id:'icon-'+id, file:'15-dev.png', box, kind:'icon', key:'white', width:box[2]});
}
const parks = {
  hiding:['04-hiding-v2.png',312,1052], cat:['05-cat.png',312,1059],
  mouse:['06-mouse-v2.png',312,1039], alert:['07-alert.png',312,1025],
  captured:['09-captured.png',371,1077], paused:['10-paused.png',312,997],
  offline:['11-offline.png',312,1051], catWin:['12-catWin.png',312,950],
  mouseWin:['13-mouseWin.png',312,893], cancelled:['14-cancelled.png',312,964],
  drawer:['16-drawer.png',279,638],
};
for (const [id,[file,top,bottom]] of Object.entries(parks)) {
  specs.push({id:'park-stage-'+id,file,box:[156,top,712,bottom-top],kind:'park-stage',width:450,previewOnly:true,bakedDim:id==='drawer'});
}
function insidePolygon(x,y,points) {
  let inside = false;
  for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const [xi,yi]=points[i], [xj,yj]=points[j];
    if (((yi>y)!==(yj>y)) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
function background(r,g,b,key) {
  if(key==='cream') return r>=230 && g>=237 && b>=226 && g>=r-2 && b>=r-11;
  if(key==='white') return r>=226 && g>=229 && b>=225 && Math.max(r,g,b)-Math.min(r,g,b)<=22;
  if(key==='blue-card') return r>=201 && r<=235 && g>=235 && b>=247;
  if(key==='sky') return b>=184 && g>=152 && r<211 && b-r>35;
  if(key==='gallery-sky') return b>=184 && g>=152 && b-r>=4 && g>=r+1;
  if(key==='cloud-white') return r<215 || g<215 || b<200 || Math.max(r,g,b)-Math.min(r,g,b)>45;
  return false;
}
// Remove only background connected to crop edges. Warm cat whites, inner negative
// spaces and original white cloud contours are retained by named protection masks.
function matte(data,width,height,spec) {
  const seen=new Uint8Array(width*height), queue=new Int32Array(width*height);
  let start=0,end=0;
  const eligible=(x,y)=>{
    const gx=x+spec.box[0],gy=y+spec.box[1],p=(y*width+x)*4;
    if(data[p+3]===0)return true;
    if((spec.protect||[]).some(poly=>insidePolygon(gx,gy,poly)))return false;
    return background(data[p],data[p+1],data[p+2],spec.key);
  };
  function visit(x,y) {
    if(x<0||x>=width||y<0||y>=height)return;
    const index=y*width+x;
    if(seen[index]||!eligible(x,y))return;
    seen[index]=1;queue[end++]=index;
  }
  for(let x=0;x<width;x++){visit(x,0);visit(x,height-1);}
  for(let y=0;y<height;y++){visit(0,y);visit(width-1,y);}
  while(start<end){const p=queue[start++],x=p%width,y=Math.floor(p/width);visit(x-1,y);visit(x+1,y);visit(x,y-1);visit(x,y+1);}
  for(let p=0;p<seen.length;p++)if(seen[p])data[p*4+3]=0;
  return end;
}
function applyMasks(data,width,height,spec) {
  for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
    const gx=x+spec.box[0],gy=y+spec.box[1],p=(y*width+x)*4;
    if((spec.clearRects||[]).some(([a,b,w,h])=>gx>=a&&gx<a+w&&gy>=b&&gy<b+h))data[p+3]=0;
    if(spec.clean==='mouseWin') {
      // A tail protrudes above the rounded panel into the map. Preserve only
      // original orange tail pixels in this top strip, not the green map.
      if(gy<916 && !(data[p]>205 && data[p+1]>70 && data[p+1]<206 && data[p+2]<140 && data[p]>data[p+1]+28))data[p+3]=0;
      // Adjacent title fragment is outside the character; remove deep ink and
      // its antialias fringe only inside this explicitly measured text ROI.
      if(gx<485 && gy>=1053 && gy<1128) {
        const green=data[p+1]>data[p]+15 && data[p+1]>data[p+2]+20 && data[p+1]>85;
        const catCream=gx>468 && gy<1086 && (spec.protect||[]).some(poly=>insidePolygon(gx,gy,poly)) && data[p]>=254 && data[p+1]<=251 && data[p+2]<=244;
        if(!green&&!catCream)data[p+3]=0;
      }
      if(gx<485 && gy>=1128) data[p+3]=0;
    }
  }
}
async function alphaInfo(p) {
  const {data,info}=await sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let transparent=0,partial=0,opaque=0,minX=info.width,minY=info.height,maxX=-1,maxY=-1;
  for(let i=3;i<data.length;i+=info.channels){
    if(data[i]===0)transparent++;else {
      if(data[i]===255)opaque++;else partial++;
      const pixel=(i-3)/info.channels,x=pixel%info.width,y=Math.floor(pixel/info.width);
      minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    }
  }
  return {transparent,partial,opaque,total:info.width*info.height,bbox:maxX<0?null:{left:minX,top:minY,width:maxX-minX+1,height:maxY-minY+1}};
}
function checkSources() {
  for(const s of screens){const p=path.join(ROOT,SOURCE,s.file);if(digest(fs.readFileSync(p))!==s.sha256)throw new Error('Locked page source changed: '+s.file);}
}
function ratioStyles(assets) {
  const fixed={
    'hero-home':'.heroScene','home-cloud':'.heroCloud,.mapCloud','home-canopy':'.heroCanopy',
    'hero-create':'.createHero .heroArt','hero-ready':'.readyHero .heroArt','hero-code':'.codeHero .heroArt',
    'hero-gallery':'.devHero .devHeroArt','gallery-cloud':'.devHero .galleryCloud',
    'create-cloud':'.createHero .createCloud','ready-cloud':'.readyHero .readyCloud',
    'map-canopy-left':'.mapCanopyLeft','map-canopy-right':'.mapCanopyRight'
  };
  let css='/* Generated from verified PNG dimensions. Prevent widthFix cached-height distortion when CSS parent width changes. Do not edit by hand. */\n';
  for(const a of assets){
    let selector=fixed[a.id];
    if(a.id.startsWith('state-')){const id=a.id.slice(6);selector=`.state-${id} .stateArt,.state-${id} .resultArt`;}
    if(a.id.startsWith('park-stage-')){const id=a.id.slice(11);selector=id==='drawer'?'.mapPage.drawerOpen .parkArt':id==='alert'?'.state-mouse.nearby .parkArt,.state-cat.nearby .parkArt':`.state-${id} .parkArt`;}
    if(selector)css+=`${selector}{aspect-ratio:${a.width} / ${a.height};height:auto!important}\n`;
  }
  return css;
}
function writeRatioStyles(assets){fs.writeFileSync(path.join(ROOT,'utils/art-ratios.wxss'),ratioStyles(assets));}
async function verify() {
  checkSources();
  if(!fs.existsSync(MANIFEST))throw new Error('FAITHFUL_ART_BASELINE manifest absent');
  const manifest=JSON.parse(fs.readFileSync(MANIFEST,'utf8'));
  if(fs.readFileSync(path.join(ROOT,'utils/art-ratios.wxss'),'utf8')!==ratioStyles(manifest.assets))throw new Error('Generated responsive art-ratios stylesheet is stale');
  for(const item of manifest.sources)if(digest(fs.readFileSync(path.join(ROOT,item.path)))!==item.sha256)throw new Error('Source hash mismatch: '+item.path);
  let alphaStates=0;
  for(const item of manifest.assets) {
    for(const [p,sha]of [[item.path,item.sha256],[item.fragmentPath,item.fragmentSha256],[item.sourceFragmentPath,item.sourceFragmentSha256]]) {
      if(digest(fs.readFileSync(path.join(ROOT,p)))!==sha)throw new Error('Asset hash mismatch: '+p);
    }
    const sourceRaw=await sharp(path.join(ROOT,item.source)).extract(item.crop).removeAlpha().raw().toBuffer();
    const fragmentRaw=await sharp(path.join(ROOT,item.sourceFragmentPath)).removeAlpha().raw().toBuffer();
    if(!sourceRaw.equals(fragmentRaw))throw new Error('Source fragment RGB changed: '+item.id);
    const {data:cutoutRaw,info:cutoutInfo}=await sharp(path.join(ROOT,item.fragmentPath)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(let pixel=0;pixel<cutoutInfo.width*cutoutInfo.height;pixel++) {
      if(cutoutRaw[pixel*4+3] && (sourceRaw[pixel*3]!==cutoutRaw[pixel*4]||sourceRaw[pixel*3+1]!==cutoutRaw[pixel*4+1]||sourceRaw[pixel*3+2]!==cutoutRaw[pixel*4+2]))throw new Error('Visible artwork RGB repainted: '+item.id);
    }
    const meta=await sharp(path.join(ROOT,item.path)).metadata();
    if(meta.width!==item.width||meta.height!==item.height)throw new Error('Size mismatch: '+item.id);
    const a=await alphaInfo(path.join(ROOT,item.path));
    if(item.kind==='state'){
      if(a.transparent===0||a.opaque===0)throw new Error('State lacks genuine cutout alpha: '+item.id);
      alphaStates++;
    }
  }
  if(alphaStates!==8)throw new Error('Expected eight alpha state images');
  console.log(`FAITHFUL_ART_VERIFY sources=${manifest.sources.length} runtime=${manifest.assets.length} alphaStates=${alphaStates} bytes=${manifest.runtimeBytes}`);
}
async function build() {
  checkSources();
  const fragmentDir=path.join(ROOT,DESIGN,'fragments');
  fs.mkdirSync(fragmentDir,{recursive:true});fs.mkdirSync(path.join(ROOT,OUTPUT),{recursive:true});
  const assets=[];
  for(const spec of specs) {
    const source=path.join(ROOT,SOURCE,spec.file),[left,top,width,height]=spec.box;
    const rawFragment=path.join(fragmentDir,spec.id+'-source.png');
    // These source fragments retain all original RGB pixels, including matte.
    await sharp(source).extract({left,top,width,height}).png().toFile(rawFragment);
    const {data,info}=await sharp(rawFragment).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    applyMasks(data,info.width,info.height,spec);
    const removedBackgroundPixels=spec.key?matte(data,info.width,info.height,spec):0;
    const fragment=path.join(fragmentDir,spec.id+'.png');
    await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toFile(fragment);
    const target=path.join(ROOT,OUTPUT,spec.id+'.png');
    await sharp(fragment).resize({width:Math.min(spec.width,width),withoutEnlargement:true}).png({palette:true,colours:spec.kind==='park-stage'?128:192,dither:0.15}).toFile(target);
    const meta=await sharp(target).metadata(),alpha=await alphaInfo(target);
    assets.push({id:spec.id,kind:spec.kind,source:relative(source),sourceSha256:selected.get(spec.file).sha256,
      crop:{left,top,width,height},path:relative(target),sha256:digest(fs.readFileSync(target)),width:meta.width,height:meta.height,bytes:fs.statSync(target).size,
      hasAlpha:meta.hasAlpha,alpha,alphaBBox:alpha.bbox,aspectRatio:{source:selected.get(spec.file).width/selected.get(spec.file).height,crop:width/height,runtime:meta.width/meta.height},previewOnly:!!spec.previewOnly,bakedDim:!!spec.bakedDim,
      sourceFragmentPath:relative(rawFragment),sourceFragmentSha256:digest(fs.readFileSync(rawFragment)),
      fragmentPath:relative(fragment),fragmentSha256:digest(fs.readFileSync(fragment)),
      transform:{type:'source-pixel-crop',backgroundKey:spec.key||null,removedBackgroundPixels,clearRects:spec.clearRects||[],protectedPolygons:spec.protect||[],specialCleanup:spec.clean||null,resizeWidth:Math.min(spec.width,width),paletteColours:spec.kind==='park-stage'?128:192,dither:0.15,...(spec.reason?{reason:spec.reason}:{})}});
  }
  const history=path.join(ROOT,DESIGN,'history/manifest-first-pass.json');
  const skyHistory=path.join(ROOT,DESIGN,'history/manifest-48-before-sky-matte.json');
  const manifest={version:'original-page-pixel-faithful-v2',created:'2026-10-12',generatedArt:false,
    revision:{reason:'Minimal source-crop corrections: preserve the original home bush upper contour, restore complete gallery/create/ready left clouds, clear an isolated cat-win adjacent-title edge stroke, and remove home edge-connected sky in alpha for responsive underlays. No source RGB repainting and no CSS changes.',previousManifest:relative(history),previousManifestSha256:fs.existsSync(history)?digest(fs.readFileSync(history)):null,skyMattePreviousManifest:relative(skyHistory),skyMattePreviousManifestSha256:fs.existsSync(skyHistory)?digest(fs.readFileSync(skyHistory)):null},
    notes:['Source fragments are exact RGB crops. Only alpha is edited in cutouts; mobile files use deterministic resizing/palette encoding.','Five hero compositions are separate. Create alone contains its original orange flag. Ready/gallery original capsule overlap and ready adjacent heading are cleared in alpha; render against the native sky/cream underlay.','Park-stage crops contain original public/sample flags, own-location sample or clue illustration when present. Explicit developer preview only; never geographic runtime maps.','Unknown pixels hidden behind original HUD/panels have not been invented or repainted. Mouse-win adjacent title occlusion is removed in alpha without repainting hidden art; its map stage stops at y893 before the tail protrusion.','Drawer park crop already includes its original dimming; do not add another dim mask unless replacing it with a bright-stage crop.','Every resize specifies width only. Integer output-height rounding is recorded by source/crop/runtime aspectRatio; no nonuniform scaling is applied.'],
    sources:screens.map(s=>({path:`${SOURCE}/${s.file}`,sha256:s.sha256,width:s.width,height:s.height})),
    runtimeBytes:assets.reduce((n,a)=>n+a.bytes,0),assets};
  fs.writeFileSync(MANIFEST,JSON.stringify(manifest,null,2)+'\n');
  writeRatioStyles(assets);
  console.log(`FAITHFUL_ART_BUILD sources=${screens.length} runtime=${assets.length} bytes=${manifest.runtimeBytes}`);
  await verify();
}
(async()=>{if(process.argv.includes('--styles-only')){checkSources();writeRatioStyles(JSON.parse(fs.readFileSync(MANIFEST,'utf8')).assets);await verify();}else if(process.argv.includes('--verify'))await verify();else await build();})().catch(error=>{console.error(error.message);process.exitCode=1;});
