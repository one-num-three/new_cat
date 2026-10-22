const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {Store}=require('./store'),{Service}=require('./service'),{project}=require('../../utils/presentation');
test('every connected participant can return to next-round preparation without gaining host actions',()=>{
 for(const outcome of ['cat_win','mouse_win',null]){
  const s={owner:false,roster:[],match:{id:'old',phase:outcome?'FINISHED':'CANCELLED',myRole:'mouse',myStatus:'captured',outcome}};
  assert.equal(project(s).canReplay,true);assert.equal(project(s).canResume,false);assert.equal(project(s).canScan,false);assert.equal(project(s,true).canReplay,false);
 }
});
test('capture rejection remains visible after authorized polling and live snapshots until the next scan',async()=>{
 let definition,version=1;const id=crypto.randomUUID(),matchId=crypto.randomUUID();
 const api={config:{},capture:async()=>{const e=Error('这名鼠已被捕');e.code='ALREADY_CAPTURED';throw e;}},loc={once:async()=>{},stop(){},start(){}};
 const wx={getStorageSync:()=>id,scanCode(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../pages/map/map.js'),'utf8'),{Page:p=>definition=p,require:n=>n.includes('location-v2')?loc:n.endsWith('/v2')?api:require(path.resolve(__dirname,'../../pages/map',n)),wx,Date,Math,Number});
 const snapshot=()=>({version:++version,serverTime:version,venue:{lat:32,lng:118},roster:[{id,role:'cat',status:'active'}],visiblePositions:[],events:[],match:{id:matchId,phase:'CHASING',myRole:'cat',myStatus:'active',remainingMs:10000,captured:1,target:4}});
 const p={...definition,active:true,data:{roomId:'room',match:snapshot().match,roster:[],canScan:true,offline:false},setData(patch){Object.assign(this.data,patch);},onMapReady(){},startLocation(){},updateClock(){},poll:async function(){this.apply(snapshot());}};
 p.pendingCapture={roomId:'room',matchId,token:'test-proof',commandId:crypto.randomUUID()};await p.submitCapture();assert.match(p.data.error,/已被捕/);p.apply(snapshot());assert.match(p.data.error,/已被捕/);
 p.scan();assert.equal(p.data.error,'');
});
test('same-role old viewer snapshots and old HTTP unauthorized responses cannot replace the current session',async()=>{
 const callbacks=[],tasks=[],storage=new Map([['v2Token','new-token'],['v2UserId','new-user']]);let received=0,dropped=0;
 const wx={getStorageSync:k=>storage.get(k)||'',setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),request:o=>callbacks.push(o),connectSocket:()=>{const t={onOpen(){},onMessage(f){this.message=f;},onClose(){},onError(){},close(){}};tasks.push(t);return t;}};
 const p={...require('../../utils/room-live').create({config:{baseUrl:'http://localhost',mode:'local'}},wx),active:true,data:{roomId:'room'},receiveSnapshot(){received++;},socketDropped(){dropped++;},setData(){}};
 p.startSocket();tasks[0].message({data:JSON.stringify({type:'SNAPSHOT',payload:{viewerId:'old-user',owner:true,roster:[{id:'new-user',role:'mouse',status:'captured'}],match:{myRole:'mouse',myStatus:'captured'}}})});assert.equal(received,0);assert.equal(dropped,1);
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../utils/v2.js'),'utf8'),{module,require:()=>({mode:'local',baseUrl:'http://localhost'}),wx,Promise,Error,encodeURIComponent});
 const pending=module.exports.room('room');storage.set('v2Token','another-token');storage.set('v2UserId','another-user');callbacks[0].success({statusCode:401,data:{error:'UNAUTHENTICATED'}});await assert.rejects(pending,e=>e.code==='STALE_SESSION');assert.equal(storage.get('v2Token'),'another-token');assert.equal(storage.get('v2UserId'),'another-user');
});
test('terminal round clears all readiness; new locations alone cannot restart or overwrite its stored result',async()=>{
 const tempRoot=fs.realpathSync(os.tmpdir()),dir=fs.mkdtempSync(path.join(tempRoot,'catmouse-replay-')),store=new Store({dataDir:dir});let now=Date.now(),seq=0;
 try{await store.init();const service=new Service(store,{localTest:true,now:()=>now}),ids=[crypto.randomUUID(),crypto.randomUUID()];
  const room=await service.create(ids[0],{total:2,nickname:'host',venue:{lat:32,lng:118,radiusM:200,confirmed:true}});await service.join(room.roomId,ids[1],'player');
  const loc=async id=>service.location(room.roomId,id,{lat:32,lng:118,accuracy:5,sampledAt:now,sampleSeq:++seq,coordinateSystem:'gcj02'});
  for(const id of ids){await loc(id);await service.ready(room.roomId,id,true);}const started=await service.start(room.roomId,ids[0]);now+=30000;for(const id of ids)await loc(id);
  const view=await service.read(room.roomId,ids[0]),cat=view.roster.find(p=>p.role==='cat').id,mouse=view.roster.find(p=>p.role==='mouse').id;
  const proof=await service.token(room.roomId,mouse);await service.capture(room.roomId,cat,{commandId:crypto.randomUUID(),matchId:started.match.id,token:proof.token});
  const ended=await service.read(room.roomId,ids[0]);assert.ok(ended.roster.every(p=>p.ready===false),'previous readiness must not carry into another round');assert.equal(service.positions.size,0);
  const old=(await store.query('SELECT result FROM match_results WHERE match_id=$1',[started.match.id])).rows[0].result;
  for(const id of ids)await loc(id);await assert.rejects(()=>service.start(room.roomId,ids[0]),e=>e.code==='NOT_READY');
  for(const id of ids)await service.ready(room.roomId,id,true);await assert.rejects(()=>service.start(room.roomId,ids[1]),e=>e.code==='FORBIDDEN');
  const next=await service.start(room.roomId,ids[0]);assert.notEqual(next.match.id,started.match.id);assert.equal(next.match.captured,0);assert.ok(next.roster.every(p=>p.status==='active'));assert.notEqual(next.roster.find(p=>p.id===cat).role,'cat');
  assert.deepEqual((await store.query('SELECT result FROM match_results WHERE match_id=$1',[started.match.id])).rows[0].result,old);assert.equal((await store.query('SELECT count(*)::int AS n FROM match_results WHERE match_id=$1',[started.match.id])).rows[0].n,1);
 }finally{await store.close();assert.ok(fs.realpathSync(dir).startsWith(tempRoot+path.sep));fs.rmSync(dir,{recursive:true,force:true});}
});
