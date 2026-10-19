'use strict';
const {chromium}=require('playwright');const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const server=require('./serve.cjs')();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage({viewport:{width:1500,height:1120},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.waitForFunction(()=>window.READY===true);
 await page.selectOption('#anchor','16');assert((await page.locator('#info').innerText()).includes('C3'));
 await page.locator('#mesh').check();await page.locator('#mesh').uncheck();
 await page.locator('#shore').check();await page.locator('#shore').uncheck();
 await page.locator('#opacity').fill('1');await page.locator('#opacity').dispatchEvent('input');
 await page.screenshot({path:path.join(__dirname,'registration-review.png'),fullPage:true});
 const raster=await page.evaluate(()=>window.exportRaster());fs.writeFileSync(path.join(__dirname,'registered-north-up.png'),Buffer.from(raster.split(',')[1],'base64'));
 const meta=await page.evaluate(()=>window.viewMeta);fs.writeFileSync(path.join(__dirname,'registered-north-up.pgw'),meta.worldFile.join('\n')+'\n');fs.writeFileSync(path.join(__dirname,'raster-georeference.json'),JSON.stringify({...meta,crs:'EPSG:3857',domain:'triangulation hull only; transparent outside',coordinateType:'OSM/image registration; not field validated'},null,2)+'\n');
 await page.locator('#lines').uncheck();await page.locator('#points').uncheck();await page.screenshot({path:path.join(__dirname,'art-style-review.png'),fullPage:true});
 await page.locator('#art').click({position:{x:10,y:10}});assert((await page.locator('#info').innerText()).includes('范围以外'));
 await page.locator('#art').click({position:{x:350,y:350}});assert((await page.locator('#info').innerText()).includes('WGS84'));
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'mobile-review.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 for(const config of ['baseline.json','rollback-test.json']){
  await page.goto(`http://127.0.0.1:${server.address().port}/?config=${config}`);await page.waitForFunction(()=>window.READY===true);
  assert((await page.locator('#info').innerText()).includes('UNREGISTERED'));assert(await page.locator('#export').isDisabled());
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(__dirname,'browser-results.json'),JSON.stringify({pass:true,pageErrors:errors,anchorSelection:true,layerToggles:true,clickRoundtrip:true,outsideHullRejected:true,mobileNoHorizontalOverflow:true,rasterExport:true,baselineAndRollbackMappingDisabled:true},null,2)+'\n');
 console.log('BROWSER_PASS anchor_select layers click_mapping outside_guard mobile_layout raster_export baseline_rollback_disabled errors=0');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
