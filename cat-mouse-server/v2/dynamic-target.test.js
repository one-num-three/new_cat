const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {Store}=require('./store'),{Service}=require('./service');
async function fixture(run){
 const verifyUrl=process.env.DYNAMIC_VERIFY_DATABASE_URL;
 if(verifyUrl){assert.equal(process.env.NODE_ENV,'test');assert.match(new URL(verifyUrl).pathname,/^\/catmouse_verify_[0-9_]+$/);}
 const tempRoot=fs.realpathSync(os.tmpdir()),dir=fs.mkdtempSync(path.join(tempRoot,'catmouse-dynamic-'));
 const store=new Store({dataDir:dir,url:verifyUrl});await store.init();let now=Date.now(),seq=0;
 const service=new Service(store,{localTest:true,now:()=>now}),ids=Array.from({length:14},()=>crypto.randomUUID());
 try{
  const {roomId}=await service.create(ids[0],{total:8,cats:2,mice:6,nickname:'host',venue:{lat:32,lng:118,radiusM:200,confirmed:true}});
  for(const id of ids.slice(1,8))await service.join(roomId,id,'player');
  const locate=id=>service.location(roomId,id,{lat:32,lng:118,accuracy:5,sampledAt:now,sampleSeq:++seq,coordinateSystem:'gcj02'});
  for(const id of ids.slice(0,8)){await locate(id);await service.ready(roomId,id,true);}
  await service.start(roomId,ids[0]);now+=30000;for(const id of ids.slice(0,8))await locate(id);
  const view=()=>service.read(roomId,ids[0]),initial=await view(),cat=initial.roster.find(p=>p.role==='cat').id,mice=initial.roster.filter(p=>p.role==='mouse').map(p=>p.id);
  const catchMouse=async mouse=>{const proof=await service.token(roomId,mouse);return service.capture(roomId,cat,{commandId:crypto.randomUUID(),matchId:proof.matchId,token:proof.token});};
  await run({store,service,ids,roomId,locate,view,initial,cat,mice,catchMouse,setNow:value=>now=value});
 }finally{await store.close();assert.ok(fs.realpathSync(dir).startsWith(tempRoot+path.sep));fs.rmSync(dir,{recursive:true,force:true});}
}
test('dynamic targets count admitted mice once across cat joins, concurrent joins, rollback, exit and restart',()=>fixture(async f=>{
 const {service:s,roomId:id,ids,view,store}=f;
 assert.equal((await s.join(id,ids[8],'mouse')).role,'mouse');let v=await view();assert.equal(v.match.target,5);assert.equal(v.match.targetMouseCount,7);
 assert.equal((await s.join(id,ids[9],'cat')).role,'cat');assert.equal((await view()).match.target,5);
 await Promise.all(ids.slice(10,12).map(uid=>s.join(id,uid,'extra')));v=await view();assert.equal(v.rules.cats,3);assert.equal(v.rules.mice,9);assert.equal(v.match.target,6);
 assert.equal(v.match.id,f.initial.match.id);assert.equal(v.match.endsAt,f.initial.match.endsAt);
 const joins=(await store.query("SELECT payload FROM events WHERE match_id=$1 AND kind='JOIN' ORDER BY seq",[v.match.id])).rows.map(r=>r.payload);
 assert.deepEqual(joins.map(e=>e.target),[5,5,5,6]);assert.deepEqual(joins.map(e=>e.previousTarget),[4,5,5,5]);
 await Promise.all([s.join(id,ids[8],'duplicate'),s.join(id,ids[8],'duplicate')]);assert.equal((await view()).roster.length,12);assert.equal((await view()).match.target,6);
 const save=store.save;store.save=async()=>{throw Error('db target rollback');};await assert.rejects(s.join(id,ids[12],'failed'),/db target rollback/);store.save=save;
 v=await view();assert.equal(v.roster.length,12);assert.equal(v.match.targetMouseCount,9);assert.equal(v.match.target,6);assert.equal((await store.query("SELECT * FROM events WHERE match_id=$1 AND kind='JOIN'",[v.match.id])).rows.length,4);
 // Expiring pending admissions and disconnecting cannot lower the target.
 f.setNow(f.initial.serverTime+31001);for(const uid of ids.slice(0,8))await f.locate(uid);
 v=await view();assert.ok(v.roster.slice(8).every(p=>p.status==='left'));assert.equal(v.match.target,6);
 await s.pause(id,ids[0],'host');await serviceRecovery();
 async function serviceRecovery(){const restored=new Service(store,{localTest:true,now:()=>f.initial.serverTime+31001});await restored.recover();const v=await restored.read(id,ids[8]);assert.equal(v.match.target,6);assert.equal(v.match.targetMouseCount,9);assert.equal(v.match.myStatus,'left');assert.equal(v.match.phase,'PAUSED');assert.deepEqual(v.visiblePositions,[]);}
}));
test('joining before a near-winning capture raises the target atomically and persists the eventual new result',()=>fixture(async f=>{
 for(const mouse of f.mice.slice(0,3))await f.catchMouse(mouse);
 const proof=await f.service.token(f.roomId,f.mice[3]);
 const [joined,capture]=await Promise.all([f.service.join(f.roomId,f.ids[8],'reinforcement'),f.service.capture(f.roomId,f.cat,{commandId:crypto.randomUUID(),matchId:proof.matchId,token:proof.token})]);
 assert.equal(joined.role,'mouse');assert.equal(capture.outcome,null);let v=await f.view();assert.equal(v.match.captured,4);assert.equal(v.match.target,5);assert.equal(v.match.phase,'CHASING');
 assert.equal((await f.store.query('SELECT * FROM match_results WHERE room_id=$1',[f.roomId])).rows.length,0);
 assert.equal((await f.catchMouse(f.mice[4])).outcome,'cat_win');v=await f.view();assert.equal(v.match.target,5);assert.equal(v.match.captured,5);
 const result=(await f.store.query('SELECT result FROM match_results WHERE room_id=$1',[f.roomId])).rows;assert.equal(result.length,1);assert.equal(result[0].result.target,5);assert.equal(result[0].result.targetMouseCount,7);assert.equal(result[0].result.joinPolicy,'reinforce-v2');
 await assert.rejects(f.service.join(f.roomId,f.ids[9],'too late'),/ROOM_FULL/);await f.view();assert.deepEqual((await f.store.query('SELECT result FROM match_results WHERE room_id=$1',[f.roomId])).rows,result);
}));
test('a committed win or deadline cannot be reopened or rewritten by a late join',()=>fixture(async f=>{
 for(const mouse of f.mice.slice(0,3))await f.catchMouse(mouse);const proof=await f.service.token(f.roomId,f.mice[3]);
 const results=await Promise.allSettled([f.service.capture(f.roomId,f.cat,{commandId:crypto.randomUUID(),matchId:proof.matchId,token:proof.token}),f.service.join(f.roomId,f.ids[8],'late')]);
 assert.equal(results[0].value.outcome,'cat_win');assert.equal(results[1].status,'rejected');const win=await f.view();assert.equal(win.match.target,4);assert.equal(win.roster.length,8);
 for(const uid of f.ids.slice(0,8)){await f.locate(uid);await f.service.ready(f.roomId,uid,true);}const next=await f.service.start(f.roomId,f.ids[0]);assert.notEqual(next.match.id,win.match.id);
 f.setNow(next.match.endsAt);for(const uid of f.ids.slice(0,8))await f.locate(uid);const chase=await f.view();assert.equal(chase.match.phase,'CHASING');
 f.setNow(chase.match.endsAt);await assert.rejects(f.service.join(f.roomId,f.ids[8],'deadline'),/ROOM_FULL/);const timed=await f.view();assert.equal(timed.match.outcome,'mouse_win');assert.equal(timed.match.target,4);assert.equal(timed.roster.length,8);
 const rows=(await f.store.query('SELECT result FROM match_results WHERE room_id=$1',[f.roomId])).rows;assert.equal(rows.length,2);assert.equal(rows.find(r=>r.result.matchId===win.match.id).result.target,4);
}));
