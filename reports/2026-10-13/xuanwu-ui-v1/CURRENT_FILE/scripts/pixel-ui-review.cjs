'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const automator=require('../cat-mouse-server/node_modules/miniprogram-automator');
const out=path.resolve(process.argv[2]),mode=process.argv[3]||'normal',selected=process.argv[4]||'all';
const cases=[{id:'venue',url:'/pages/venue/venue'},{id:'home',url:'/pages/index/index?devPreview=home'},{id:'gallery',url:'/pages/dev/dev'},...require('../utils/dev-preview').cases.filter(x=>x.id!=='home').map(x=>({id:x.id,url:x.path})),{id:'drawer',url:'/pages/map/map?devPreview=cat'}];
const pixelAssets=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../design/2026-10-13/pixel-runtime-v1/manifest.json'),'utf8')).records;
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
 const readySelector=item.id==='ready'?'.playerCard':item.id==='code'?'.qrCard':item.id==='venue'?'.venueHeading':item.id==='home'?'.homeHero':item.id==='create'?'.roomHero':'.mapPage';
 if(item.id!=='gallery'){
  let ready=false;
  for(let attempt=0;attempt<30;attempt++){
   const count=await mp.evaluate(selector=>new Promise(resolve=>{const p=getCurrentPages().slice(-1)[0];if(!p)return resolve(0);wx.createSelectorQuery().in(p).selectAll(selector).boundingClientRect(r=>resolve((r||[]).filter(b=>b.width>0&&b.height>0).length)).exec();}),readySelector);
   if(count===(item.id==='ready'?8:1)){ready=true;break;}await delay(250);
  }
  assert.ok(ready,item.id+' rendered '+readySelector+' did not settle; check IDE compilation and disk space');
 }
 const result=await mp.evaluate(()=>new Promise(resolve=>{
  const p=getCurrentPages().slice(-1)[0],c=p.selectComponent('venue-art');
  const sels=['.mapCanvas','.hudStack','.bottomPanel','.mapModeBar','.venueFrame','.venueHeading','.venueBack','.drawer','.homeHero','.homeFooter','.roomHero','.codeRole','.pauseHero','.resultHero','.hidingArt','.homeInput','.roomCode','.rosterGrid','.playerCard','.venueEntry','.qrCard','.demoArt'];
  const q=wx.createSelectorQuery().in(p);sels.forEach(s=>q.selectAll(s).boundingClientRect());
  q.exec(boxes=>{const page={route:p.route,preview:!!p.data.devPreview,artMode:p.data.artMode,width:p.data.viewportWidth,height:p.data.viewportHeight,font:p.data.fontScale,uiState:p.data.uiState,clock:p.data.clock,summary:p.data.resultSummary,boxes:Object.fromEntries(sels.map((s,i)=>[s,boxes[i]]))};
   if(!c){resolve({page,component:null});return;}
   const cs=['.venueViewport','.venueImage','.venueControl','.venueAttribution','.venueStatus'];const cq=c.createSelectorQuery();cs.forEach(s=>cq.selectAll(s).boundingClientRect());
   cq.exec(b=>resolve({page,component:{src:c.data.src,imageState:c.data.imageState,fitReady:c.data.fitReady,width:c.data.fitWidth,height:c.data.fitHeight,x:c.data.x,y:c.data.y,scale:c.data.scaleValue,boxes:Object.fromEntries(cs.map((s,i)=>[s,b[i]]))}}));
  });
 }));
 assert.equal(result.page.font,mode==='large'?1.3:1);
 if(mode==='narrow'){assert.equal(result.page.width,320);assert.equal(result.page.height,693);}
 const actions=await mp.evaluate(()=>new Promise(resolve=>{const p=getCurrentPages().slice(-1)[0],cs=p.selectAllComponents('pixel-action');Promise.all(cs.map(c=>new Promise(done=>{const q=c.createSelectorQuery();q.select('.pixelAction').boundingClientRect();q.select('.actionArt').boundingClientRect();q.exec(b=>done({skin:c.data.skin,label:c.data.label,disabled:c.data.disabled,loading:c.data.loading,dynamic:c.data.dynamic,fontScale:c.data.fontScale,failed:c.data.artFailed,width:c.data.artWidth,height:c.data.artHeight,button:b[0],image:b[1]}));}))).then(resolve);}));
 result.actions=actions;
 const {page,component:c}=result;
 const artClasses={'.homeHero':'home-hero','.homeFooter':'home-footer','.roomHero':item.id==='ready'?'ready-hero':'create-hero','.codeRole':'code-role','.pauseHero':item.id==='paused'?'paused-scene':'offline-hero','.resultHero':item.id==='catWin'?'catwin-hero':item.id==='mouseWin'?'mousewin-hero':'cancelled-hero','.hidingArt':'hiding-scene','.demoArt':'code-demo-art'};
 result.imageChecks=[];
 for(const [selector,id]of Object.entries(artClasses)){const a=pixelAssets.find(x=>x.id===id);for(const b of page.boxes[selector]||[]){const error=Math.abs((b.width/b.height)/(a.width/a.height)-1);assert.ok(error<.015,item.id+' '+selector+' distorted');result.imageChecks.push({id,selector,width:b.width,height:b.height,intrinsic:[a.width,a.height],ratioError:error});}}
 if(item.id==='ready'){const cards=page.boxes['.playerCard'];assert.equal(cards.length,8);assert.ok(Math.abs(cards[0].top-cards[1].top)<2&&cards[1].left>cards[0].left,'ready roster must render as two columns');}
 if(item.id==='home'){const entry=page.boxes['.venueEntry'][0];assert.ok(entry.width>page.width*.8,'guide entry must not shrink to native default button width');}
 
 for(const a of actions){assert.equal(a.failed,false,'skin load failed '+a.skin);assert.ok(a.button.height>=43,'minimum action height');assert.ok(a.button.left>=-2&&a.button.right<=page.width+2,'action horizontal overflow '+a.label);if(a.image)assert.ok(Math.abs((a.image.width/a.image.height)/(a.width/a.height)-1)<.015,'button art distorted '+a.label);}
 
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
(async()=>{try{for(const item of cases.filter(c=>selected==='all'||selected.split(',').includes(c.id))){console.log('ROUTE '+item.id);let r;for(let n=0;n<2;n++){try{r=await inspect(item);break;}catch(e){if(n||!/timeout|rawPath/.test(e.message))throw e;console.log('TRANSPORT_RECONNECT '+item.id+' '+e.message);mp?.disconnect();mp=null;await delay(1000);}}records.push(r);fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({status:'IN_PROGRESS',records},null,2));console.log('PASS '+item.id);}fs.writeFileSync(path.join(out,'metrics.json'),JSON.stringify({status:'PASS',scope:'WeChat IDE rendered preview; no physical GPS or calibration claim',records},null,2));console.log('PIXEL_UI_PASS='+records.length+' MODE='+mode);}finally{mp?.disconnect();}})().catch(e=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({status:'FAIL',error:e.message,passedIds:records.map(r=>r.id)},null,2));console.error(e);process.exitCode=1;});
