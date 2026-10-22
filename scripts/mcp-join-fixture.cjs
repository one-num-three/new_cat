'use strict';
// Local-only integration fixture. The UI still uses the real authenticated HTTP/WS service.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),WebSocket=require('../cat-mouse-server/node_modules/ws');
const {createServer}=require('../cat-mouse-server/v2/server'),catalog=require('../utils/venue-catalog');
assert.equal(process.env.NODE_ENV,'test');assert.equal(process.env.ENABLE_LOCAL_TEST_IDENTITIES,'true');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const scenario=process.argv[3]||'join',captureScenario=scenario==='capture',dynamicScenario=scenario==='dynamic-target';assert.ok(['join','capture','dynamic-target'].includes(scenario));
const tempRoot=fs.realpathSync(path.join(root,'.local-test-tmp')),dir=fs.mkdtempSync(path.join(tempRoot,'mcp-join-'));assert.ok(fs.realpathSync(dir).startsWith(tempRoot+path.sep));
let ctx,base,roomId,code,selected=-1,busy=false,closing=false,originalRoles,started,capturedIndex;
const actors=[],blocked=new Set(),peers=new Map(),netSockets=new Map(),counts={};
const preparingPeers=new Set();
const point=catalog.get('seu-jiulonghu-v1').demoPoints[0],mapRevision=catalog.get('seu-jiulonghu-v1').sha256;
const call=async(method,url,body,a)=>{const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(a?{Authorization:'Bearer '+a.token}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();return {status:r.status,data};};
const memberIndex=id=>actors.findIndex(a=>a.id===id);
const log=(kind,data)=>fs.appendFileSync(path.join(out,'fixture-events.jsonl'),JSON.stringify({at:new Date().toISOString(),kind,...data})+'\n');
function connect(i){if(blocked.has(i)||[0,1].includes(peers.get(i)?.readyState))return;const a=actors[i],ws=new WebSocket(base.replace('http','ws')+'/api/v2/live?room='+roomId,{headers:{Authorization:'Bearer '+a.token}});peers.set(i,ws);
 ws.on('message',raw=>{if(raw.toString()==='PONG')return;const m=JSON.parse(raw);if(m.type==='SNAPSHOT'){ws.latest=m.payload;counts[i]=(counts[i]||0)+1;}});ws.on('error',()=>{});
}
async function state(){
 const r=await ctx.store.room(roomId),s=r.state,m=s.match;
 const roster=s.members.map(p=>{const q=m?.participants.find(x=>x.id===p.id);return {index:memberIndex(p.id),id:p.id,nickname:p.nickname,ready:p.ready,role:q?.role||null,status:q?.status||null};});
 const aligned=roster.filter(p=>!blocked.has(p.index)).every(p=>{const v=peers.get(p.index)?.latest;return v?.version===s.version&&v.match?.target===m?.target&&v.match?.captured===m?.captured&&v.rules.total===s.rules.total&&v.rules.cats===s.rules.cats&&v.rules.mice===s.rules.mice&&v.roster.length===roster.length&&roster.every(q=>v.roster.some(x=>x.id===q.id&&x.role===q.role&&x.status===q.status));});
 const archived=captureScenario?(await ctx.store.query('SELECT result FROM match_results WHERE room_id=$1',[roomId])).rows.map(r=>r.result):undefined;
 return {roomId,code,selected,roster,version:s.version,rules:s.rules,history:s.history,archivedResults:archived,positionCount:roster.filter(p=>ctx.service.positions.has(roomId+':'+p.id)).length,preparingPeers:[...preparingPeers],match:m?{id:m.id,phase:m.phase,joinPolicy:m.joinPolicy,targetMouseCount:m.targetMouseCount,target:m.target,captured:m.captured,outcome:m.outcome||null,reason:m.reason||null,endsAt:m.endsAt,remainingMs:m.phase==='PAUSED'?m.remainingMs:Math.max(0,m.endsAt-Date.now()),pauseReason:m.pauseReason,eventSeq:m.eventSeq}:null,originalRoles,originalMatchId:started?.match.id,initialTarget:started?.match.target,capturedIndex,blocked:[...blocked],allOnlinePeersAligned:aligned,peerFrames:counts,peerViews:roster.map(p=>{const v=peers.get(p.index)?.latest;return {index:p.index,connected:peers.get(p.index)?.readyState===1,version:v?.version,viewerId:v?.viewerId,owner:v?.owner,role:v?.match?.myRole,status:v?.match?.myStatus,phase:v?.match?.phase,matchId:v?.match?.id,outcome:v?.match?.outcome,target:v?.match?.target,captured:v?.match?.captured,roster:v?.roster,visibleIds:v?.visiblePositions.map(q=>q.id)||[]};})};
}
async function control(data){
 if(data.action==='join-next'){assert.ok(dynamicScenario);assert.ok(data.index>=8&&data.index<actors.length);const r=await call('POST','/api/v2/rooms/'+roomId+'/join',{nickname:actors[data.index].nickname},actors[data.index]);assert.equal(r.status,200);connect(data.index);log('reinforcement_joined',{index:data.index,role:r.data.role});}
 if(data.action==='start'){let r=await call('POST','/api/v2/rooms/'+roomId+'/start',{},actors[0]);assert.equal(r.status,200);if(!captureScenario&&r.data.match.myRole==='cat'){await call('POST','/api/v2/rooms/'+roomId+'/pause',{reason:'host'},actors[0]);await call('POST','/api/v2/rooms/'+roomId+'/cancel',{},actors[0]);for(const a of actors.slice(0,8)){const prev=ctx.service.positions.get(roomId+':'+a.id);await call('POST','/api/v2/rooms/'+roomId+'/location',{...point,accuracy:5,sampledAt:Date.now(),sampleSeq:(prev?.sampleSeq||0)+1,coordinateSystem:'gcj02'},a);await call('POST','/api/v2/rooms/'+roomId+'/ready',{ready:true},a);}r=await call('POST','/api/v2/rooms/'+roomId+'/start',{},actors[0]);assert.equal(r.status,200);log('setup_round_rotated',{priorRoundCancelled:true});}if(!captureScenario)assert.equal(r.data.match.myRole,'mouse');started=r.data;originalRoles=Object.fromEntries(started.roster.map(p=>[p.id,p.role]));log('start',{matchId:started.match.id,roles:originalRoles,target:started.match.target});}
 if(data.action==='prepare-peer'){assert.ok(captureScenario);const s=await state(),p=s.roster.find(p=>p.index===data.index);assert.equal(p.ready,true);assert.ok(ctx.service.positions.has(roomId+':'+p.id));preparingPeers.add(data.index);log('companion_waiting_in_ready_room',{index:data.index});}
 if(data.action==='capture'){const s=await state(),mouse=s.roster.find(p=>p.index<8&&p.role==='mouse'&&p.status==='active'),cat=s.roster.find(p=>p.role==='cat'&&p.status==='active'),proof=(await call('POST','/api/v2/rooms/'+roomId+'/token',{},actors[mouse.index])).data;const r=await call('POST','/api/v2/rooms/'+roomId+'/capture',{commandId:crypto.randomUUID(),matchId:proof.matchId,token:proof.token},actors[cat.index]);assert.equal(r.data.accepted,true);capturedIndex=mouse.index;log('capture',{catIndex:cat.index,mouseIndex:mouse.index,captured:r.data.captured});}
 if(data.action==='offline'){blocked.add(data.index);for(const socket of netSockets.get(data.index)||[])socket.destroy();peers.get(data.index)?.terminate();log('network_partition',{index:data.index});}
 if(data.action==='online'){blocked.delete(data.index);connect(data.index);log('network_restored',{index:data.index});}
 return state();
}
async function shutdown(){if(closing)return;closing=true;clearInterval(gpsTimer);clearInterval(pingTimer);clearTimeout(expiry);for(const ws of peers.values())ws.terminate();await ctx.close();assert.ok(fs.realpathSync(dir).startsWith(tempRoot+path.sep));fs.rmSync(dir,{recursive:true,force:true});log('shutdown',{databaseRemoved:true});process.exit(0);}
let gpsTimer,pingTimer,expiry;
(async()=>{
 ctx=await createServer({env:{NODE_ENV:'test',ENABLE_LOCAL_TEST_IDENTITIES:'true',HOST:'127.0.0.1',DATA_DIR:dir}});
 const request=ctx.server.listeners('request')[0],upgrade=ctx.server.listeners('upgrade')[0];ctx.server.removeAllListeners('request');ctx.server.removeAllListeners('upgrade');
 const actorFor=req=>actors.findIndex(a=>req.headers.authorization==='Bearer '+a.token);
 ctx.server.on('request',async(req,res)=>{
  const url=new URL(req.url,base||'http://127.0.0.1');
  if(url.pathname.startsWith('/__mcp/'))try{
   let result;if(url.pathname==='/__mcp/identity'){const i=Number(url.searchParams.get('index'));assert.ok(Number.isInteger(i)&&actors[i]);selected=i;const a=actors[i],p=ctx.service.positions.get(roomId+':'+a.id);result={...a,index:i,roomId,code,sampleSeq:(p?.sampleSeq||0)+1000};}
   else if(url.pathname==='/__mcp/state')result=await state();
   else if(url.pathname==='/__mcp/control'){let text='';for await(const chunk of req)text+=chunk;result=await control(JSON.parse(text));}
   else if(url.pathname==='/__mcp/shutdown'){res.end('{}');shutdown();return;}
   else throw Error('unknown control');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
  }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));return;}
  if(blocked.has(actorFor(req))){res.destroy();return;}request(req,res);
 });
 ctx.server.on('upgrade',(req,socket,head)=>{const i=actorFor(req);if(blocked.has(i)){socket.destroy();return;}if(!netSockets.has(i))netSockets.set(i,new Set());netSockets.get(i).add(socket);socket.on('close',()=>netSockets.get(i)?.delete(socket));upgrade(req,socket,head);});
 ctx.server.listen(0,'127.0.0.1');await new Promise(r=>ctx.server.once('listening',r));base='http://127.0.0.1:'+ctx.server.address().port;
 for(let i=0;i<(dynamicScenario?12:captureScenario?8:10);i++){const a=(await call('POST','/api/v2/session/test',{})).data;actors.push({...a,nickname:'P'+String(i+1).padStart(2,'0')+(i===0?'·房主':i>7?'·补入':'·玩家')});}
 const created=await call('POST','/api/v2/rooms',{total:8,cats:2,mice:6,nickname:actors[0].nickname,venue:{...point,radiusM:200,confirmed:true,mapId:'seu-jiulonghu-v1'},mapRevision},actors[0]);assert.equal(created.status,200);roomId=created.data.roomId;code=created.data.code;
 for(let i=1;i<8;i++)assert.equal((await call('POST','/api/v2/rooms/'+roomId+'/join',{nickname:actors[i].nickname},actors[i])).status,200);
 const locate=async i=>{const p=ctx.service.positions.get(roomId+':'+actors[i].id);return call('POST','/api/v2/rooms/'+roomId+'/location',{...point,accuracy:5,sampledAt:Date.now(),sampleSeq:(p?.sampleSeq||0)+1,coordinateSystem:'gcj02'},actors[i]);};
 for(let i=0;i<8;i++){await locate(i);await call('POST','/api/v2/rooms/'+roomId+'/ready',{ready:true},actors[i]);connect(i);}
 gpsTimer=setInterval(async()=>{if(busy)return;busy=true;try{const s=await state(),done=['FINISHED','CANCELLED'].includes(s.match?.phase);for(const p of s.roster){if(!blocked.has(p.index)){connect(p.index);const eligible=captureScenario&&done?preparingPeers.has(p.index):!['captured','left'].includes(p.status);if(p.index!==selected&&eligible)await locate(p.index);}}}catch(e){log('fixture_driver_error',{message:e.message});}finally{busy=false;}},2000);
 pingTimer=setInterval(()=>{for(const [i,ws]of peers)if(!blocked.has(i)&&ws.readyState===1)ws.send('PING');},5000);
 expiry=setTimeout(shutdown,15*60*1000);
 fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify({base,ws:base.replace('http','ws'),roomId,code,point,dataDir:dir,database:'isolated local PGlite',realServerClock:true,simulatedGps:true,players:actors.length,scenario,productionDataWritten:false},null,2));console.log('LOCAL_FIXTURE_READY '+base+' room='+code);
})().catch(e=>{console.error('FIXTURE_FAILED',e.message);process.exitCode=1;});
