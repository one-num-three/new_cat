const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const s=require('./serve.cjs')();await new Promise(r=>s.listen(0,'127.0.0.1',r));const b=await chromium.launch({channel:'msedge',headless:true});const errors=[];try{
 const p=await b.newPage({viewport:{width:1500,height:1100}});p.on('pageerror',e=>errors.push(e.message));const url='http://127.0.0.1:'+s.address().port;
 await p.goto(url);await p.waitForFunction(()=>window.READY);
 for(const key of ['jiulonghu','sipailou']){
  await p.selectOption('#campus',key);await p.waitForFunction(k=>window.READY&&window.currentModel.image.file===k+'-art.png',key);
  await p.selectOption('#pick','0');assert((await p.locator('#info').innerText()).includes('WGS84'));
  await p.locator('#mesh').check();await p.locator('#mesh').uncheck();
  await p.screenshot({path:path.join(__dirname,key+'-review.png'),fullPage:true});
  await p.locator('#art').click({position:{x:1,y:1}});assert((await p.locator('#info').innerText()).includes('范围以外'));
 }
 await p.setViewportSize({width:390,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:path.join(__dirname,'mobile-review.png'),fullPage:true});
 for(const config of ['baseline.json','rollback-test.json']){await p.goto(url+'/?config='+config);await p.waitForFunction(()=>window.READY);assert((await p.locator('#info').innerText()).includes('UNREGISTERED'));}
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(__dirname,'browser-results.json'),JSON.stringify({pass:true,campusSwitch:true,anchorSelection:true,meshToggle:true,outsideRejected:true,mobileLayout:true,baselineRollbackDisabled:true,pageErrors:errors},null,2));console.log('BROWSER_PASS campuses=2 switch anchors mesh outside mobile baseline rollback errors=0');
}finally{await b.close();s.close();}})().catch(e=>{console.error(e);process.exit(1);});
