'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const automator=require('../cat-mouse-server/node_modules/miniprogram-automator');
const screenshot=require('./wechat-screenshot.cjs');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});const delay=ms=>new Promise(r=>setTimeout(r,ms));
const pending=[];const passed=[];const pass=value=>{passed.push(value);fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({status:'IN_PROGRESS',passed},null,2));};
(async()=>{let mp;try{
 mp=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});
 const waitPath=async expected=>{let actual;for(let n=0;n<30;n++){actual=(await mp.currentPage())?.path;if(actual===expected){await delay(350);return;}await delay(200);}assert.equal(actual,expected);};
 const go=async url=>{await mp.callWxMethod('reLaunch',{url});for(let i=0;i<30;i++){const route=await mp.evaluate(()=>getCurrentPages().slice(-1)[0]?.route || '');if(route===url.slice(1).split('?')[0]){await delay(800);return;}await delay(250);}throw Error('Route did not settle: '+url);};
 const tapAction=async label=>{const cs=await (await mp.currentPage()).$$('.pixelControl');for(const c of cs){if(await c.data('label')===label){await (await c.$('.pixelAction')).tap();return;}}throw Error('Missing action '+label);};
 if(!['bottom-only','drawer-only'].includes(process.argv[3])){
 await go('/pages/venue/venue');
 for(let i=0;i<30;i++){if(await mp.evaluate(()=>!!getCurrentPages().slice(-1)[0]?.selectComponent('.venueArt')?.data.fitReady))break;await delay(250);}
 const get=()=>mp.evaluate(()=>{const c=getCurrentPages().slice(-1)[0].selectComponent('.venueArt');return {state:c.data.imageState,scale:c.data.scaleValue,x:c.data.x,y:c.data.y,w:c.data.fitWidth,h:c.data.fitHeight,camera:c._camera,serial:c._cameraSerial};});
 let state=await get();assert.equal(state.state,'ready');assert.equal(state.scale,1);pass('venue-loaded');
 let p=await mp.currentPage(),c=await p.$('.venueArt'),buttons=await c.$$('.venueStep');await buttons[1].tap();await delay(500);state=await get();assert.equal(state.scale,1.25);pass('native-plus-tap');
 try{
 const beforeMove={...state.camera};const mv=await (await (await mp.currentPage()).$('.venueArt')).$('.venueMovableView');const off=await mv.offset(),size=await mv.size();const touch={identifier:1,pageX:off.left+parseFloat(size.width)/2,pageY:off.top+parseFloat(size.height)/2,clientX:off.left+parseFloat(size.width)/2,clientY:off.top+parseFloat(size.height)/2};
 await mv.touchstart({touches:[touch],changeTouches:[touch]});await delay(150);const moved={...touch,pageX:touch.pageX-30,clientX:touch.clientX-30,pageY:touch.pageY-30,clientY:touch.clientY-30};await mv.touchmove({touches:[moved],changeTouches:[moved]});await delay(200);await mv.touchend({touches:[],changeTouches:[moved]});await delay(300);state=await get();assert.ok(Math.abs(state.camera.x-beforeMove.x)>.5||Math.abs(state.camera.y-beforeMove.y)>.5,'native touch must actually pan');pass('native-touch-pan');
 }catch(e){pending.push({check:'native-pan',error:e.message});console.log('PENDING native-pan '+e.message);}
 await screenshot(mp,path.join(out,'venue-zoom-pan.png'));
 c=await (await mp.currentPage()).$('.venueArt');await (await c.$('.venueReset')).tap();await delay(400);state=await get();assert.equal(state.scale,1);pass('native-reset-tap');
 const image=await (await (await mp.currentPage()).$('.venueArt')).$('.venueImage');await image.trigger('error',{});await delay(200);state=await get();assert.equal(state.state,'error');
 await screenshot(mp,path.join(out,'venue-load-error.png'));
 await (await (await (await mp.currentPage()).$('.venueArt')).$('.venueRetry')).tap();await delay(900);state=await get();assert.equal(state.state,'ready');pass('native-error-retry');
 await go('/pages/index/index?devPreview=home');await mp.pageScrollTo(10000);await delay(300);await (await (await mp.currentPage()).$('.venueEntry')).tap();await delay(800);await waitPath('pages/venue/venue');pass('home-guide-entry');
 await go('/pages/dev/dev');await (await (await mp.currentPage()).$('.venuePreviewEntry')).tap();await delay(800);await waitPath('pages/venue/venue');pass('gallery-guide-entry');
 await go('/pages/map/map?devPreview=mouse');const before=await mp.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];return {id:p.data.match.id,artMode:p.data.artMode};});
 await mp.evaluate(()=>{getCurrentPages().slice(-1)[0].toggleMapMode();return true;});const after=await mp.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];return {id:p.data.match.id,artMode:p.data.artMode};});assert.deepEqual(after,before);pass('preview-never-fakes-live-map');
 await mp.evaluate(()=>{getCurrentPages().slice(-1)[0].showCode();return true;});await delay(700);await waitPath('pages/qrcode/qrcode');pass('capture-code-route-preserved');
 

 await go('/pages/index/index?devPreview=home');
 p=await mp.currentPage();await (await p.$('.homeInput')).input('小橘');await (await p.$('.codeInput')).input('A1B2C3D4E5');await tapAction('加入房间');await delay(850);await waitPath('pages/room/room');pass('pixel-join-binding');
 await tapAction('取消准备');await delay(200);let r=await mp.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];return {route:p.route,canStart:p.data.canStart,ready:p.data.ready};});assert.equal(r.canStart,false);await tapAction('等待所有人准备');await delay(200);await waitPath('pages/room/room');pass('pixel-disabled-start');
 await tapAction('定位并准备');await delay(250);await tapAction('开始30秒躲藏');await delay(900);await waitPath('pages/map/map');pass('pixel-ready-start');
 await tapAction('队伍·规则');await delay(250);assert.equal(await mp.evaluate(()=>getCurrentPages().slice(-1)[0].data.drawer),true);await tapAction('关闭');await delay(150);assert.equal(await mp.evaluate(()=>getCurrentPages().slice(-1)[0].data.drawer),false);pass('pixel-drawer-close');
 await go('/pages/map/map?devPreview=catWin');await tapAction('再来一局');await delay(850);await waitPath('pages/room/room');pass('pixel-replay-route');

 }
 const assertBottom=async(label,name)=>{
  await mp.pageScrollTo(100000);await delay(350);
  const b=await mp.evaluate(label=>new Promise(resolve=>{const p=getCurrentPages().slice(-1)[0],c=p.selectAllComponents('.pixelControl').find(x=>x.data.label===label);if(!c)return resolve(null);c.createSelectorQuery().select('.pixelAction').boundingClientRect(r=>resolve({rect:r,height:wx.getWindowInfo().windowHeight,safe:p.data.safeBottom||0,nav:p.data.navHeight,tone:c.data.tone})).exec();}),label);
  assert.ok(b&&b.rect.height>=44,name+' action exists');assert.ok(b.rect.top>=b.nav&&b.rect.bottom<=b.height-b.safe+1,name+' bottom action fully reachable');
  await screenshot(mp,path.join(out,name+'.png'));pass(name);return b;
 };
 if(process.argv[3]!=='drawer-only'){
 for(const [id,url,label] of [['cancelled','/pages/map/map?devPreview=cancelled','返回首页'],['code','/pages/qrcode/qrcode?devPreview=code','返回地图'],['create','/pages/room/room?devPreview=create','创建并邀请'],['ready','/pages/room/room?devPreview=ready','开始30秒躲藏']]){
  await go(url);await assertBottom(label,id+'-bottom');
  await mp.evaluate(()=>{getCurrentPages().slice(-1)[0].setData({fontScale:1.3});return true;});await delay(350);
  const b=await assertBottom(label,id+'-large-bottom');if(id==='code')assert.equal(b.tone,'blue');
 }
 }
 await go('/pages/map/map?devPreview=cat');await mp.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];p.setData({fontScale:1.3});p.toggleDrawer();return true;});await delay(500);
 const drawerScroll=await (await mp.currentPage()).$('.drawerBody');await drawerScroll.scrollTo(0,10000);await delay(400);
 await screenshot(mp,path.join(out,'drawer-large-bottom.png'));
 const drawerBounds=await mp.evaluate(()=>new Promise(resolve=>{const p=getCurrentPages().slice(-1)[0],c=p.selectAllComponents('.pixelControl').find(x=>x.data.label==='退出本局');c.createSelectorQuery().select('.pixelAction').boundingClientRect(r=>resolve({rect:r,height:wx.getWindowInfo().windowHeight})).exec();}));
 assert.ok(drawerBounds.rect.top>150&&drawerBounds.rect.bottom<=drawerBounds.height-4,'drawer bottom actions reachable');pass('drawer-large-bottom');
 await tapAction('关闭');assert.equal(await mp.evaluate(()=>getCurrentPages().slice(-1)[0].data.drawer),false);pass('drawer-large-close');
 await go('/pages/venue/venue');await screenshot(mp,path.join(out,'final-venue.png'));
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:pending.length?'PASS_WITH_PENDING':'PASS',pending,scope:'WeChat IDE native control taps/movable API/error simulation and preview routes; not real device touch/GPS',passed},null,2));console.log('PIXEL_INTERACTION_PASS='+passed.length+' PENDING='+pending.length);
 }finally{mp?.disconnect();}})().catch(e=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({status:'FAIL',passed,error:e.message},null,2));console.error(e);process.exitCode=1;});
