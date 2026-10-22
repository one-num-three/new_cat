const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {locationSignal}=require('../../utils/presentation'),root=path.resolve(__dirname,'../..'),flush=()=>new Promise(r=>setImmediate(r));
test('location signal quantifies platform accuracy at every boundary without inventing a percent or accepting poor fixes',()=>{
 for(const [accuracy,level,text]of [[4.9,4,'±5m'],[5,4,'±5m'],[5.01,3,'±6m'],[10,3,'±10m'],[10.01,2,'±11m'],[25,2,'±25m'],[25.01,1,'±26m'],[80,1,'±80m'],[1000,1,'>999m']]){
  const s=locationSignal({accuracy,at:100000},{now:100000});assert.equal(s.level,level);assert.equal(s.text,text);if(accuracy>25)assert.match(s.detail,/不用于准备和抓捕/);assert.doesNotMatch(s.text,/%/);
 }
 for(const accuracy of [0,-1,NaN,Infinity,null,undefined])assert.equal(locationSignal({accuracy,at:100000},{now:100000}).level,0);
});
test('stale, denied, network, outside, invalid and stopped states never keep a falsely strong location indicator',()=>{
 const p={accuracy:4,at:100000};assert.equal(locationSignal(p,{now:105000}).level,4);assert.equal(locationSignal(p,{now:105001}).text,'已过期');assert.equal(locationSignal({...p,at:110000},{now:100000}).level,0);
 for(const [issue,text]of [['getLocation:fail auth deny','未授权'],['request:fail timeout','未同步'],['OUTSIDE_VENUE','范围外'],['LOCATION_JUMP','待稳定'],['INVALID_LOCATION','待校验'],['STALE_LOCATION','待更新']]){
  const s=locationSignal({...p,issue},{now:100000});assert.equal(s.level,0);assert.equal(s.text,text);
 }
 assert.equal(locationSignal(p,{now:100000,offline:true}).text,'未同步');assert.equal(locationSignal(p,{now:100000,stopped:true}).text,'已停止');
});
function harness(post=async()=>({accepted:true})){
 let now=100000,change,gps;const states=[],sent=[],storage={v2UserId:'me',v2Token:'session'},wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,onLocationChange:f=>change=f,offLocationChange:()=>change=null,startLocationUpdate:()=>{},stopLocationUpdate:()=>{},getLocation:o=>gps=o};
 const api={location:async(room,data)=>{sent.push({room,data});return post(room,data);}},module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'utils/location-v2.js'),'utf8'),{module,require:()=>api,wx,Date:{now:()=>now},setInterval:()=>1,clearInterval(){},setTimeout:()=>2,clearTimeout(){}});
 const loc=module.exports,options={matchId:'match',match:{phase:'CHASING',myStatus:'active'},onStatus:s=>states.push(s)};
 return {loc,states,sent,storage,options,emit:p=>change?.(p),callback:()=>change,gps:()=>gps,advance:n=>now+=n,p:{latitude:32,longitude:118,accuracy:5}};
}
test('rejected native fixes still expose their accuracy locally, fresh fixes recover, and status contains no coordinates',async()=>{
 const h=harness(async(_,p)=>{if(p.accuracy>25){const e=Error('poor');e.code='INVALID_LOCATION';throw e;}return {accepted:true};});h.loc.start('room',()=>{},h.options);h.emit({...h.p,accuracy:80});await flush();
 assert.equal(h.loc.status().quality.accuracy,80);assert.equal(h.loc.status().quality.accepted,false);assert.equal(locationSignal(h.loc.status().quality,{now:100000}).level,1);assert.equal(h.sent[0].data.accuracy,80,'server validation is preserved, not silently relaxed');
 assert.doesNotMatch(JSON.stringify(h.states),/latitude|longitude|"lat"|"lng"|session/);h.advance(2000);h.emit(h.p);await flush();assert.equal(h.loc.status().quality.issue,'');assert.equal(h.loc.status().quality.accepted,true);assert.equal(locationSignal(h.loc.status().quality,{now:102000}).level,4);
 h.loc.stop();assert.equal(h.loc.status().quality,null);
});
test('old match, identity and stopped collectors cannot publish a late quality sample or start an extra GPS upload',async()=>{
 let resolve;const h=harness(()=>new Promise(r=>resolve=r));h.loc.start('room',()=>{},h.options);h.emit(h.p);await flush();const old=h.callback();h.loc.start('room',()=>{},{...h.options,matchId:'next'});resolve({accepted:true});await flush();assert.equal(h.loc.status().quality,null);old({...h.p,accuracy:90});assert.equal(h.loc.status().quality,null);assert.equal(h.sent.length,1);
 h.storage.v2UserId='other';h.emit(h.p);assert.equal(h.loc.status().quality,null);assert.equal(h.loc.status().running,false);
 const calls=[],once=h.loc.once('room',()=>true,s=>calls.push(s));const gps=h.gps();h.loc.stop();gps.success(h.p);await assert.rejects(once,/LOCATION_CANCELLED/);assert.equal(calls.length,0);assert.equal(h.sent.length,1);
});
test('manual ready sampling reports weak precision before/after rejection and ignores inactive page callbacks',async()=>{
 const h=harness(async()=>{const e=Error('bad fix');e.code='INVALID_LOCATION';throw e;}),samples=[];let active=true;
 const promise=h.loc.once('room',()=>active,p=>samples.push(p));h.gps().success({...h.p,accuracy:60});await assert.rejects(promise,/bad fix/);assert.equal(samples[0].accuracy,60);assert.equal(samples.at(-1).issue,'INVALID_LOCATION');assert.equal(locationSignal(samples.at(-1),{now:100000}).text,'±60m');assert.doesNotMatch(JSON.stringify(samples),/latitude|longitude/);
 const late=h.loc.once('room',()=>active,p=>samples.push(p));active=false;h.gps().success(h.p);await assert.rejects(late,/LOCATION_CANCELLED/);assert.equal(samples.length,2);
});
test('a slow manual location result cannot overwrite a newer stream precision sample',async()=>{
 const pending=[],h=harness(()=>new Promise(resolve=>pending.push(resolve)));h.loc.start('room',()=>{},h.options);const manual=h.loc.once('room');h.gps().success({...h.p,accuracy:80});await flush();h.advance(2000);h.emit(h.p);await flush();assert.equal(h.loc.status().quality.accuracy,5);
 pending[0]({accepted:true});await manual;assert.equal(h.loc.status().quality.accuracy,5);pending[1]({accepted:true});await flush();assert.equal(h.loc.status().quality.accepted,true);h.loc.stop();
});
test('map shows precision and permission state without a generic location interruption banner; disconnect/terminal clear the signal',()=>{
 let p;const wx={getStorageSync:()=> 'me'};
 vm.runInNewContext(fs.readFileSync(path.join(root,'pages/map/map.js'),'utf8'),{Page:d=>p=d,require:n=>n.includes('location-v2')?{}:n.endsWith('/v2')?{}:require(path.resolve(root,'pages/map',n)),wx,Date,Math,Number,setInterval:()=>1,clearInterval(){},clearTimeout(){}});
 p.data={...p.data,match:{id:'match',phase:'CHASING',myStatus:'active'},roomId:'room'};p.active=true;p.setData=function(d){Object.assign(this.data,d);};p.closeCode=()=>{};
 p.onTrackingStatus({running:true,mode:'foreground',quality:{accuracy:60,at:Date.now(),issue:'INVALID_LOCATION'}});assert.equal(p.data.locationSignal.level,1);assert.equal(p.data.locationSignal.text,'±60m');assert.equal(p.data.error,'');p.onLocationError({errMsg:'getLocation:fail auth deny'});assert.equal(p.data.locationSignal.text,'未授权');
 p.onTrackingStatus({running:true,mode:'foreground',quality:{accuracy:8,at:Date.now(),issue:''}});assert.equal(p.data.locationSignal.level,3);p.setOffline('offline');assert.equal(p.data.locationSignal.level,0);assert.equal(p.data.locationSignal.text,'未同步');p.data.match.phase='FINISHED';p.updateLocationSignal();assert.equal(p.data.locationSignal.text,'已停止');
});
