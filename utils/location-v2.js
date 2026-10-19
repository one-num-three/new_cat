const api = require('./v2');
let activeRoom=null,handler=null,timer=null,watchdog=null;
let generation=0,fallbackToken=0,lastSentAt=0,streamBusy=false;
let seq=Number(wx.getStorageSync('v2SampleSeq'))||0;

function submit(roomId,p){
  if(!p || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude))return Promise.reject(new Error('LOCATION_UNAVAILABLE'));
  seq++;wx.setStorageSync('v2SampleSeq',seq);
  return api.location(roomId,{lat:p.latitude,lng:p.longitude,accuracy:p.accuracy||25,sampledAt:Date.now(),sampleSeq:seq,coordinateSystem:'gcj02'}).then(r=>{if(!r.accepted)throw new Error(r.warning||'LOCATION_REJECTED');return r;});
}

function once(roomId,isCurrent){
  return new Promise((resolve,reject)=>wx.getLocation({type:'gcj02',isHighAccuracy:true,success:p=>{if(isCurrent && !isCurrent()){reject(new Error('LOCATION_CANCELLED'));return;}submit(roomId,p).then(resolve,e=>e.code==='STALE_LOCATION'?resolve({accepted:true}):reject(e));},fail:reject}));
}

function report(onError,error){(onError||(()=>{}))(error);}

function sendStream(roomId,p,onError,run){
  if(activeRoom!==roomId || run!==generation || streamBusy || Date.now()-lastSentAt<2000)return;
  streamBusy=true;lastSentAt=Date.now();
  submit(roomId,p).catch(e=>report(onError,e)).finally(()=>{if(run===generation)streamBusy=false;});
}

function fallback(roomId,onError,run){
  if(activeRoom!==roomId || run!==generation || streamBusy || Date.now()-lastSentAt<3000)return;
  streamBusy=true;lastSentAt=Date.now();
  const request=++fallbackToken;
  const finish=(error,p)=>{
    if(activeRoom!==roomId || run!==generation || request!==fallbackToken)return;
    fallbackToken++;clearTimeout(watchdog);watchdog=null;
    if(error){streamBusy=false;report(onError,error);return;}
    submit(roomId,p).catch(e=>report(onError,e)).finally(()=>{if(run===generation)streamBusy=false;});
  };
  watchdog=setTimeout(()=>finish(new Error('定位超时')),7000);
  wx.getLocation({type:'gcj02',isHighAccuracy:true,success:p=>finish(null,p),fail:e=>finish(e)});
}

function start(roomId,onError){
  stop();activeRoom=roomId;const run=generation;lastSentAt=0;
  handler=p=>{if(watchdog){fallbackToken++;clearTimeout(watchdog);watchdog=null;streamBusy=false;lastSentAt=0;}sendStream(roomId,p,onError,run);};
  wx.onLocationChange(handler);
  wx.startLocationUpdate({type:'gcj02',fail:e=>{if(run!==generation)return;stop();report(onError,e);}});
  timer=setInterval(()=>fallback(roomId,onError,run),1000);
}

function stop(){
  const owned=activeRoom||handler||timer||watchdog;
  generation++;fallbackToken++;activeRoom=null;streamBusy=false;lastSentAt=0;
  if(handler)wx.offLocationChange(handler);
  clearInterval(timer);clearTimeout(watchdog);handler=null;timer=null;watchdog=null;
  if(owned)wx.stopLocationUpdate({fail:()=>{}});
}

module.exports={once,start,stop};
