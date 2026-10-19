const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const automator=require('../cat-mouse-server/node_modules/miniprogram-automator'),shot=require('./wechat-screenshot.cjs');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const mp=await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});try{
 await mp.callWxMethod('reLaunch',{url:'/pages/room/room?devPreview=create'});await wait(1800);let p=await mp.currentPage();
 assert.equal(p.path,'pages/room/room');
 await (await p.$('[data-field="total"]')).input('10');await wait(300);assert.ok(await p.data('teamError'));
 await shot(mp,path.join(out,'invalid-sum.png'));
 await (await p.$('[data-field="catsCount"]')).input('3');await (await p.$('[data-field="miceCount"]')).input('7');await wait(300);
 assert.equal(await p.data('teamError'),'');assert.equal(await p.data('targetCount'),5);await shot(mp,path.join(out,'custom-create.png'));
 const components=await p.$$('.pixelControl');await (await components[0].$('.pixelAction')).tap();await wait(300);await (await components[1].$('.pixelAction')).tap();await wait(500);
 assert.equal((await p.data('rules')).cats,3);assert.equal((await p.data('rules')).mice,7);assert.equal((await p.data('roster')).length,10);assert.equal(await p.data('targetCount'),5);
 await shot(mp,path.join(out,'custom-ready.png'));
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',total:10,cats:3,mice:7,target:5,roster:10,scope:'IDE sample UI only, real HTTP database flow separately tested'},null,2));
 console.log('CUSTOM_TEAMS_UI_PASS total=10 cats=3 mice=7 target=5');
 }finally{mp.disconnect();}})().catch(e=>{console.error(e);process.exitCode=1;});
