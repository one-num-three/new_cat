const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),vm=require('node:vm'),WebSocket=require('ws');
const {createServer}=require('./server');
test('live reinforcements update the capture target, preserve identity and clock; all sockets receive common state with authorized positions',async()=>{
 const verifyUrl=process.env.JOIN_VERIFY_DATABASE_URL;
 if(verifyUrl){assert.equal(process.env.NODE_ENV,'test');assert.match(new URL(verifyUrl).pathname,/^\/catmouse_verify_[0-9_]+$/);}
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'catmouse-join-sync-'));let ctx,now=Date.now();const sockets=[];
 const boot=async()=>{ctx=await createServer({env:{NODE_ENV:'test',ENABLE_LOCAL_TEST_IDENTITIES:'true',HOST:'127.0.0.1',DATA_DIR:dir,...(verifyUrl?{DATABASE_URL:verifyUrl}:{})},now:()=>now});ctx.server.listen(0,'127.0.0.1');await new Promise(r=>ctx.server.once('listening',r));};
 const call=async(method,url,body,token)=>{const r=await fetch('http://127.0.0.1:'+ctx.server.address().port+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{await boot();const people=[];for(let i=0;i<13;i++)people.push((await call('POST','/api/v2/session/test',{})).data);
 const host=people[0],created=(await call('POST','/api/v2/rooms',{total:8,cats:2,mice:6,nickname:'host',venue:{lat:32,lng:118,radiusM:200,confirmed:true}},host.token)).data,id=created.roomId,url='/api/v2/rooms/'+id;
 for(let i=1;i<8;i++)assert.equal((await call('POST',url+'/join',{nickname:'p'+i},people[i].token)).status,200);
 let seq=0;const locate=async a=>call('POST',url+'/location',{lat:32,lng:118,accuracy:5,sampledAt:now,sampleSeq:++seq,coordinateSystem:'gcj02'},a.token);
 for(const a of people.slice(0,8)){await locate(a);await call('POST',url+'/ready',{ready:true},a.token);}
 const started=(await call('POST',url+'/start',{},host.token)).data,originalRoles=Object.fromEntries(started.roster.map(p=>[p.id,p.role]));
 now+=30000;for(const a of people.slice(0,8))await locate(a);
 const before=(await call('GET',url,undefined,host.token)).data;assert.equal(before.match.phase,'CHASING');
 const connect=a=>{const ws=new WebSocket('ws://127.0.0.1:'+ctx.server.address().port+'/api/v2/live?room='+id,{headers:{Authorization:'Bearer '+a.token}});ws.on('message',raw=>{const msg=JSON.parse(raw);if(msg.type==='SNAPSHOT')ws.latest=msg.payload;});ws.on('error',()=>{});sockets.push(ws);return ws;};
 people.slice(0,8).forEach(connect);
 const joined=await Promise.all(people.slice(8,10).map(a=>call('POST',url+'/join',{nickname:'late',role:'cat',isOwner:true},a.token)));
 assert.ok(joined.every(r=>r.status===200));assert.deepEqual(joined.map(r=>r.data.role).sort(),['cat','mouse']);
 people.slice(8,10).forEach(connect);
 const pending=(await call('GET',url,undefined,people[8].token)).data;
 assert.equal(pending.owner,false);assert.equal(pending.match.myStatus,'joining');assert.deepEqual(pending.visiblePositions,[]);assert.deepEqual(pending.intel,[]);assert.equal(pending.nearbyCat,false);assert.equal((await call('POST',url+'/token',{},people[8].token)).data.error,'TOKEN_UNAVAILABLE');
 const lateCat=people.slice(8,10).find((a,i)=>joined[i].data.role==='cat'),oldMouse=people.find(a=>originalRoles[a.id]==='mouse');
 const proof=(await call('POST',url+'/token',{},oldMouse.token)).data;
 assert.equal((await call('POST',url+'/capture',{commandId:crypto.randomUUID(),matchId:proof.matchId,token:proof.token},lateCat.token)).status,403);
 for(const a of people.slice(8,10))assert.equal((await locate(a)).data.accepted,true);
 const common=s=>({version:s.version,rules:s.rules,roster:s.roster.map(p=>({id:p.id,nickname:p.nickname,role:p.role,status:p.status})),match:{id:s.match.id,phase:s.match.phase,target:s.match.target,captured:s.match.captured,endsAt:s.match.endsAt},events:s.events});
 const expected=(await call('GET',url,undefined,host.token)).data;
 assert.equal(expected.rules.total,10);assert.equal(expected.rules.cats,3);assert.equal(expected.rules.mice,7);assert.equal(expected.match.target,5);assert.equal(expected.match.joinPolicy,'reinforce-v2');assert.equal(expected.match.targetMouseCount,7);assert.equal(expected.match.endsAt,before.match.endsAt);
 for(const [player,role]of Object.entries(originalRoles))assert.equal(expected.roster.find(p=>p.id===player).role,role);
 for(const a of people.slice(0,10)){const s=(await call('GET',url,undefined,a.token)).data;assert.deepEqual(common(s),common(expected));assert.ok(s.visiblePositions.every(p=>s.roster.find(x=>x.id===p.id).role===s.match.myRole));}
 await new Promise((resolve,reject)=>{const end=Date.now()+4500;const tick=()=>{if(sockets.every(ws=>ws.latest?.version===expected.version))return resolve();if(Date.now()>end)return reject(Error('all-member WS snapshot timeout'));setTimeout(tick,30);};tick();});
 for(const ws of sockets)assert.deepEqual(common(ws.latest),common(expected));
 const duplicate=await Promise.all([call('POST',url+'/join',{nickname:'forged'},people[8].token),call('POST',url+'/join',{nickname:'forged'},people[8].token)]);assert.deepEqual(duplicate[0].data,duplicate[1].data);assert.equal((await call('GET',url,undefined,host.token)).data.roster.length,10);
 const accepted=await call('POST',url+'/capture',{commandId:crypto.randomUUID(),matchId:proof.matchId,token:proof.token},lateCat.token);assert.equal(accepted.data.accepted,true);
 assert.equal((await call('POST',url+'/join',{nickname:'revive'},oldMouse.token)).data.status,'captured');
 assert.equal((await call('GET',url,undefined,oldMouse.token)).data.visiblePositions.length,0);
 const failed=ctx.store.save;ctx.store.save=async()=>{throw Error('write failed');};
 assert.equal((await call('POST',url+'/join',{nickname:'must-rollback'},people[10].token)).status,500);ctx.store.save=failed;
 assert.equal((await call('GET',url,undefined,host.token)).data.roster.length,10);
 assert.equal((await call('POST',url+'/join',{nickname:'timeout'},people[10].token)).data.status,'joining');
 now+=29000;for(const a of people.slice(0,10).filter(a=>a.id!==oldMouse.id))await locate(a);
 now+=1001;const expired=(await call('GET',url,undefined,people[10].token)).data;assert.equal(expired.match.myStatus,'left');assert.equal(expired.match.phase,'CHASING');assert.equal((await locate(people[10])).data.error,'LEFT_MATCH');assert.equal((await call('POST',url+'/pause',{reason:'emergency'},people[10].token)).status,403);
 const leaver=people.slice(1,8).find(a=>a.id!==oldMouse.id);
 assert.equal((await call('POST',url+'/leave',{},leaver.token)).status,200);
 assert.equal((await call('POST',url+'/join',{nickname:'not-a-revival'},leaver.token)).data.status,'left');
 assert.equal((await call('GET',url,undefined,host.token)).data.match.phase,'PAUSED');
 const returningRole=(await call('GET',url,undefined,people[8].token)).data.match.myRole;await ctx.close();ctx=null;await boot();
 const restored=(await call('GET',url,undefined,people[8].token)).data;assert.equal(restored.match.myRole,returningRole);assert.equal(restored.match.myStatus,'active');assert.equal(restored.match.phase,'PAUSED');assert.equal(restored.match.target,5);assert.equal(restored.match.targetMouseCount,8);assert.deepEqual(restored.visiblePositions,[]);
 for(const a of people.slice(0,10).filter(a=>a.id!==oldMouse.id&&a.id!==leaver.id))await locate(a);
 assert.equal((await call('POST',url+'/resume',{},host.token)).status,200);
 now=(await call('GET',url,undefined,host.token)).data.match.endsAt;
 assert.equal((await call('POST',url+'/join',{nickname:'at-deadline'},people[12].token)).data.error,'ROOM_FULL');
 assert.equal((await call('GET',url,undefined,host.token)).data.match.outcome,'mouse_win');
 // Bound reinforcement growth at 60 without producing 50 artificial live sockets.
 const state=(await ctx.store.room(id)).state;for(let i=state.members.length;i<60;i++){const uid=crypto.randomUUID();state.members.push({id:uid,nickname:'capacity',ready:false});state.match.participants.push({id:uid,role:'mouse',status:'left'});}state.rules.total=60;await ctx.store.query('UPDATE rooms SET state=$2 WHERE id=$1',[id,JSON.stringify(state)]);
 assert.equal((await call('POST',url+'/join',{nickname:'overflow'},people[11].token)).data.error,'ROOM_FULL');assert.equal((await call('POST',url+'/join',{nickname:'existing'},people[8].token)).status,200);
 }finally{for(const ws of sockets)ws.terminate();if(ctx)await ctx.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('lobby rejects older HTTP state after WS, shares live transport, and clears callbacks on hide',async()=>{
 const {shouldApplyRoom}=require('../../utils/snapshot-v2');
 assert.equal(shouldApplyRoom({roomId:'a',version:4,serverTime:40},{roomId:'a',version:3,serverTime:99,match:null}),false);
 assert.equal(shouldApplyRoom({roomId:'a',version:4,serverTime:40},{roomId:'a',version:4,serverTime:39,match:null}),false);
 assert.equal(shouldApplyRoom({roomId:'a',version:4,serverTime:40},{roomId:'b',version:5,serverTime:50,match:null}),false);
 let definition,resolveRead,serial=0;const intervals=new Map(),timeouts=new Map(),sockets=[];
 const api={config:{mode:'local',baseUrl:'http://127.0.0.1:4000'},room:()=>new Promise(r=>resolveRead=r)};
 const wx={getStorageSync:()=> 'me',setNavigationBarTitle(){},connectSocket:o=>{assert.equal(typeof o.success,'function');const handlers={};const task={onOpen:f=>handlers.open=f,onClose:f=>handlers.close=f,onError:f=>handlers.error=f,onMessage:f=>handlers.message=f,send(){},close(){handlers.close?.();},handlers};sockets.push(task);return task;}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../pages/room/room.js'),'utf8'),{Page:p=>definition=p,require:n=>n.includes('room-live')?require('../../utils/room-live'):n.includes('snapshot-v2')?require('../../utils/snapshot-v2'):n.includes('venue-boundary')?require('../../utils/venue-boundary'):n.includes('venue-catalog')?require('../../utils/venue-catalog'):n.includes('presentation')?{}:api,wx,Date,Math,Number,encodeURIComponent,setInterval:f=>{intervals.set(++serial,f);return serial;},clearInterval:id=>intervals.delete(id),setTimeout:f=>{timeouts.set(++serial,f);return serial;},clearTimeout:id=>timeouts.delete(id)});
 // The shared module receives the page's timer adapter, so its handles are verified too.
 const p={...definition,data:JSON.parse(JSON.stringify(definition.data)),active:true,lifecycle:1,setData(x){Object.assign(this.data,x);}};p.data.roomId='room';p.startSocket();sockets[0].handlers.open();
 const waiting=p.refresh();const newer={roomId:'room',version:5,serverTime:50,code:'ABCDEF0123',owner:false,venue:{mapId:'xuanwu-v4',radiusM:200},rules:{total:2,cats:1,mice:1},match:null,roster:[{id:'me',nickname:'me',ready:false},{id:'other',nickname:'other',ready:true}]};
 sockets[0].handlers.message({data:JSON.stringify({type:'SNAPSHOT',payload:newer})});assert.equal(p.data.roster.length,2);
 resolveRead({...newer,version:4,serverTime:99,roster:newer.roster.slice(0,1)});await waiting;assert.equal(p.data.roster.length,2);
 p.stop();sockets[0].handlers.message({data:JSON.stringify({type:'SNAPSHOT',payload:{...newer,version:6,roster:[]}})});assert.equal(p.data.roster.length,2);assert.equal(p.socket,null);assert.equal(intervals.size,0);assert.equal(timeouts.size,0);
});
