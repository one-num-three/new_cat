const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os'),crypto=require('node:crypto');
const flush=()=>new Promise(r=>setImmediate(r));
function harness({denied=false,unsupported=false,post}={}){
 let now=100000,change,serial=0,stops=0,starts=0,gps,backgroundOptions;
 const timers=new Map(),timeouts=new Map(),sent=[],states=[],storage={v2UserId:'me',v2Token:'session',v2SampleSeq:0};
 const wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,onLocationChange:f=>change=f,offLocationChange:()=>change=null,stopLocationUpdate:()=>stops++,startLocationUpdate:()=>starts++,getLocation:o=>gps=o};
 if(!unsupported)wx.startLocationUpdateBackground=o=>{backgroundOptions=o;if(denied)o.fail({errMsg:'auth deny'});else o.success({errMsg:'ok'});};
 const api={location:async(room,data)=>{sent.push({room,data});return post?post(room,data):{accepted:true,tracking:{matchId:data.matchId,phase:'CHASING',status:'active',version:2}};},room:async()=>({roomId:'room',viewerId:'me',version:3,match:{id:'match',phase:'CHASING',myStatus:'active'}})};
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../utils/location-v2.js'),'utf8'),{module,require:()=>api,wx,Date:{now:()=>now},Number,Promise,Error,setInterval:f=>{const id=++serial;timers.set(id,f);return id;},clearInterval:id=>timers.delete(id),setTimeout:f=>{const id=++serial;timeouts.set(id,f);return id;},clearTimeout:id=>timeouts.delete(id)});
 const loc=module.exports,options={matchId:'match',match:{id:'match',phase:'CHASING',myStatus:'active'},background:true,isLiveConnected:()=>true,onStatus:s=>states.push(s)};
 return {loc,wx,storage,sent,states,timers,timeouts,options,p:{latitude:32,longitude:118,accuracy:5},advance:ms=>now+=ms,emit:p=>change?.(p),callback:()=>change,tick:()=>[...timers.values()].forEach(f=>f()),gps:()=>gps,counts:()=>({stops,starts}),background:()=>backgroundOptions};
}
test('authorized background stream survives app hide, stays match-bound and resumes without a duplicate listener',async()=>{
 const h=harness();h.loc.start('room',()=>{},h.options);assert.equal(h.loc.canBackground('room','match'),true);const callback=h.callback();h.loc.setForeground(false);h.emit(h.p);await flush();
 assert.equal(h.sent.length,1);assert.equal(h.sent[0].data.matchId,'match');h.advance(3500);h.tick();assert.equal(h.gps(),undefined,'Background must not poll a foreground-only GPS API');h.emit(h.p);await flush();assert.equal(h.sent.length,2);
 h.loc.setForeground(true);h.loc.start('room',()=>{},h.options);assert.equal(h.callback(),callback);assert.equal(h.timers.size,1);h.loc.stop();assert.equal(h.timers.size,0);assert.equal(h.callback(),null);
});
test('permission denial or missing capability explicitly falls back to foreground and stops on hide',()=>{
 for(const params of [{denied:true},{unsupported:true}]){const h=harness(params);h.loc.start('room',()=>{},h.options);assert.equal(h.loc.status().mode,'foreground');assert.ok(h.loc.status().notice);assert.equal(h.loc.canBackground('room','match'),false);assert.equal(h.counts().starts,1);h.loc.setForeground(false);assert.equal(h.loc.status().running,false);assert.equal(h.timers.size,0);}
});
test('hidden capture/finish/exit and stale GPS callbacks cannot keep uploading or restart a completed match',async()=>{
 for(const [phase,status]of [['CHASING','captured'],['CHASING','left'],['FINISHED','active'],['CANCELLED','active']]){const h=harness();h.loc.start('room',()=>{},h.options);const late=h.callback();h.loc.setForeground(false);h.loc.syncMatch({roomId:'room',viewerId:'me',version:4,match:{id:'match',phase,myStatus:status}});assert.equal(h.loc.status().running,false);late(h.p);await flush();assert.equal(h.sent.length,0);assert.equal(h.loc.start('room',()=>{},h.options),false);assert.equal(h.timers.size,0);}
});
test('new-round and identity switches invalidate old callbacks and in-flight response control',async()=>{
 let resolve;const h=harness({post:()=>new Promise(r=>resolve=r)});h.loc.start('room',()=>{},h.options);const old=h.callback();h.emit(h.p);await flush();h.loc.start('room',()=>{},{...h.options,matchId:'next',match:{id:'next',phase:'HIDING',myStatus:'active'}});const current=h.callback();resolve({accepted:false,warning:'TRACKING_STOPPED',tracking:{matchId:'match',phase:'FINISHED',status:'captured',version:20}});await flush();assert.equal(h.loc.status().matchId,'next');old(h.p);assert.equal(h.sent.length,1);h.storage.v2UserId='other';current(h.p);assert.equal(h.loc.status().running,false);assert.equal(h.sent.length,1);
});
test('a tracking-stop receipt clears native collection even without a WebSocket terminal frame',async()=>{
 const h=harness({post:async()=>({accepted:false,warning:'TRACKING_STOPPED',tracking:{matchId:'match',phase:'FINISHED',status:'active',version:5}})});h.loc.start('room',()=>{},h.options);h.loc.setForeground(false);h.emit(h.p);await flush();assert.equal(h.loc.status().running,false);assert.equal(h.sent.length,1);assert.equal(h.callback(),null);
});
test('a late manual GPS response cannot stop the next match and a late permission success cannot leak an orphan collector',async()=>{
 let resolve;const h=harness({post:()=>new Promise(r=>resolve=r)});h.loc.start('room',()=>{},h.options);const once=h.loc.once('room');h.gps().success(h.p);await flush();h.loc.start('room',()=>{},{...h.options,matchId:'next',match:{id:'next',phase:'HIDING',myStatus:'active'}});resolve({accepted:true,tracking:{matchId:'match',phase:'FINISHED',status:'captured',version:10}});await once;assert.equal(h.loc.status().matchId,'next');h.loc.stop();
 const p=harness();p.wx.startLocationUpdateBackground=o=>p.pending=o;p.loc.start('room',()=>{},p.options);p.loc.stop();const before=p.counts().stops;p.pending.success();assert.equal(p.loc.status().running,false);assert.equal(p.counts().stops,before+1);
});
test('background transition does not overlap an in-flight upload and has a bounded unattended lifetime',async()=>{
 let resolve;const h=harness({post:()=>new Promise(r=>resolve=r)});h.loc.start('room',()=>{},h.options);h.emit(h.p);await flush();h.loc.setForeground(false);h.advance(3000);h.emit(h.p);assert.equal(h.sent.length,1);resolve({accepted:true});await flush();h.advance(15*60*1000);h.tick();assert.equal(h.loc.status().running,false);assert.equal(h.timers.size,0);
});
test('map hide retains one authorized channel; captured snapshot or unload fully cleans it up',()=>{
 let definition,can=true,stops=0,closes=0,starts=0,polls=0;
 const loc={canBackground:()=>can,stop:()=>{stops++;can=false;},status:()=>({running:can,roomId:'room',matchId:'match'}),syncMatch:s=>{if(s.match.myStatus==='captured')can=false;},start:()=>starts++};
 const api={config:{mode:'local',baseUrl:'http://127.0.0.1:4000'}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../pages/map/map.js'),'utf8'),{Page:p=>definition=p,require:n=>n.includes('location-v2')?loc:n.endsWith('/v2')?api:require(path.resolve(__dirname,'../../pages/map',n)),wx:{getStorageSync:()=> 'me'},Date,Math,Number,setInterval:()=>1,clearInterval(){},clearTimeout(){},setTimeout:()=>1});
 const p={...definition,data:{...definition.data,roomId:'room',roster:[{id:'me',role:'cat',status:'active'}],match:{id:'match',phase:'CHASING',myRole:'cat',myStatus:'active'},markers:[]},active:true,locationRunning:true,socketOpen:true,socket:{close(){closes++;}},setData(s){Object.assign(this.data,s);},poll(){},startPolling(){polls++;}};
 p.onHide();assert.equal(stops,0);assert.equal(closes,0);assert.equal(p.backgroundTracking,true);p.onShow();assert.equal(starts,0);assert.equal(closes,0);assert.equal(polls,0,'healthy retained socket must not start a parallel poller');p.onHide();p.receiveSnapshot({roomId:'room',viewerId:'me',version:3,match:{id:'match',phase:'CHASING',myStatus:'captured'}});assert.equal(stops,1);assert.equal(closes,1);assert.equal(p.backgroundTracking,false);p.onShow();assert.equal(p.data.trackingText,'定位已停止');assert.equal(p.data.backgroundReady,false);p.onUnload();assert.equal(p.socket,null);
});
test('server binds background samples to the match and never stores a post-terminal or cross-round sample',async()=>{
 const {Store}=require('./store'),{Service}=require('./service');const root=fs.realpathSync(os.tmpdir()),dir=fs.mkdtempSync(path.join(root,'catmouse-background-'));const store=new Store({dataDir:dir});await store.init();let now=Date.now(),seq=0;const s=new Service(store,{localTest:true,now:()=>now});
 try{const a=crypto.randomUUID(),b=crypto.randomUUID(),r=await s.create(a,{total:2,venue:{lat:32,lng:118,radiusM:200,confirmed:true},nickname:'host'}),id=r.roomId;await s.join(id,b,'other');const sample=()=>({lat:32,lng:118,accuracy:5,sampledAt:now,sampleSeq:++seq,coordinateSystem:'gcj02'});for(const p of [a,b]){await s.location(id,p,sample());await s.ready(id,p,true);}const m=await s.start(id,a);
 const wrong=await s.location(id,a,{...sample(),matchId:crypto.randomUUID()});assert.equal(wrong.accepted,false);assert.equal(wrong.tracking.matchId,m.match.id);
 now+=30000;for(const p of [a,b]){const x=await s.location(id,p,{...sample(),matchId:m.match.id});assert.equal(x.accepted,true);assert.equal(x.tracking.phase,'CHASING');}
 const cat=m.match.myRole==='cat'?a:b,mouse=cat===a?b:a,proof=await s.token(id,mouse);await s.capture(id,cat,{commandId:crypto.randomUUID(),matchId:proof.matchId,token:proof.token});assert.equal(s.positions.size,0);const late=await s.location(id,mouse,{...sample(),matchId:m.match.id});assert.equal(late.accepted,false);assert.equal(late.tracking.phase,'FINISHED');assert.equal(s.positions.size,0);
 for(const p of [a,b]){await s.location(id,p,sample());await s.ready(id,p,true);}const next=await s.start(id,a),before=s.positions.get(id+':'+a).sampleSeq;const old=await s.location(id,a,{...sample(),matchId:m.match.id});assert.equal(old.accepted,false);assert.equal(old.tracking.matchId,next.match.id);assert.equal(s.positions.get(id+':'+a).sampleSeq,before);assert.equal((await store.query('SELECT * FROM match_results')).rows.length,1);
 }finally{await store.close();assert.ok(fs.realpathSync(dir).startsWith(root+path.sep));fs.rmSync(dir,{recursive:true,force:true});}
});
