// Real page-handler + rendered-control integration in the official IDE.
// Not a physical finger-tap, true device, production API, GPS or camera test.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const automator=require('../cat-mouse-server/node_modules/miniprogram-automator'),out=path.resolve(process.argv[2]||'reports/2026-10-12/replica/interactions');
fs.mkdirSync(out,{recursive:true});const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let mp=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});const records=[];
 async function reconnect(){mp.disconnect();mp=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});}
 const state=()=>mp.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];return {route:p.route,...p.data};});
 async function capture(name){
  const before=await state();
  try{await mp.screenshot({path:path.join(out,name)});}catch(e){
   if(!/timeout/.test(e.message))throw e;console.log('SCREENSHOT_ONLY_RETRY '+name+'; no handler replay');await reconnect();await wait(1200);
   const current=await state();assert.equal(current.route,before.route);assert.equal(current.fontScale,before.fontScale);assert.equal(current.uiState,before.uiState);
   await mp.screenshot({path:path.join(out,name)});
  }
 }
 async function route(url){
  console.log('ROUTE '+url);let s;
  for(let i=0;i<3;i++){await mp.callWxMethod('reLaunch',{url});await wait(1000);s=await state();if(s.route===url.slice(1).split('?')[0]&&(s.devPreview||s.available))return;}
  assert.fail('fixture route did not settle');
 }
 async function invoke(method,event){console.log('INVOKE '+method);try{await mp.evaluate((name,arg)=>{getCurrentPages().slice(-1)[0][name](arg);return true;},method,event||{});}catch(e){if(!e.message.includes('timeout'))throw e;console.log('SDK_RESPONSE_RECOVERY '+method+'; action is NOT replayed');await reconnect();}await wait(700);}
 async function boxes(selector){return mp.evaluate(sel=>new Promise(resolve=>wx.createSelectorQuery().selectAll(sel).boundingClientRect().exec(result=>resolve(result[0]))),selector);}
 async function pass(id){records.push(id);console.log('PASS '+id);}
 async function settled(predicate){let s;for(let i=0;i<20;i++){s=await state();if(predicate(s))return s;await wait(300);}assert.fail('navigation not settled: '+JSON.stringify({route:s.route,state:s.uiState,error:s.error}));}
 try{
  await route('/pages/index/index?devPreview=home');
  assert.equal((await boxes('.homeInput')).length,2);
  await invoke('nameInput',{detail:{value:'小橘测试'}});await invoke('codeInput',{detail:{value:'a1b2c3d4e5'}});
  assert.equal((await state()).nickname,'小橘测试');assert.equal((await state()).code,'A1B2C3D4E5');await pass('input-handler-binding');
  await invoke('join');await settled(s=>s.route==='pages/room/room'&&s.canStart);await pass('join-preview-route');
  await invoke('toggleReady');assert.equal((await state()).canStart,false);
  await invoke('start');assert.equal((await state()).route,'pages/room/room');await pass('not-ready-start-guard');
  await invoke('toggleReady');assert.equal((await state()).canStart,true);await invoke('start');
  await settled(s=>s.uiState==='hiding');await pass('ready-start-hiding');
  await invoke('toggleDrawer');assert.equal((await state()).drawer,true);assert.equal((await boxes('.drawer')).length,1);
  await invoke('closeDrawer');assert.equal((await state()).drawer,false);assert.equal((await boxes('.drawer')).length,0);await pass('drawer-open-close-render');
  await route('/pages/map/map?devPreview=mouse');await invoke('showCode');await settled(s=>s.route==='pages/qrcode/qrcode');
  assert.equal((await state()).image,'');await invoke('back');await settled(s=>s.uiState==='mouse');await pass('mouse-code-return');
  await route('/pages/map/map?devPreview=offline');assert.equal((await boxes('.primary')).length,0);assert.equal((await state()).markers.length,0);await pass('offline-no-tactical-action');
  await route('/pages/dev/dev');await mp.evaluate(()=>{getCurrentPages().slice(-1)[0].setData({fontScale:1.3});return true;});await wait(300);
  await mp.pageScrollTo(10000);await wait(400);
  const cta=(await boxes('.secondary'))[0],height=await mp.evaluate(()=>wx.getWindowInfo().windowHeight);
  assert.ok(cta.top>=0&&cta.bottom<=height,'gallery bottom action not scroll reachable');
  await capture('gallery-bottom.png');await pass('large-gallery-scroll-reachable');
  for(const [id,url,selector] of [['create','/pages/room/room?devPreview=create','.primary'],['ready','/pages/room/room?devPreview=ready','.roomActions .primary'],['code','/pages/qrcode/qrcode?devPreview=code','.secondary']]){
   await route(url);await mp.evaluate(()=>{getCurrentPages().slice(-1)[0].setData({fontScale:1.3});return true;});await wait(500);
   await mp.pageScrollTo(10000);await wait(500);const b=(await boxes(selector))[0];
   assert.ok(b&&b.top>=0&&b.bottom<=height,id+' large bottom action not scroll reachable');
   await capture(id+'-bottom.png');await pass('large-'+id+'-scroll-reachable');
  }
  await route('/pages/map/map?devPreview=cat');await mp.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];p.setData({fontScale:1.3});p.toggleDrawer();return true;});await wait(600);
  const page=await mp.currentPage(),body=await page.$('.drawerBody');assert.ok(body,'native drawer scroll-view missing');await body.scrollTo(0,10000);await wait(600);
  const exit=(await boxes('.exitButton'))[0],drawerBody=(await boxes('.drawerBody'))[0];assert.ok(exit.top>=drawerBody.top&&exit.bottom<=drawerBody.bottom,'large drawer exit not reachable');
  await capture('drawer-bottom.png');await pass('large-drawer-scroll-reachable');
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',records,environment:'WeChat IDE develop preview; handler invocation + real selector layout; not physical taps'},null,2));console.log('REPLICA_INTERACTION_PASS='+records.length);
  await route('/pages/dev/dev');
 }finally{mp.disconnect();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

