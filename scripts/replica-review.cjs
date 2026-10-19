// Official automation. One connection per batch; no cached SDK Page/Element handles. No desktop resize/publish.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const automator=require('../cat-mouse-server/node_modules/miniprogram-automator');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[3]||path.join(root,'reports/2026-10-12/replica/screenshots'));
const requested=process.argv[2]||'all',large=process.argv[4]==='large',preview=require('../utils/dev-preview');
const profile=process.argv[5]?process.argv[5].split('x').map(Number):null;
if(profile)assert.ok(profile.length===2&&profile.every(n=>n>=300&&n<=1000),'invalid layout canvas');
const artManifest=JSON.parse(fs.readFileSync(path.join(root,'design/2026-10-12/faithful-art/manifest.json'),'utf8'));
const cases=[{id:'gallery',path:'/pages/dev/dev'},...preview.cases,{id:'drawer',path:'/pages/map/map?devPreview=cat'}];
const selected=requested==='all'?cases:cases.filter(c=>requested.split(',').includes(c.id));
assert.ok(selected.length,'unknown case');
const records=[];fs.mkdirSync(out,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let sharedMp=null;
async function inspect(item){
 const mp=sharedMp||(sharedMp=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'}));
 let stage='account';
 try{
  assert.equal((await mp.callWxMethod('getAccountInfoSync')).miniProgram.envVersion,'develop');
  let info;
  for(let attempt=0;attempt<3;attempt++){
   stage='reLaunch';
   await mp.callWxMethod('reLaunch',{url:item.path});await delay(1000);
   stage='routeState';
   info=await mp.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];return {route:p.route,preview:!!p.data.devPreview,available:!!p.data.available,state:p.data.uiState,clock:p.data.clock,navHeight:p.data.navHeight,stateArt:p.data.stateArt,parkArt:p.data.parkArt,roleArt:p.data.roleArt,roomId:p.data.roomId,resultSummary:p.data.resultSummary};});
   if(info.route===item.path.slice(1).split('?')[0]&&(item.id==='gallery'?info.available:info.preview))break;
   console.log('ROUTE_RETRY '+item.id+' '+JSON.stringify(info));
  }
  assert.equal(info.route,item.path.slice(1).split('?')[0]);assert.equal(item.id==='gallery'?info.available:info.preview,true);
  if(item.id==='drawer')await mp.evaluate(()=>{getCurrentPages().slice(-1)[0].toggleDrawer();return true;});
  if(profile)await mp.evaluate((w,h)=>{getCurrentPages().slice(-1)[0].onResize({size:{windowWidth:w,windowHeight:h}});return true;},...profile);
  if(large)await mp.evaluate(()=>{getCurrentPages().slice(-1)[0].setData({fontScale:1.3});return true;});
  await delay(700);
  stage='renderedMetrics';const renderedMetrics=await mp.evaluate(()=>{const d=getCurrentPages().slice(-1)[0].data;return {fontScale:d.fontScale,viewportWidth:d.viewportWidth,viewportHeight:d.viewportHeight};});
  assert.equal(renderedMetrics.fontScale,large?1.3:1,'actual page fontScale does not match requested test');
  if(profile){assert.equal(renderedMetrics.viewportWidth,profile[0]);assert.equal(renderedMetrics.viewportHeight,profile[1]);}
  const imageClasses=[...fs.readFileSync(path.join(root,info.route+'.wxml'),'utf8').matchAll(/<image\s[^>]*class="([^"{]+)[^"\n]*"/g)].flatMap(x=>x[1].trim().split(/\s+/).filter(n=>n&&!n.includes('{{')).map(n=>'.'+n));
  stage='selectorLayout';const layout=await mp.evaluate(classes=>new Promise(resolve=>{
   const selectors=['.screen','.hero','.homeInput','.primary','.secondary','.topPanel','.bottomPanel','.code','.copyButton','.drawer','.drawerHeader','.publicOnly','.roleColumn','.goal','.clock','.resultTitle','.heroScene','.heroArt','.sceneArt','.heroCat','.cloudArt','.treeArt','.stateArt','.resultArt','.roleArt','.parkArt','.warningIcon','.groupIcon','.formTitle','.inviteCard','.rosterCard','.roomCodeCard','.venueCard','.galleryGroup','.devLink','.heroCopy',...classes];
   selectors.push('.demoRing','.demoCheck','.demoTitle','.qrCorners','.resultSummary');
   const q=wx.createSelectorQuery();for(const sel of selectors)q.selectAll(sel).boundingClientRect();
   q.exec(values=>{const result={};selectors.forEach((sel,i)=>result[sel]=values[i]);resolve({window:wx.getWindowInfo(),boxes:result});});
  }),imageClasses);
  const imageChecks=[];
  const srcByClass={'.heroArt':item.id==='ready'?'/assets/faithful-v2/hero-ready.png':item.id==='create'?'/assets/faithful-v2/hero-create.png':'/assets/faithful-v2/hero-code.png','.stateArt':info.stateArt,'.resultArt':info.stateArt,'.roleArt':info.roleArt,'.parkArt':item.id==='drawer'?'/assets/faithful-v2/park-stage-drawer.png':info.parkArt};
  const pageSource=fs.readFileSync(path.join(root,info.route+'.wxml'),'utf8');
  for(const tag of pageSource.matchAll(/<image\s[^>]*>/g)){
    const cls=tag[0].match(/class="([^"]+)"/),src=tag[0].match(/src="([^"{]+)"/);
    if(cls&&src)for(const name of cls[1].split(/\s+/))srcByClass['.'+name]=src[1];
  }
  for(const [selector,src] of Object.entries(srcByClass)){
    const asset=artManifest.assets.find(x=>'/'+x.path===src);if(!asset)continue;
    for(const b of layout.boxes[selector]||[]){
      const widthFix=pageSource.includes('class="'+selector.slice(1)+'" src="'+(selector==='.stateArt'||selector==='.resultArt'?'{{stateArt}}':src)+'" mode="widthFix"');
      const dynamicHero=selector==='.heroArt'&&info.route==='pages/room/room';
      const respectsIntrinsic=widthFix||dynamicHero||selector==='.parkArt';
      const ratioError=respectsIntrinsic?Math.abs((b.width/b.height)/(asset.width/asset.height)-1):null;
      if(respectsIntrinsic)assert.ok(ratioError<.015,item.id+' '+selector+' NONUNIFORM_IMAGE '+ratioError);
      imageChecks.push({selector,src,mode:respectsIntrinsic?'widthFix':selector==='.parkArt'?'aspectFill':'aspectFit/widthFix declared in template',intrinsic:[asset.width,asset.height],rendered:[b.width,b.height],ratioError,method:respectsIntrinsic?'actual rendered box / original PNG aspect':'uniform contain or cover (template mode); no scaleToFill'});
    }
  }
  const canvasWidth=profile?profile[0]:layout.window.windowWidth;
  for(const [selector,boxes]of Object.entries(layout.boxes))for(const b of boxes||[]){
   assert.ok(b.left>=-1,item.id+selector+' left overflow');assert.ok(b.right<=canvasWidth+1,item.id+selector+' right overflow');
  }
  const top=layout.boxes['.topPanel']?.[0],bottom=layout.boxes['.bottomPanel']?.[0],publicOnly=layout.boxes['.publicOnly']?.[0];
  if(top&&bottom){assert.ok(top.bottom<bottom.top,item.id+' panels overlap');assert.ok(bottom.bottom<=(profile?profile[1]:layout.window.windowHeight)+1,item.id+' bottom cropped');}
  if(publicOnly)assert.ok(publicOnly.top>=top.bottom,'public notice overlaps HUD');
  if(item.id==='ready'){const code=layout.boxes['.code'][0],copy=layout.boxes['.copyButton'][0];assert.ok(code.right<copy.left||code.bottom<=copy.top,'code/copy overlap');}
  if(item.id==='paused')assert.equal(info.clock,'04:45');
  if(item.id==='offline')assert.equal(info.clock,'--:--');
  if(item.id==='cancelled'){
    assert.equal(info.resultSummary,'这局记录保留，下一轮使用新的对局');
    const summary=layout.boxes['.resultSummary'][0];
    assert.ok(summary.height<=renderedMetrics.viewportWidth*.0252*renderedMetrics.fontScale*1.25+1,'cancelled summary wraps into orphan line');
  }
  if(item.id==='code'){
    const check=layout.boxes['.demoCheck'][0],title=layout.boxes['.demoTitle'][0],corners=layout.boxes['.qrCorners'][0];
    assert.ok(check.bottom+1<=title.top,'demo code title overlaps check-circle');
    assert.ok(title.bottom<=corners.bottom,'demo code title exceeds code frame');
  }
  await delay(1200);stage='screenshot';const file=path.join(out,item.id+'.png');await mp.screenshot({path:file});
  return {id:item.id,...info,...renderedMetrics,layoutCanvas:profile||null,layout,imageChecks,screenshot:file};
 }catch(e){console.log('SDK_FAIL_PHASE '+item.id+' '+stage+' '+e.message);throw e;}finally{/* connection closes after the batch, not between reLaunch transitions */}
}
(async()=>{
 for(const item of selected){
  console.log('ROUTE '+item.id);
  let record;
  for(let attempt=0;attempt<2;attempt++){
   try{record=await inspect(item);break;}catch(e){
    if(attempt===1||!(/timeout|rawPath/.test(e.message)||e.message===''))throw e;
    console.log('SDK_RECONNECT '+item.id+' '+e.message);sharedMp?.disconnect();sharedMp=null;await delay(1500);
   }
  }
  records.push(record);fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({status:'IN_PROGRESS',records},null,2));console.log('PASS '+item.id);
 }
 fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({status:'PASS',scope:'geometry, authorized fixture state, and intrinsic image ratios; not pixel similarity or physical device validation',layoutCanvas:profile||null,records},null,2));console.log('REPLICA_UI_PASS='+records.length+' FONT_SCALE='+(large?1.3:1));
})().then(()=>{sharedMp?.disconnect();}).catch(e=>{sharedMp?.disconnect();fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({status:'FAILED',error:e.message,records},null,2));console.error(e.stack);process.exitCode=1;});



