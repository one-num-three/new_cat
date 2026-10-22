'use strict';
// Product painter, synthetic image-space regression cases. Not WeChat or GPS.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]),bundle='C:/Users/Keke_/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules',lib=require(require.resolve('@napi-rs/canvas',{paths:[bundle]}));
const poster=require('../utils/track-poster'),layout=require('../utils/track-highlights'),assets=require('../utils/track-bubble-assets'),{place}=require('../utils/track-bubble-placement'),images=require('../utils/venue-images');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const screen=([x,y])=>({x:x/1254*941,y:328+y/1254*941});
const make=()=>lib.createCanvas(941,1672);
function flagDifference(canvas,reference){const actual=canvas.getContext('2d').getImageData(0,0,941,1672).data,ref=reference.getContext('2d').getImageData(0,0,941,1672).data;let checked=0,bad=0;for(let i=0;i<ref.length;i+=4){if(ref[i+3]<240)continue;checked++;const tolerance=256-ref[i+3];if([0,1,2].some(c=>Math.abs(ref[i+c]-actual[i+c])>tolerance))bad++;}return {checkedOpaqueFlagPixels:checked,coveredFlagPixels:bad};}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const font=path.join(out,'layer-font.ttf'),r=cp.spawnSync('python',['-c','from fontTools.ttLib import TTFont; import sys; f=TTFont(sys.argv[1]); f.flavor=None; f.save(sys.argv[2])',path.join(root,'design/2026-10-13/global-font-v1/ui-subset.woff'),font],{encoding:'utf8'});assert.equal(r.status,0,r.error?.message||r.stderr);assert.ok(lib.GlobalFonts.registerFromPath(font,'CatMouseFusionUI'));
 const sprites={start:await lib.loadImage(path.join(root,'room-tools/assets/start-flag.png')),finish:await lib.loadImage(path.join(root,'room-tools/assets/finish-flag.png')),bubbles:{}};
 for(const s of Object.values(assets.sprites))sprites.bubbles[s.files[0].file]=await lib.loadImage(path.join(root,'room-tools/assets',s.files[0].file));
 const frame=await lib.loadImage(path.join(root,'room-tools/assets/track-share-frame.png')),records=[];
 for(const key of ['xuanwu','jiulonghu','sipailou']){
  const input=JSON.parse(fs.readFileSync(path.join(root,'design/2026-10-21/track-share-mock-v1',key+'-mock.json')));assert.equal(input.synthetic,true);assert.equal(input.coordinateSystem,'original-image-pixels');const image=images.find(x=>x.id===input.imageId),bytes=fs.readFileSync(path.join(root,image.src.slice(1)));assert.equal(sha(bytes),image.sha256);
  const map=await lib.loadImage(bytes),flags=[{kind:'start',point:screen(input.controlPoints[0])},{kind:'finish',point:screen(input.controlPoints.at(-1))}],h=[{kind:'fastest',point:screen(input.highlights.fastest),detail:'布局验证 · 非真实记录'},{kind:'nearest',point:screen(input.highlights.closest),detail:'布局验证 · 非真实记录'}],unchanged=JSON.stringify({flags,h});
  const callouts=layout.callouts(h,flags),flagBoxes=layout.flagPlacements(flags);assert.equal(callouts.length,2);assert.ok(callouts.every(h=>flagBoxes.every(f=>!overlap(h.box,f.box))));assert.equal(overlap(callouts[0].box,callouts[1].box),false);assert.equal(JSON.stringify({flags,h}),unchanged);
  const data={runs:[input.controlPoints.map(screen)],flags,callouts,metrics:{distance:'',duration:'',calories:'',note:'布局验证 · 非真实轨迹 · 统计留空'}},canvas=make(),reference=make();reference.getContext('2d').imageSmoothingEnabled=false;poster.drawFlags(reference.getContext('2d'),data,sprites);poster.paint(canvas.getContext('2d'),map,frame,data,image,sprites);
  const check=flagDifference(canvas,reference);assert.ok(check.checkedOpaqueFlagPixels>2000);assert.equal(check.coveredFlagPixels,0,key+' flag pixels were covered');fs.writeFileSync(path.join(out,key+'-layout.png'),canvas.toBuffer('image/png'));
  const record={key,synthetic:true,coordinateSystem:'image-space layout regression; NOT GPS',mapSha256:image.sha256,flags:flagBoxes,callouts:callouts.map(h=>({kind:h.kind,point:h.point,edge:h.placement.edge,box:h.box,tip:h.placement.tip,avoidance:h.placement.avoidance})),bubbleFlagCollisions:0,...check};
  if(key==='jiulonghu'){
   const q=place('closest',h[1].point,{x:0,y:328,width:941,height:941},assets,420,8),b=assets.sprites[q.key].visibleBounds,box={x:q.x+b.left*q.width,y:q.y+b.top*q.height-26,w:(b.right-b.left)*q.width,h:(b.bottom-b.top)*q.height+26};assert.ok(flagBoxes.some(f=>overlap(box,f.box)),'negative case must reproduce a flag collision');
   // Deliberately draw a colliding bubble AFTER flags as a negative control.
   // This keeps the test independent of removable historical release copies.
   const forced={...data,callouts:[{...h[1],placement:q,box}]},old=make(),fixed=make();poster.paint(old.getContext('2d'),map,frame,{...data,callouts:[]},image,sprites);old.getContext('2d').drawImage(sprites.bubbles[q.file],q.x,q.y,q.width,q.height);poster.paint(fixed.getContext('2d'),map,frame,forced,image,sprites);
   record.negativeControl=flagDifference(old,reference);record.fixedLayerControl=flagDifference(fixed,reference);assert.ok(record.negativeControl.coveredFlagPixels>100,'old painter must fail the visibility check');assert.equal(record.fixedLayerControl.coveredFlagPixels,0);fs.writeFileSync(path.join(out,'jiulonghu-old-layer-negative-control.png'),old.toBuffer('image/png'));
  }
  records.push(record);
 }
 fs.unlinkSync(font);fs.writeFileSync(path.join(out,'layer-verification.json'),JSON.stringify({pass:true,renderer:'desktop @napi-rs/canvas using actual product painter',nativeWechat:false,synthetic:true,maps:3,flags:6,layerOrder:['map','route','frame','highlightDots','highlightBubbles','startFinishFlags','stats'],allFlagPixelsPreserved:true,bubbleFlagCollisions:0,geographicPointsUnchanged:true,negativeControlDetected:true,records},null,2));console.log('PRODUCT_LAYER_VERIFY_PASS maps=3 flags=6 opaque_pixels=preserved collisions=0 old_negative_control=detected nativeWechat=false');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
