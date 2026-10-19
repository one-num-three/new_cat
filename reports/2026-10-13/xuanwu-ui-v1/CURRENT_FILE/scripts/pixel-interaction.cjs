'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const automator=require('../cat-mouse-server/node_modules/miniprogram-automator');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{let mp;const passed=[];try{
 mp=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});
 const go=async url=>{await mp.callWxMethod('reLaunch',{url});for(let i=0;i<30;i++){const route=await mp.evaluate(()=>getCurrentPages().slice(-1)[0]?.route || '');if(route===url.slice(1).split('?')[0]){await delay(800);return;}await delay(250);}throw Error('Route did not settle: '+url);};
 await go('/pages/venue/venue');
 for(let i=0;i<30;i++){if(await mp.evaluate(()=>!!getCurrentPages().slice(-1)[0]?.selectComponent('venue-art')?.data.fitReady))break;await delay(250);}
 const get=()=>mp.evaluate(()=>{const c=getCurrentPages().slice(-1)[0].selectComponent('venue-art');return {state:c.data.imageState,scale:c.data.scaleValue,x:c.data.x,y:c.data.y,w:c.data.fitWidth,h:c.data.fitHeight,camera:c._camera,serial:c._cameraSerial};});
 let state=await get();assert.equal(state.state,'ready');assert.equal(state.scale,1);passed.push('venue-loaded');
 let p=await mp.currentPage(),c=await p.$('venue-art'),buttons=await c.$$('.venueStep');await buttons[1].tap();await delay(500);state=await get();assert.equal(state.scale,1.25);passed.push('native-plus-tap');
 const beforeMove={...state.camera};const mv=await (await (await mp.currentPage()).$('venue-art')).$('.venueMovableView');await mv.moveTo(state.x-20,state.y-20);await delay(500);
 state=await get();assert.ok(Number.isFinite(state.camera.x)&&Number.isFinite(state.camera.y));assert.ok(Math.abs(state.camera.x-beforeMove.x)>.5||Math.abs(state.camera.y-beforeMove.y)>.5,'native pan must actually move');
 await mp.evaluate(()=>{const c=getCurrentPages().slice(-1)[0].selectComponent('venue-art');c.onGestureEnd({currentTarget:{dataset:{camera:c._cameraSerial}},touches:[]});return true;});await delay(200);passed.push('native-movable-pan');
 await mp.screenshot({path:path.join(out,'venue-zoom-pan.png')});
 c=await (await mp.currentPage()).$('venue-art');await (await c.$('.venueReset')).tap();await delay(400);state=await get();assert.equal(state.scale,1);passed.push('native-reset-tap');
 const image=await (await (await mp.currentPage()).$('venue-art')).$('.venueImage');await image.trigger('error',{});await delay(200);state=await get();assert.equal(state.state,'error');
 await mp.screenshot({path:path.join(out,'venue-load-error.png')});
 await (await (await (await mp.currentPage()).$('venue-art')).$('.venueRetry')).tap();await delay(900);state=await get();assert.equal(state.state,'ready');passed.push('native-error-retry');
 await go('/pages/index/index?devPreview=home');await mp.pageScrollTo(10000);await delay(300);await (await (await mp.currentPage()).$('.venueEntry')).tap();await delay(800);assert.equal((await mp.currentPage()).path,'pages/venue/venue');passed.push('home-guide-entry');
 await go('/pages/dev/dev');await (await (await mp.currentPage()).$('.venuePreviewEntry')).tap();await delay(800);assert.equal((await mp.currentPage()).path,'pages/venue/venue');passed.push('gallery-guide-entry');
 await go('/pages/map/map?devPreview=mouse');const before=await mp.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];return {id:p.data.match.id,artMode:p.data.artMode};});
 await mp.evaluate(()=>{getCurrentPages().slice(-1)[0].toggleMapMode();return true;});const after=await mp.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];return {id:p.data.match.id,artMode:p.data.artMode};});assert.deepEqual(after,before);passed.push('preview-never-fakes-live-map');
 await mp.evaluate(()=>{getCurrentPages().slice(-1)[0].showCode();return true;});await delay(700);assert.equal((await mp.currentPage()).path,'pages/qrcode/qrcode');passed.push('capture-code-route-preserved');
 
 const tapAction=async label=>{const cs=await (await mp.currentPage()).$$('pixel-action');for(const c of cs){if(await c.data('label')===label){await (await c.$('.pixelAction')).tap();return;}}throw Error('Missing action '+label);};
 await go('/pages/index/index?devPreview=home');
 p=await mp.currentPage();await (await p.$('.homeInput')).input('小橘');await (await p.$('.codeInput')).input('A1B2C3D4E5');await tapAction('加入房间');await delay(850);assert.equal((await mp.currentPage()).path,'pages/room/room');passed.push('pixel-join-binding');
 await tapAction('取消准备');await delay(200);let r=await mp.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];return {route:p.route,canStart:p.data.canStart,ready:p.data.ready};});assert.equal(r.canStart,false);await tapAction('等待所有人准备');await delay(200);assert.equal((await mp.currentPage()).path,'pages/room/room');passed.push('pixel-disabled-start');
 await tapAction('定位并准备');await delay(250);await tapAction('开始30秒躲藏');await delay(900);assert.equal((await mp.currentPage()).path,'pages/map/map');passed.push('pixel-ready-start');
 await tapAction('队伍·规则');await delay(250);assert.equal(await mp.evaluate(()=>getCurrentPages().slice(-1)[0].data.drawer),true);await tapAction('关闭');await delay(150);assert.equal(await mp.evaluate(()=>getCurrentPages().slice(-1)[0].data.drawer),false);passed.push('pixel-drawer-close');
 await go('/pages/map/map?devPreview=catWin');await tapAction('再来一局');await delay(850);assert.equal((await mp.currentPage()).path,'pages/room/room');passed.push('pixel-replay-route');

 const assertBottom=async(label,name)=>{
  await mp.pageScrollTo(100000);await delay(350);
  const b=await mp.evaluate(label=>new Promise(resolve=>{const p=getCurrentPages().slice(-1)[0],c=p.selectAllComponents('pixel-action').find(x=>x.data.label===label);if(!c)return resolve(null);c.createSelectorQuery().select('.pixelAction').boundingClientRect(r=>resolve({rect:r,height:wx.getWindowInfo().windowHeight,nav:p.data.navHeight,tone:c.data.tone})).exec();}),label);
  assert.ok(b&&b.rect.height>=44,name+' action exists');assert.ok(b.rect.top>=b.nav&&b.rect.bottom<=b.height-4,name+' bottom action fully reachable');
  await mp.screenshot({path:path.join(out,name+'.png')});passed.push(name);return b;
 };
 for(const [id,url,label] of [['cancelled','/pages/map/map?devPreview=cancelled','返回首页'],['code','/pages/qrcode/qrcode?devPreview=code','返回地图'],['create','/pages/room/room?devPreview=create','创建活动'],['ready','/pages/room/room?devPreview=ready','开始30秒躲藏']]){
  await go(url);await assertBottom(label,id+'-bottom');
  await mp.evaluate(()=>{getCurrentPages().slice(-1)[0].setData({fontScale:1.3});return true;});await delay(350);
  const b=await assertBottom(label,id+'-large-bottom');if(id==='code')assert.equal(b.tone,'blue');
 }
 await go('/pages/map/map?devPreview=cat');await mp.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];p.setData({fontScale:1.3});p.toggleDrawer();return true;});await delay(500);
 const drawerScroll=await (await mp.currentPage()).$('.drawerBody');await drawerScroll.scrollTo(0,10000);await delay(400);
 await mp.screenshot({path:path.join(out,'drawer-large-bottom.png')});
 const drawerBounds=await mp.evaluate(()=>new Promise(resolve=>{const p=getCurrentPages().slice(-1)[0],c=p.selectAllComponents('pixel-action').find(x=>x.data.label==='退出本局');c.createSelectorQuery().select('.pixelAction').boundingClientRect(r=>resolve({rect:r,height:wx.getWindowInfo().windowHeight})).exec();}));
 assert.ok(drawerBounds.rect.top>150&&drawerBounds.rect.bottom<=drawerBounds.height-4,'drawer bottom actions reachable');passed.push('drawer-large-bottom');
 await tapAction('关闭');assert.equal(await mp.evaluate(()=>getCurrentPages().slice(-1)[0].data.drawer),false);passed.push('drawer-large-close');
 await go('/pages/venue/venue');await mp.screenshot({path:path.join(out,'final-venue.png')});
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',scope:'WeChat IDE native control taps/movable API/error simulation and preview routes; not real device touch/GPS',passed},null,2));console.log('PIXEL_INTERACTION_PASS='+passed.length);
 }finally{mp?.disconnect();}})().catch(e=>{console.error(e);process.exitCode=1;});
