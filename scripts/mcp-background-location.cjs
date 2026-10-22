'use strict';
// One simulator; lifecycle hooks and native permission success are simulated.
// The room, identities, role-authorized WebSocket and capture use the real local service.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]),meta=JSON.parse(fs.readFileSync(path.join(out,'fixture.json')));
assert.equal(meta.scenario,'capture');
const shell='C:/Users/Keke_/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';let seq=Date.now(),initialized=false;
const save=(n,v)=>fs.writeFileSync(path.join(out,n+'.json'),JSON.stringify(v,null,2));
function command(tool,args){const id=++seq,file=path.join(out,'command-'+id+'.json');save('command-'+id,{tool,project:root,args});const r=cp.spawnSync(shell,['-NoProfile','-File',path.join(root,'scripts/wechat-mcp-command.ps1'),'-InputFile',file],{encoding:'utf8',timeout:50000});fs.writeFileSync(path.join(out,'call-'+id+'.log'),(r.stdout||'')+(r.stderr||''));assert.equal(r.status,0,tool+' command failed');const j=JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));assert.ok(j.ok&&j.result.success,JSON.stringify(j));return j.result;}
function evaluate(fn,data={}){const file=path.join(out,'args-'+(++seq)+'.json');fs.writeFileSync(file,JSON.stringify([data]));return command('automation_evaluate',{'fn-source':fn.toString().replace(/\r?\n/g,' '),'args-file':file}).result.result;}
const state=async()=>await(await fetch(meta.base+'/__mcp/state',{headers:{Connection:'close'}})).json();
async function control(action){const r=await fetch(meta.base+'/__mcp/control',{method:'POST',headers:{'Content-Type':'application/json',Connection:'close'},body:JSON.stringify({action})});const s=await r.json();assert.equal(r.status,200,JSON.stringify(s));return s;}
function session(stage){const r=cp.spawnSync(process.execPath,[path.join(root,'scripts/mcp-join-reconnect.cjs'),out,stage],{encoding:'utf8',timeout:90000});fs.writeFileSync(path.join(out,'session-'+stage+'.log'),(r.stdout||'')+(r.stderr||''));assert.equal(r.status,0,'Session '+stage+' failed');console.log('SESSION '+stage);}
function read(){return evaluate(function(){const p=getCurrentPages().slice(-1)[0],loc=require('utils/location-v2');return {route:p?.route,active:p?.active,userId:wx.getStorageSync('v2UserId'),viewerId:p?.lastSnapshot?.viewerId,match:p?.data.match,offline:p?.data.offline,backgroundTracking:!!p?.backgroundTracking,socketOpen:!!p?.socketOpen,polling:!!p?.pollTimer,locationRunning:!!p?.locationRunning,trackingText:p?.data.trackingText,backgroundReady:p?.data.backgroundReady,location:loc.status(),devPreview:!!p?.devPreview};});}
function waitUi(predicate,label){let v;for(let i=0;i<12;i++){v=read();if(predicate(v))return v;}throw Error(label+': '+JSON.stringify(v));}
function shot(name){const view=read();save(name,{view,simulatedNativePermission:true,simulatedLifecycle:true,phoneLockScreen:false});command('simulator_screenshot',{path:path.join(out,name+'.png'),optimize:'false',wait:1});console.log('SHOT '+name);return view;}
function hide(){return evaluate(function(){getApp().onHide();getCurrentPages().slice(-1)[0].onHide();return true;});}
function show(){return evaluate(function(){getApp().onShow();getCurrentPages().slice(-1)[0].onShow();return true;});}
(async()=>{
 try{
  const before=evaluate(function(){return {backup:!!wx.getStorageSync('__mcpJoinReconnectBackup'),base:require('utils/v2.js').config.baseUrl};});assert.equal(before.backup,false);assert.equal(before.base,'https://seu-link.fit/catmouse');save('before',before);
  initialized=true;session('init');
  const permission=path.join(out,'startLocationUpdateBackground.json');fs.writeFileSync(permission,JSON.stringify({errMsg:'startLocationUpdateBackground:ok'}));command('automation_wx_api',{action:'mock',method:'startLocationUpdateBackground','result-file':permission});
  const mocked=path.join(out,'mocked-methods.json');fs.writeFileSync(mocked,JSON.stringify([...new Set(JSON.parse(fs.readFileSync(mocked)).concat('startLocationUpdateBackground'))]));
  evaluate(function(){require('utils/venue-resources').ensure('seu-jiulonghu-v1').catch(()=>{});return true;});
  let warmed=false;for(let i=0;i<12;i++){const v=evaluate(function(){return {ready:require('utils/venue-resources').ready('seu-jiulonghu-v1'),route:getCurrentPages().slice(-1)[0]?.route};});if(v.ready&&v.route==='pages/index/index'){warmed=true;break;}}assert.ok(warmed,'map resource ready');
  await control('start');let s=await state();while(s.match.phase==='HIDING'){await new Promise(r=>setTimeout(r,500));s=await state();}assert.equal(s.match.phase,'CHASING');
  const mouse=s.roster.find(p=>p.role==='mouse'&&p.status==='active');
  evaluate(async function(c){const a=await new Promise((resolve,reject)=>wx.request({url:c.base+'/__mcp/identity?index='+c.index,success:r=>resolve(r.data),fail:reject}));for(const[k,v]of [['v2Token',a.token],['v2UserId',a.id],['v2RoomId',a.roomId],['nickname',a.nickname],['v2SampleSeq',a.sampleSeq]])wx.setStorageSync(k,v);await require('utils/v2.js').join(a.code,a.nickname);return {id:a.id};},{base:meta.base,index:mouse.index});
  evaluate(function(url){wx.navigateTo({url});return true;},'/pages/map/map?roomId='+meta.roomId);
  waitUi(v=>v.viewerId===mouse.id&&v.match?.myStatus==='active'&&!v.offline&&v.location.backgroundReady&&v.socketOpen,'background ready');
  evaluate(function(){const p=getCurrentPages().slice(-1)[0];p.openDrawer({currentTarget:{dataset:{tab:'rules'}}});return true;});
  shot('01-background-ready');
  hide();const hidden=waitUi(v=>!v.active&&v.backgroundTracking&&v.socketOpen&&v.location.running&&v.location.backgroundReady,'hidden tracking');save('02-hidden-active',hidden);
  show();const returned=waitUi(v=>v.active&&!v.offline&&v.location.backgroundReady&&v.socketOpen,'foreground recovery');assert.equal(returned.location.matchId,hidden.location.matchId);assert.equal(returned.userId,mouse.id);assert.equal(returned.polling,false);save('03-returned-same-match',returned);
  hide();await control('capture');const captured=waitUi(v=>!v.active&&!v.backgroundTracking&&!v.socketOpen&&!v.location.running,'hidden capture cleanup');save('04-hidden-captured',captured);
  s=await state();assert.equal(s.capturedIndex,mouse.index);assert.equal(s.match.captured,1);assert.equal(s.match.phase,'CHASING');save('server-after-capture',s);
  show();waitUi(v=>v.active&&!v.offline&&v.match?.myStatus==='captured'&&!v.location.running&&!v.backgroundReady,'captured foreground');
  const final=shot('05-captured-location-stopped');assert.equal(final.trackingText,'定位已停止');
  save('result',{status:'passed',screenshots:2,simulators:1,simulatedNativePermission:true,simulatedLifecycle:true,backgroundNativeGpsEvents:false,realLocalHttpAndWebSocket:true,hiddenAuthorizedSocketRetained:true,hiddenCaptureStopsCollection:true,sameIdentityAndMatchRestored:true,noParallelPollingAfterReturn:true,phoneLockScreen:false,publicNetwork:false,productionDataWritten:false});console.log('BACKGROUND_LIFECYCLE_PASSED');
 }catch(e){save('failure',{message:e.message,stack:e.stack});throw e;}
 finally{if(initialized){const v=evaluate(function(){return {present:!!wx.getStorageSync('__mcpJoinReconnectBackup'),base:require('utils/v2.js').config.baseUrl};});if(v.present)session('restore');else assert.equal(v.base,'https://seu-link.fit/catmouse');}}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
