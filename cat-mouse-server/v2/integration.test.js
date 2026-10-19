const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('./server');
const { Store } = require('./store');
const { Service } = require('./service');
const WebSocket = require('ws');
test('trusted two identity round trip, permissions, capture, persistence and restart', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'catmouse-'));
  let now = Date.now(), ctx;
  const env = { NODE_ENV: 'test', ENABLE_LOCAL_TEST_IDENTITIES: 'true', DATA_DIR: dataDir };
  const boot = async () => { ctx = await createServer({ env, now: () => now }); ctx.server.listen(0, '127.0.0.1'); await new Promise(r => ctx.server.once('listening', r)); };
  const req = async (method, url, body, token) => {
    const r = await fetch(`http://127.0.0.1:${ctx.server.address().port}${url}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text=await r.text(); let data; try{data=JSON.parse(text);}catch{data={text};} return { status: r.status, data };
  };
  try {
    await boot();
    const version=(await req('GET','/api/version')).data;
    assert.equal(version.version,'0.3.2');assert.equal(version.capabilities.multiVenueMaps,true);
    const a = (await req('POST','/api/v2/session/test',{})).data, b = (await req('POST','/api/v2/session/test',{})).data, c=(await req('POST','/api/v2/session/test',{})).data;
    assert.equal((await req('GET','/api/v2/rooms/NOPE')).status,401);
    assert.equal((await req('POST','/api/v2/rooms',{ total: 1, venue: { lat:32,lng:118,radiusM:200,confirmed:true }, nickname:'a' },a.token)).data.error,'INVALID_PRESET');
    assert.equal((await req('POST','/api/v2/rooms',{ total: 2, catCount:2, venue: { lat:32,lng:118,radiusM:200,confirmed:true }, nickname:'a' },a.token)).data.error,'INVALID_CONFIG');
    const room = (await req('POST','/api/v2/rooms',{ total: 2, venue: { lat:32,lng:118,radiusM:200,confirmed:true }, nickname:'a' },a.token)).data;
    const id = room.roomId;
    const join = await req('POST',`/api/v2/rooms/${id}/join`,{ nickname:'b', isOwner:true },b.token); assert.equal(join.status,200);
    assert.equal((await req('POST',`/api/v2/rooms/${id}/join`,{ nickname:'b' },b.token)).status,200);
    assert.equal((await req('POST',`/api/v2/rooms/${id}/join`,{ nickname:'c' },c.token)).data.error,'ROOM_FULL');
    assert.equal((await req('GET',`/api/v2/rooms/${id}`,undefined,c.token)).status,403);
    assert.equal((await req('PUT',`/api/v2/rooms/${id}/settings`,{winner:'cat_win'},c.token)).status,404);
    assert.equal((await req('POST',`/api/v2/rooms/${id}/start`,{},b.token)).status,403);
    assert.equal((await req('POST',`/api/v2/rooms/${id}/cancel`,{ winner:'cat_win' },b.token)).status,403);
    assert.equal((await req('POST',`/api/v2/rooms/${id}/start`,{},a.token)).data.error,'NOT_READY');
    let seq = 1;
    const loc = (token, lat=32, lng=118) => req('POST',`/api/v2/rooms/${id}/location`,{ lat,lng,accuracy:5,sampledAt:now,sampleSeq:seq++,coordinateSystem:'gcj02' },token);
    assert.equal((await loc(a.token)).status,200); assert.equal((await loc(b.token)).status,200);
    assert.equal((await req('POST',`/api/v2/rooms/${id}/ready`,{ ready:true },a.token)).status,200);
    assert.equal((await req('POST',`/api/v2/rooms/${id}/ready`,{ ready:true },b.token)).status,200);
    const started = (await req('POST',`/api/v2/rooms/${id}/start`,{},a.token)).data;
    assert.equal(started.match.phase,'HIDING'); assert.equal(started.rules.version,'pilot-0.2');
    const matchId = started.match.id;
    assert.equal((await req('POST',`/api/v2/rooms/${id}/token`,{},a.token)).status,400);
    now += 30000; await loc(a.token); await loc(b.token);
    const av = (await req('GET',`/api/v2/rooms/${id}`,undefined,a.token)).data;
    const bv = (await req('GET',`/api/v2/rooms/${id}`,undefined,b.token)).data;
    assert.equal(av.match.phase,'CHASING'); assert.equal(av.match.id,bv.match.id);
    const mouseToken = av.match.myRole === 'mouse' ? a.token : b.token;
    const catToken = av.match.myRole === 'cat' ? a.token : b.token;
    const catView = av.match.myRole === 'cat' ? av : bv;
    assert.equal(catView.visiblePositions.length,1);
    assert.equal(catView.intel.length,1);
    assert.equal(catView.intel[0].lat,undefined);
    const wsUrl=`ws://127.0.0.1:${ctx.server.address().port}/api/v2/live?room=${id}`;
    await new Promise(resolve=>{const ws=new WebSocket(wsUrl);ws.on('error',()=>resolve());ws.on('close',()=>resolve());});
    const ws=new WebSocket(wsUrl,{headers:{Authorization:`Bearer ${catToken}`}});
    const pushed=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('WS timeout')),4000);ws.on('message',raw=>{const msg=JSON.parse(raw);if(msg.type==='SNAPSHOT'){clearTimeout(timeout);resolve(msg.payload);}});ws.on('error',reject);});
    assert.equal(pushed.visiblePositions.length,1); ws.close();
    const qr = (await req('POST',`/api/v2/rooms/${id}/token`,{},mouseToken)).data;
    assert.ok(qr.token);
    assert.equal(Buffer.from(qr.qrPngBase64,'base64').subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal((await req('POST',`/api/v2/rooms/${id}/capture`,{ commandId:crypto.randomUUID(),matchId,token:'fake' },catToken)).data.error,'INVALID_TOKEN');
    const cmd = { commandId:crypto.randomUUID(), matchId, token:qr.token };
    const first = await req('POST',`/api/v2/rooms/${id}/capture`,cmd,catToken); assert.equal(first.status,200); assert.equal(first.data.outcome,'cat_win');
    assert.deepEqual((await req('POST',`/api/v2/rooms/${id}/capture`,cmd,catToken)).data,first.data);
    assert.equal((await req('POST',`/api/v2/rooms/${id}/capture`,{...cmd,commandId:crypto.randomUUID()},catToken)).status,400);
    const endedA = (await req('GET',`/api/v2/rooms/${id}`,undefined,a.token)).data;
    const endedB = (await req('GET',`/api/v2/rooms/${id}`,undefined,b.token)).data;
    assert.equal(endedA.match.outcome,endedB.match.outcome); assert.deepEqual(endedA.visiblePositions,[]);
    assert.equal(ctx.service.positions.size,0);
    await ctx.close(); await boot();
    const restored = (await req('GET',`/api/v2/rooms/${id}`,undefined,a.token)).data;
    assert.equal(restored.match.outcome,'cat_win'); assert.equal(restored.match.id,matchId);
    assert.equal((await req('POST',`/api/v2/rooms/${id}/start`,{},a.token)).data.error,'NOT_READY');
    await loc(a.token); await loc(b.token);
    const secondResponse = await req('POST',`/api/v2/rooms/${id}/start`,{},a.token); assert.equal(secondResponse.status,200,JSON.stringify(secondResponse.data)); const second=secondResponse.data;
    assert.notEqual(second.match.id,matchId);
    assert.notEqual(second.roster.find(p=>p.role==='cat').id,started.roster.find(p=>p.role==='cat').id);
    assert.equal((await req('GET',`/api/v2/matches/${matchId}/result`,undefined,b.token)).data.outcome,'cat_win');
    assert.equal((await req('POST',`/api/v2/rooms/${id}/capture`,{commandId:crypto.randomUUID(),matchId:second.match.id,token:qr.token},catToken)).status,400);
    assert.equal((await req('POST',`/api/v2/rooms/${id}/pause`,{reason:'host'},b.token)).status,403);
    assert.equal((await req('POST',`/api/v2/rooms/${id}/pause`,{reason:'host'},a.token)).status,200);
    assert.equal((await req('POST',`/api/v2/rooms/${id}/resume`,{},b.token)).status,403);
    await loc(a.token); await loc(b.token);
    assert.equal((await req('POST',`/api/v2/rooms/${id}/resume`,{},a.token)).status,200);
    now += 30000; await loc(a.token); await loc(b.token);
    const nextViewA = (await req('GET',`/api/v2/rooms/${id}`,undefined,a.token)).data;
    const nextMouse = nextViewA.match.myRole==='mouse' ? a.token : b.token;
    const nextCat = nextViewA.match.myRole==='cat' ? a.token : b.token;
    const expiring = (await req('POST',`/api/v2/rooms/${id}/token`,{},nextMouse)).data;
    now += 15000; await loc(a.token); await loc(b.token);
    assert.equal((await req('POST',`/api/v2/rooms/${id}/capture`,{commandId:crypto.randomUUID(),matchId:second.match.id,token:expiring.token},nextCat)).data.error,'INVALID_TOKEN');
    now += 345000;
    assert.equal((await req('POST',`/api/v2/rooms/${id}/capture`,{commandId:crypto.randomUUID(),matchId:second.match.id,token:expiring.token},nextCat)).data.error,'NOT_CHASING');
    assert.equal((await req('GET',`/api/v2/rooms/${id}`,undefined,b.token)).data.match.outcome,'mouse_win');
    assert.equal((await req('GET',`/api/v2/matches/${matchId}/result`,undefined,a.token)).data.outcome,'cat_win');
  } finally { await ctx.close(); fs.rmSync(dataDir,{recursive:true,force:true}); }
});

test('failed database write rolls back capture and token consumption', async () => {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'catmouse-fail-'));
  const store=new Store({dataDir}); await store.init(); let now=Date.now(); const service=new Service(store,{localTest:true,now:()=>now});
  try {
    const a=crypto.randomUUID(),b=crypto.randomUUID();
    const room=await service.create(a,{total:2,venue:{lat:32,lng:118,radiusM:200,confirmed:true},nickname:'a'});
    await service.join(room.roomId,b,'b'); let seq=0;
    const location=id=>service.location(room.roomId,id,{lat:32,lng:118,accuracy:5,sampledAt:now,sampleSeq:++seq,coordinateSystem:'gcj02'});
    await location(a); await location(b); await service.ready(room.roomId,a,true); await service.ready(room.roomId,b,true);
    await service.start(room.roomId,a); now+=30000; await location(a); await location(b);
    const view=await service.read(room.roomId,a); const cat=view.match.myRole==='cat'?a:b, mouse=cat===a?b:a;
    const qr=await service.token(room.roomId,mouse); const command={commandId:crypto.randomUUID(),matchId:qr.matchId,token:qr.token};
    const original=store.save.bind(store); store.save=()=>{throw Error('db down');};
    await assert.rejects(service.capture(room.roomId,cat,command),/db down/); store.save=original;
    assert.equal((await service.read(room.roomId,cat)).match.captured,0);
    assert.equal((await service.capture(room.roomId,cat,command)).outcome,'cat_win');
  } finally { await store.close(); fs.rmSync(dataDir,{recursive:true,force:true}); }
});

test('standard six player preset serializes two cats capturing one mouse', async () => {
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'catmouse-six-'));
  const store=new Store({dataDir}); await store.init(); let now=Date.now(); const service=new Service(store,{now:()=>now});
  try {
    const ids=Array.from({length:6},()=>crypto.randomUUID()), room=await service.create(ids[0],{total:6,venue:{lat:32,lng:118,radiusM:200,confirmed:true},nickname:'p0'});
    for(let i=1;i<6;i++) await service.join(room.roomId,ids[i],`p${i}`);
    let seq=0; const loc=id=>service.location(room.roomId,id,{lat:32,lng:118,accuracy:5,sampledAt:now,sampleSeq:++seq,coordinateSystem:'gcj02'});
    for(const id of ids){await loc(id);await service.ready(room.roomId,id,true);}
    await service.start(room.roomId,ids[0]); now+=30000; for(const id of ids) await loc(id);
    const view=await service.read(room.roomId,ids[0]), cats=view.roster.filter(p=>p.role==='cat').map(p=>p.id), mouse=view.roster.find(p=>p.role==='mouse').id;
    assert.equal(cats.length,2); assert.equal(view.match.target,3);
    const catView=await service.read(room.roomId,cats[0]); assert.equal(catView.visiblePositions.length,2); assert.equal(catView.intel.length,4);
    const mouseView=await service.read(room.roomId,mouse);
    assert.equal(mouseView.nearbyCat,true);
    assert.equal(mouseView.visiblePositions.length,4);
    assert.ok(mouseView.visiblePositions.every(p=>!cats.includes(p.id)));
    assert.equal(JSON.stringify(mouseView).includes('nearby_cat'),false);
    const token=await service.token(room.roomId,mouse);
    const attempts=await Promise.allSettled(cats.map(id=>service.capture(room.roomId,id,{commandId:crypto.randomUUID(),matchId:token.matchId,token:token.token})));
    assert.equal(attempts.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(attempts.find(x=>x.status==='rejected').reason.message,'ALREADY_CAPTURED');
    const after=await service.read(room.roomId,mouse); assert.equal(after.match.captured,1); assert.deepEqual(after.visiblePositions,[]); assert.deepEqual(after.intel,[]);
    assert.equal(after.events.filter(e=>e.kind==='CAPTURE').length,1);
    const leaving=after.roster.find(p=>p.status==='active' && p.id!==ids[0]).id;
    await service.leave(room.roomId,leaving);
    assert.equal(service.fresh(leaving,room.roomId),null);
    assert.equal((await service.read(room.roomId,ids[0])).match.pauseReason,'leave');
    assert.equal((await service.cancel(room.roomId,ids[0])).outcome,'cancelled');
    assert.equal((await service.read(room.roomId,ids[0])).match.outcome,'cancelled');
    assert.equal(service.positions.size,0);
  } finally { await store.close(); fs.rmSync(dataDir,{recursive:true,force:true}); }
});

test('active match restart pauses and requires fresh positions', async()=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'catmouse-restart-'));let now=Date.now();let store=new Store({dataDir});await store.init();let service=new Service(store,{localTest:true,now:()=>now});
  try{
    const a=crypto.randomUUID(),b=crypto.randomUUID(),room=await service.create(a,{total:2,venue:{lat:32,lng:118,radiusM:200,confirmed:true},nickname:'a'});
    await service.join(room.roomId,b,'b');let seq=0;let locate=async id=>service.location(room.roomId,id,{lat:32,lng:118,accuracy:5,sampledAt:now,sampleSeq:++seq,coordinateSystem:'gcj02'});
    await locate(a);await locate(b);await service.ready(room.roomId,a,true);await service.ready(room.roomId,b,true);await service.start(room.roomId,a);
    await store.close();now+=120000;store=new Store({dataDir});await store.init();service=new Service(store,{localTest:true,now:()=>now});await service.recover();
    const restored=await service.read(room.roomId,a);assert.equal(restored.match.phase,'PAUSED');assert.equal(restored.match.remainingMs,30000);
    await assert.rejects(service.resume(room.roomId,a),/LOCATION_REQUIRED/);
    await locate(a);await locate(b);assert.equal((await service.resume(room.roomId,a)).match.phase,'HIDING');
    now+=5000;await service.location(room.roomId,b,{lat:32.0008,lng:118,accuracy:5,sampledAt:now,sampleSeq:++seq,coordinateSystem:'gcj02'});
    now+=5000;await service.location(room.roomId,b,{lat:32.0016,lng:118,accuracy:5,sampledAt:now,sampleSeq:++seq,coordinateSystem:'gcj02'});
    const outside=async()=>service.location(room.roomId,b,{lat:32.0024,lng:118,accuracy:5,sampledAt:now,sampleSeq:++seq,coordinateSystem:'gcj02'});
    now+=5000;assert.equal((await outside()).accepted,false);now+=5000;assert.equal((await outside()).accepted,false);
    assert.equal((await service.read(room.roomId,b)).roster.find(p=>p.id===a).presence,'reconnecting');
    now+=5000;assert.equal((await outside()).accepted,false);
    assert.equal((await service.read(room.roomId,a)).match.pauseReason,'outside_venue');
  }finally{await store.close();fs.rmSync(dataDir,{recursive:true,force:true});}
});
