'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const automator=require('../cat-mouse-server/node_modules/miniprogram-automator');
const screenshot=require('./wechat-screenshot.cjs');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const mp=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'}),records=[];
 try{
  for(const mode of ['normal','large','narrow']){
   await mp.callWxMethod('reLaunch',{url:'/pages/dev/dev'});await delay(1000);
   if(mode==='large')await mp.evaluate(()=>getCurrentPages().slice(-1)[0].setData({fontScale:1.3}));
   if(mode==='narrow')await mp.evaluate(()=>getCurrentPages().slice(-1)[0].onResize({size:{windowWidth:320,windowHeight:693}}));
   await delay(1000);
   const metrics=await mp.evaluate(()=>new Promise(resolve=>{
    const p=getCurrentPages().slice(-1)[0],q=wx.createSelectorQuery().in(p);
    q.selectAll('.previewItem').boundingClientRect();q.selectAll('.entryTitle').boundingClientRect();q.select('.devTitle').boundingClientRect();
    q.exec(r=>resolve({route:p.route,width:p.data.viewportWidth,fontScale:p.data.fontScale,buttons:r[0],labels:r[1],title:r[2]}));
   }));
   assert.equal(metrics.route,'pages/dev/dev');assert.equal(metrics.buttons.length,14);assert.equal(metrics.labels.length,14);
   for(let i=0;i<14;i++){
    const b=metrics.buttons[i],t=metrics.labels[i];assert.ok(b.width>100&&b.height>=43);
    assert.ok(b.left>=0&&b.right<=metrics.width+1,'button overflow');
    assert.ok(t.left>=b.left&&t.right<=b.right&&t.top>=b.top&&t.bottom<=b.bottom,'label overflow');
   }
   assert.ok(metrics.title.right<=metrics.width,'title overflow');
   await screenshot(mp,path.join(out,mode+'.png'));records.push({mode,...metrics});
  }
  await mp.callWxMethod('reLaunch',{url:'/pages/dev/dev'});await delay(1000);
  const p=await mp.currentPage();await (await p.$('.previewItem')).tap();await delay(1000);
  const route=await mp.evaluate(()=>getCurrentPages().slice(-1)[0].route);assert.equal(route,'pages/index/index');
  await mp.callWxMethod('reLaunch',{url:'/pages/dev/dev'});await delay(700);
  fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({status:'PASS',records,firstButtonRoute:route,scope:'IDE only; large=app1.3, narrow=320 content inside390 simulator'},null,2));
  console.log('FUSION_FONT_UI_PASS=3 BUTTON_NAVIGATION_PASS=1');
 }finally{mp.disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1;});
