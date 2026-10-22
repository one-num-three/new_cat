const api=require('./v2');
let activeRoom=null,handler=null,timer=null,watchdog=null,owner=null;
let generation=0,fallbackToken=0,lastSentAt=0,streamBusy=false,foreground=true;
let backgroundReady=false,mode='off',notice='',controlVersion=-1,blockedKey=null,auditing=false,lastAudit=0;
let quality=null,qualitySequence=0;
let seq=Number(wx.getStorageSync('v2SampleSeq'))||0;
const identity=()=>({id:wx.getStorageSync('v2UserId'),token:wx.getStorageSync('v2Token')});
const sameIdentity=a=>a&&a.id===wx.getStorageSync('v2UserId')&&a.token===wx.getStorageSync('v2Token');
const eligible=m=>m&&['HIDING','CHASING','PAUSED'].includes(m.phase)&&['active','joining'].includes(m.myStatus??m.status);
const status=()=>({running:!!activeRoom,mode,backgroundReady,notice,roomId:activeRoom,matchId:owner?.matchId||null,quality:sameIdentity(owner?.identity)&&quality?{...quality}:null});
function publish(){owner?.options.onStatus?.(status());}
const issueOf=e=>e?.code||e?.errMsg||e?.message||'LOCATION_UNAVAILABLE';
const observation=(p,at=Date.now())=>({accuracy:Number.isFinite(p?.accuracy)?p.accuracy:null,at,sequence:++qualitySequence,issue:'',accepted:null});
function observed(sample){if(quality&&sample.sequence<quality.sequence)return sample;quality=sample;publish();return sample;}
function settled(sample,issue='',accepted=false){if(quality!==sample)return;sample.issue=issue;sample.accepted=accepted;publish();}
function halt(reason){const callback=owner?.options.onStatus;if(owner&&['TRACKING_STOPPED','MATCH_CHANGED','CAPTURED','LEFT_MATCH'].includes(reason))blockedKey=owner.key;stop();callback?.({...status(),reason});}
function current(room,run){if(activeRoom!==room||run!==generation)return false;if(!sameIdentity(owner?.identity)){halt('IDENTITY_CHANGED');return false;}return true;}
function problem(onError,error){if(['UNAUTHENTICATED','NOT_MEMBER','STALE_SESSION','CAPTURED','LEFT_MATCH'].includes(error?.code))halt(error.code);onError?.(error);}
function syncTracking(t){
 if(!owner?.matchId||!t)return;
 if(Number.isFinite(t.version)&&t.version<controlVersion)return;
 if(t.matchId!==owner.matchId){halt('MATCH_CHANGED');return;}
 controlVersion=t.version??controlVersion;
 if(!eligible(t)){halt('TRACKING_STOPPED');return;}
}
function syncMatch(s){
 if(!owner?.matchId||s?.roomId!==activeRoom)return;
 if(s.viewerId&&s.viewerId!==owner.identity.id){halt('IDENTITY_CHANGED');return;}
 const m=s.match;syncTracking({matchId:m?.id||null,phase:m?.phase,status:m?.myStatus,version:s.version});
}
function submit(roomId,p,matchId,receivedAt=Date.now()){
 if(!p||![p.latitude,p.longitude,p.accuracy].every(Number.isFinite))return Promise.reject(new Error('LOCATION_UNAVAILABLE'));
 seq++;wx.setStorageSync('v2SampleSeq',seq);
 return api.location(roomId,{lat:p.latitude,lng:p.longitude,accuracy:p.accuracy,sampledAt:receivedAt,sampleSeq:seq,coordinateSystem:'gcj02',...(matchId?{matchId}:{})});
}
function once(roomId,isCurrent,onQuality){
 const actor=identity(),run=generation,matchId=activeRoom===roomId?owner?.matchId:null;
 const notify=sample=>{if(run!==generation||!sameIdentity(actor)||isCurrent&&!isCurrent())return;onQuality?.({...sample});if(activeRoom===roomId)observed(sample);};
 return new Promise((resolve,reject)=>wx.getLocation({type:'gcj02',isHighAccuracy:true,success:p=>{
  if(run!==generation||!sameIdentity(actor)||isCurrent&&!isCurrent()){reject(new Error('LOCATION_CANCELLED'));return;}
  const sample=observation(p);notify(sample);
  submit(roomId,p,matchId,sample.at).then(r=>{if(run===generation&&activeRoom===roomId&&r.tracking)syncTracking(r.tracking);if(!r.accepted){const e=new Error(r.warning||'LOCATION_REJECTED');e.code=r.warning;throw e;}notify({...sample,accepted:true});resolve(r);}).catch(e=>{notify({...sample,issue:issueOf(e),accepted:false});if(e.code==='STALE_LOCATION'){resolve({accepted:true});return;}reject(e);});
 },fail:e=>{notify({...observation(null),issue:issueOf(e)});reject(e);}}));
}
function sent(roomId,p,onError,run,receivedAt){
 const matchId=owner?.matchId,sample=observed(observation(p,receivedAt));
 return submit(roomId,p,matchId,receivedAt).then(r=>{
  if(!current(roomId,run))return;
  if(r.tracking)syncTracking(r.tracking);
  if(!r.accepted&&r.warning!=='TRACKING_STOPPED'){const e=new Error(r.warning||'LOCATION_REJECTED');e.code=r.warning;throw e;}settled(sample,'',!!r.accepted);
 }).catch(e=>{if(current(roomId,run)){settled(sample,issueOf(e));problem(onError,e);}}).finally(()=>{if(run===generation)streamBusy=false;});
}
function sendStream(roomId,p,onError,run){
 if(!current(roomId,run)||!foreground&&!backgroundReady||streamBusy||Date.now()-lastSentAt<2000)return;
 if(Date.now()>=owner.maxUntil){halt('TRACKING_TIMEOUT');return;}
 streamBusy=true;lastSentAt=Date.now();sent(roomId,p,onError,run,Date.now());
}
function fallback(roomId,onError,run){
 if(!foreground||!current(roomId,run)||streamBusy||Date.now()-lastSentAt<3000)return;
 streamBusy=true;lastSentAt=Date.now();const request=++fallbackToken;
 const finish=(error,p)=>{
  if(!foreground||!current(roomId,run)||request!==fallbackToken)return;
  fallbackToken++;clearTimeout(watchdog);watchdog=null;
  if(error){streamBusy=false;observed({...observation(null),issue:issueOf(error)});problem(onError,error);return;}
  sent(roomId,p,onError,run,Date.now());
 };
 watchdog=setTimeout(()=>finish(new Error('定位超时')),7000);
 wx.getLocation({type:'gcj02',isHighAccuracy:true,success:p=>finish(null,p),fail:e=>finish(e)});
}
function audit(roomId,onError,run){
 if(foreground||!current(roomId,run)||auditing||typeof api.room!=='function'||owner.options.isLiveConnected?.()||Date.now()-lastAudit<5000)return;
 auditing=true;lastAudit=Date.now();
 api.room(roomId).then(s=>{if(current(roomId,run))syncMatch(s);}).catch(e=>{if(current(roomId,run))problem(onError,e);}).finally(()=>{if(run===generation)auditing=false;});
}
function start(roomId,onError,options={}){
 const actor=identity(),key=actor.id+'/'+roomId+'/'+(options.matchId||'foreground');
 if(blockedKey===key){options.onStatus?.({...status(),reason:'TRACKING_STOPPED'});return false;}
 if(activeRoom===roomId&&sameIdentity(owner?.identity)&&owner?.matchId===(options.matchId||null)&&owner?.options.background===options.background){owner.options=options;publish();return true;}
 stop();activeRoom=roomId;const run=generation;
 owner={identity:actor,key,matchId:options.matchId||null,options,onError,maxUntil:Date.now()+15*60*1000};controlVersion=-1;notice='';
 if(options.match&&!eligible(options.match)){halt('TRACKING_STOPPED');return false;}
 handler=p=>{if(watchdog){fallbackToken++;clearTimeout(watchdog);watchdog=null;streamBusy=false;lastSentAt=0;}sendStream(roomId,p,onError,run);};
 wx.onLocationChange(handler);
 const foregroundStart=()=>{
  if(!current(roomId,run))return;mode='foreground';backgroundReady=false;publish();
  try{wx.startLocationUpdate({type:'gcj02',fail:e=>{if(current(roomId,run)){halt('LOCATION_FAILED');onError?.(e);}}});}catch(e){halt('LOCATION_FAILED');onError?.(e);}
 };
 if(options.background&&options.matchId&&typeof wx.startLocationUpdateBackground==='function'){
  mode='requesting';publish();
  try{wx.startLocationUpdateBackground({type:'gcj02',success:()=>{if(!current(roomId,run)){if(!activeRoom)wx.stopLocationUpdate({fail:()=>{}});return;}mode='background';backgroundReady=true;publish();},fail:()=>{if(!current(roomId,run))return;notice='后台定位未开启，请检查授权及微信接口权限；暂需保持前台';foregroundStart();}});}catch{notice='当前微信无法开启后台定位，请保持前台';foregroundStart();}
 }else{if(options.background)notice='当前微信不支持后台定位，请更新微信并保持前台';foregroundStart();}
 if(!current(roomId,run))return false;
 timer=setInterval(()=>{
  if(!current(roomId,run))return;
  if(Date.now()>=owner.maxUntil){halt('TRACKING_TIMEOUT');return;}
  if(!foreground&&!backgroundReady){halt('BACKGROUND_UNAVAILABLE');return;}
  if(foreground)fallback(roomId,onError,run);else audit(roomId,onError,run);
 },1000);return true;
}
function stop(){
 const owned=activeRoom||handler||timer||watchdog;
 generation++;fallbackToken++;activeRoom=null;owner=null;quality=null;streamBusy=false;lastSentAt=0;auditing=false;lastAudit=0;backgroundReady=false;mode='off';controlVersion=-1;
 if(handler)wx.offLocationChange(handler);
 clearInterval(timer);clearTimeout(watchdog);handler=null;timer=null;watchdog=null;
 if(owned)wx.stopLocationUpdate({fail:()=>{}});
}
function setForeground(value){
 const wasForeground=foreground;foreground=!!value;
 if(!foreground){if(watchdog){fallbackToken++;clearTimeout(watchdog);watchdog=null;streamBusy=false;}if(activeRoom&&!backgroundReady)halt('BACKGROUND_UNAVAILABLE');}
 else if(!wasForeground&&activeRoom)fallback(activeRoom,owner?.onError,generation);
}
function canBackground(roomId,matchId){return activeRoom===roomId&&owner?.matchId===matchId&&backgroundReady&&sameIdentity(owner.identity);}
module.exports={once,start,stop,setForeground,canBackground,syncMatch,status};
