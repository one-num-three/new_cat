'use strict';
// Capture current real WeChat UI using explicit existing preview fixtures. No desktop window actions.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),plan=JSON.parse(fs.readFileSync(path.join(root,'reports/2026-10-19/product-handoff-v1/capture-plan.json'),'utf8'));
const out=path.resolve(process.argv[2]),only=process.argv[3];fs.mkdirSync(out,{recursive:true});let seq=Date.now(),rows=[];
if(fs.existsSync(path.join(out,'verification.json')))rows=JSON.parse(fs.readFileSync(path.join(out,'verification.json'),'utf8'));
const shell='C:/Users/Keke_/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';
function call(tool,args){const n=++seq,file=path.join(out,'command-'+n+'.json');fs.writeFileSync(file,JSON.stringify({tool,project:root,args}));const r=cp.spawnSync(shell,['-NoProfile','-File',path.join(root,'scripts/wechat-mcp-command.ps1'),'-InputFile',file],{encoding:'utf8',timeout:45000});fs.writeFileSync(path.join(out,'call-'+n+'.log'),(r.stdout||'')+(r.stderr||''));assert.equal(r.status,0,r.stderr);const j=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));assert.ok(j.ok&&j.result.success,JSON.stringify(j));return j.result;}
function evaluate(fn,...args){const file=path.join(out,'args-'+(++seq)+'.json');fs.writeFileSync(file,JSON.stringify(args));return call('automation_evaluate',{'fn-source':fn.toString().replace(/\r?\n/g,' '),'args-file':file}).result.result;}
function ready(entry){return evaluate(function(route){return new Promise(resolve=>{let tries=0;function check(){const p=getCurrentPages().slice(-1)[0],c=p&&p.selectComponent('.venueArt');if(!p||p.route!==route||p.data.venueResource==='loading'||(c&&c.data.imageState!=='ready')){if(++tries>=60){resolve({ready:false,route:p&&p.route,image:c&&c.data.imageState});return;}setTimeout(check,100);return;}const q=wx.createSelectorQuery().in(p);q.selectAll('image').boundingClientRect();q.exec(rects=>resolve({ready:true,route:p.route,devPreview:!!p.data.devPreview,previewCase:p.previewCase||'',mapId:p.data.mapId||p.data.venueMapId||null,venueName:p.data.venueName||null,roomId:p.data.roomId||null,total:p.data.total||null,role:p.data.match&&p.data.match.myRole,phase:p.data.match&&p.data.match.phase,uiState:p.data.uiState||null,drawer:p.data.drawer||false,drawerTab:p.data.drawerTab||null,codeOpen:p.data.codeOpen||false,trayExpanded:p.data.trayExpanded,offline:!!p.data.offline,error:p.data.error||'',imageState:c&&c.data.imageState,image:c&&c.data.src,simulated:!!p.data.simulated,window:wx.getWindowInfo(),imageRects:rects[0]}));}check();});},entry.route.split('?')[0].slice(1));}
try{
 for(const entry of plan.filter(e=>!only||e.id===only)){
  if(!only&&rows.some(r=>r.id===entry.id&&fs.existsSync(path.join(out,entry.id+'.png')))){console.log('REUSED current batch '+entry.id);continue;}
  call('automation_navigate',{action:'reLaunch',url:'"'+entry.route+'"'});
  let s=ready(entry);assert.equal(s.ready,true,JSON.stringify(s));
  if(['create','create-confirmed','ready','waiting'].includes(entry.action)){
   evaluate(async function(action){const p=getCurrentPages().slice(-1)[0];if(!p.data.devPreview)throw Error('Explicit preview required');p.selectVenueMap({detail:{value:1}});if(action!=='create')p.chooseVenue();if(action==='ready'||action==='waiting')await p.create();if(action==='waiting')await p.toggleReady();return true;},entry.action);s=ready(entry);assert.equal(s.ready,true);
  }
  if(['collapse','team','events','rules','code'].includes(entry.action)){
   const selector={collapse:'.trayGrip',team:'.teamAction',events:'.teamAction',rules:'.rulesAction',code:'.mouseAction'}[entry.action];
   call('automation_element_action',{selector,action:'tap','wait-for-selector':selector,wait:.3});
   if(entry.action==='events')evaluate(function(){const p=getCurrentPages().slice(-1)[0];if(!p.data.devPreview)throw Error('Preview required');p.selectDrawerTab({currentTarget:{dataset:{tab:'events'}}});return true;});
  }
  if(entry.scroll==='page')evaluate(function(){return new Promise(resolve=>wx.pageScrollTo({scrollTop:9999,duration:0,complete:()=>setTimeout(resolve,150)}));});
  if(entry.scroll==='terminal')call('automation_element_action',{selector:'.terminalScroll',action:'scrollTo',x:0,y:9999,wait:.2});
  if(entry.action==='wholemap')evaluate(function(){const c=getCurrentPages().slice(-1)[0].selectComponent('.venueArt');c.reset();for(let i=0;i<16&&c.data.canZoomOut;i++)c.zoomOut();return {scale:c.data.scaleValue};});
  evaluate(function(){return new Promise(resolve=>wx.nextTick(()=>setTimeout(resolve,350)));});
  s=ready(entry);assert.equal(s.ready,true);if(entry.action==='collapse')assert.equal(s.trayExpanded,false);if(entry.action==='code')assert.equal(s.codeOpen,true);if(['team','events','rules'].includes(entry.action)){assert.equal(s.drawer,true);assert.equal(s.drawerTab,entry.action);}
  const capture=call('simulator_screenshot',{path:path.join(out,entry.id+'.png'),optimize:'false'});assert.ok(Math.abs(capture.imageWidth/capture.imageHeight-s.window.windowWidth/s.window.windowHeight)<.01,'Stale screenshot/runtime dimensions');
  const row={...entry,...s,launchRoute:entry.route,screenshot:entry.id+'.png',screenshotWidth:capture.imageWidth,screenshotHeight:capture.imageHeight,captureDate:'2026-10-19',manualReview:false,phoneVerified:false};rows=rows.filter(r=>r.id!==entry.id).concat(row).sort((a,b)=>a.id.localeCompare(b.id));fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(rows,null,2)+'\n');console.log('CAPTURED '+entry.id+' '+entry.title+'; manual review pending');
 }
}catch(e){fs.writeFileSync(path.join(out,'failure-'+Date.now()+'.txt'),e.stack);console.error(e);process.exitCode=1;}
