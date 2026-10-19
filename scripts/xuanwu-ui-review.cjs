'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const automator=require('../cat-mouse-server/node_modules/miniprogram-automator');
const out=path.resolve(process.argv[2]),mode=process.argv[3]||'normal',selected=process.argv[4]||'all';
const cases=[{id:'venue',url:'/pages/venue/venue'},{id:'home',url:'/pages/index/index?devPreview=home'},{id:'gallery',url:'/pages/dev/dev'},...require('../utils/dev-preview').cases.filter(x=>x.path.includes('/map/')).map(x=>({id:x.id,url:x.path})),{id:'drawer',url:'/pages/map/map?devPreview=cat'}];
const delay=ms=>new Promise(r=>setTimeout(r,ms));let mp;const records=[];
fs.mkdirSync(out,{recursive:true});
async function inspect(item){
 mp=mp||await automator.connect({wsEndpoint:'ws://127.0.0.1:9420'});
 await mp.callWxMethod('reLaunch',{url:item.url});await delay(1000);
 const initial=await mp.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];return {route:p.route,preview:p.data.devPreview,window:wx.getWindowInfo()};});
 assert.equal(initial.route,item.url.slice(1).split('?')[0]);
 if(item.id==='drawer')await mp.evaluate(()=>{getCurrentPages().slice(-1)[0].toggleDrawer();return true;});
 if(mode==='narrow')await mp.evaluate(()=>{getCurrentPages().slice(-1)[0].onResize({size:{windowWidth:320,windowHeight:693}});return true;});
 if(mode==='large')await mp.evaluate(()=>{const p=getCurrentPages().slice(-1)[0];p.setData({fontScale:1.3,layoutKey:(p.data.layoutKey||'')+':large'});return true;});
 await delay(1000);
 const result=await mp.evaluate(()=>new Promise(resolve=>{
  const p=getCurrentPages().slice(-1)[0],c=p.selectComponent('venue-art');
  const sels=['.mapCanvas','.hudStack','.bottomPanel','.mapModeBar','.venueFrame','.venueHeading','.venueBack','.drawer'];
  const q=wx.createSelectorQuery();sels.forEach(s=>q.selectAll(s).boundingClientRect());
  q.exec(boxes=>{const page={route:p.route,preview:!!p.data.devPreview,artMode:p.data.artMode,width:p.data.viewportWidth,height:p.data.viewportHeight,font:p.data.fontScale,uiState:p.data.uiState,clock:p.data.clock,summary:p.data.resultSummary,boxes:Object.fromEntries(sels.map((s,i)=>[s,boxes[i]]))};
   if(!c){resolve({page,component:null});return;}
   const cs=['.venueViewport','.venueImage','.venueControl','.venueAttribution','.venueStatus'];const cq=c.createSelectorQuery();cs.forEach(s=>cq.selectAll(s).boundingClientRect());
   cq.exec(b=>resolve({page,component:{src:c.data.src,imageState:c.data.imageState,fitReady:c.data.fitReady,width:c.data.fitWidth,height:c.data.fitHeight,x:c.data.x,y:c.data.y,scale:c.data.scaleValue,boxes:Object.fromEntries(cs.map((s,i)=>[s,b[i]]))}}));
  });
 }));
 assert.equal(result.page.font,mode==='large'?1.3:1);
 if(mode==='narrow'){assert.equal(result.page.width,320);assert.equal(result.page.height,693);}
 const {page,component:c}=result;
 if(c){
  assert.equal(c.src,'/assets/maps/xuanwu-lake-v3.png');assert.equal(c.imageState,'ready');assert.equal(c.fitReady,true);
  assert.ok(Math.abs(c.width/c.height-1154/1363)<.002,'intrinsic ratio');
  const v=c.boxes['.venueViewport'][0],i=c.boxes['.venueImage'][0];assert.ok(v.width>0&&v.height>0);
  assert.ok(i.left>=v.left-1&&i.right<=v.right+1&&i.top>=v.top-1&&i.bottom<=v.bottom+1,'complete art must fit viewport');
  for(const b of c.boxes['.venueControl'])assert.ok(b.width>=40&&b.height>=40&&b.right<=page.width+1,'map controls must stay usable');
 }
 const canvas=page.boxes['.mapCanvas'][0],panel=page.boxes['.bottomPanel'][0];
 if(canvas&&panel){assert.ok(canvas.height>=120);assert.ok(canvas.bottom<=panel.top+1);assert.ok(panel.bottom<=page.height+1,'bottom panel clipped');}
 if(item.id==='paused')assert.equal(page.clock,'04:45');if(item.id==='offline')assert.equal(page.clock,'--:--');
 await delay(500);await mp.screenshot({path:path.join(out,item.id+'.png')});
 return {id:item.id,mode,...result,screenshot:path.join(out,item.id+'.png')};
}
(async()=>{try{for(const item of cases.filter(c=>selected==='all'||selected.split(',').includes(c.id))){console.log('ROUTE '+item.id);let r;for(let n=0;n<2;n++){try{r=await inspect(item);break;}catch(e){if(n||!/timeout|rawPath/.test(e.message))throw e;console.log('TRANSPORT_RECONNECT '+item.id+' '+e.message);mp?.disconnect();mp=null;await delay(1000);}}records.push(r);fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({status:'IN_PROGRESS',records},null,2));console.log('PASS '+item.id);}fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({status:'PASS',scope:'WeChat IDE rendered preview; no physical GPS or calibration claim',records},null,2));console.log('XUANWU_UI_PASS='+records.length+' MODE='+mode);}finally{mp?.disconnect();}})().catch(e=>{console.error(e);process.exitCode=1;});
