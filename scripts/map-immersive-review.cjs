'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const automator=require('../cat-mouse-server/node_modules/miniprogram-automator');
const screenshot=require('./wechat-screenshot.cjs');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const passed=[];let mp;
function pass(name){passed.push(name);fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify({passed},null,2));}
async function inspect(){return mp.evaluate(()=>new Promise(resolve=>{const p=getCurrentPages().slice(-1)[0],c=p.selectComponent('.venueArt');if(!c)return resolve(null);const q=c.createSelectorQuery();q.select('.venueViewport').boundingClientRect();q.select('.venueImage').boundingClientRect();q.exec(b=>resolve({route:p.route,mode:c.data.mode,scale:c.data.scaleValue,controls:c.data.showControls,timer:c._tourTimer!=null,camera:c._sample(),segment:c._segment,viewport:b[0],image:b[1]}));}));}
function covers(s){const v=s.viewport,i=s.image;assert.ok(i.left<=v.left+2&&i.right>=v.right-2&&i.top<=v.top+2&&i.bottom>=v.bottom-2,'no blank bands');assert.ok(Math.abs(i.width/i.height-1)<.01,'uniform square scale');}
(async()=>{try{
 mp=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});
 if(process.argv[3]!=='existing'){await mp.callWxMethod('reLaunch',{url:'/pages/map/map?devPreview=cat'});}await wait(2000);
 let s;for(let i=0;i<30;i++){s=await inspect();if(s&&s.image&&s.segment)break;await wait(200);}assert.ok(s&&s.image&&s.segment,'loaded auto-tour component');assert.equal(s.mode,'auto');assert.equal(s.controls,false);covers(s);pass('fullbleed-auto-start');
 const a=s.image;await wait(1300);s=await inspect();covers(s);assert.ok(Math.abs(a.left-s.image.left)>2||Math.abs(a.top-s.image.top)>2);pass('native-animation-actually-moves');
 await screenshot(mp,path.join(out,'auto.png'));
 let p=await mp.currentPage(),component=await p.$('.venueArt'),view=await component.$('.venueViewport');s=await inspect();
 const touch={identifier:1,clientX:s.viewport.left+s.viewport.width/2,clientY:s.viewport.top+s.viewport.height/2};touch.pageX=touch.clientX;touch.pageY=touch.clientY;
 await view.touchstart({touches:[touch],changeTouches:[touch]});await wait(100);s=await inspect();assert.equal(s.mode,'manual');assert.equal(s.timer,false);assert.equal(s.controls,true);pass('touch-immediately-stops-tour');
 const before={...s.camera};const moved={...touch,clientX:touch.clientX-40,pageX:touch.pageX-40,clientY:touch.clientY-30,pageY:touch.pageY-30};
 await view.touchmove({touches:[moved],changeTouches:[moved]});await view.touchend({touches:[],changeTouches:[moved]});await wait(150);s=await inspect();covers(s);assert.ok(Math.abs(s.camera.x-before.x)>2||Math.abs(s.camera.y-before.y)>2);pass('native-one-finger-pan');
 const pointA={...touch,identifier:1,clientX:touch.clientX-40,pageX:touch.pageX-40},pointB={...touch,identifier:2,clientX:touch.clientX+40,pageX:touch.pageX+40};
 await view.touchstart({touches:[pointA,pointB],changeTouches:[pointA,pointB]});const wideA={...pointA,clientX:pointA.clientX-25,pageX:pointA.pageX-25},wideB={...pointB,clientX:pointB.clientX+25,pageX:pointB.pageX+25};const oldScale=s.scale;
 await view.touchmove({touches:[wideA,wideB],changeTouches:[wideA,wideB]});await view.touchend({touches:[],changeTouches:[wideA,wideB]});await wait(200);s=await inspect();assert.ok(s.scale>oldScale);covers(s);pass('native-two-finger-pinch');
 const stopped={...s.camera};await wait(1000);s=await inspect();assert.deepEqual(s.camera,stopped);assert.equal(s.timer,false);pass('manual-camera-stays-stopped');
 await screenshot(mp,path.join(out,'manual.png'));
 component=await (await mp.currentPage()).$('.venueArt');await (await component.$('.venueReset')).tap();await wait(150);s=await inspect();assert.equal(s.scale,1);covers(s);pass('center-still-fills-image');
 await (await component.$('.venueTour')).tap();await wait(150);s=await inspect();assert.equal(s.mode,'auto');assert.equal(s.timer,true);pass('explicit-resume-tour');
 await mp.callWxMethod('reLaunch',{url:'/pages/dev/dev'});await wait(800);assert.equal((await mp.currentPage()).path,'pages/dev/dev');pass('leave-map');
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',passed,scope:'WeChat IDE actual native animations/touches and MCP screenshots, not physical-device GPS'},null,2));console.log('IMMERSIVE_INTERACTION_PASS='+passed.length);
 }finally{mp?.disconnect();}})().catch(e=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({status:'FAIL',passed,error:e.message},null,2));console.error(e);process.exitCode=1;});
