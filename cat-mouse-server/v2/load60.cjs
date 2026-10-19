const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {createServer}=require('./server');
const WebSocket=require('ws');

const percentile=(values,p)=>values.length?Math.round([...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))]):null;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

(async()=>{
  let loadDatabaseUrl=process.env.LOAD_DATABASE_URL;
  if(!loadDatabaseUrl && process.env.LOAD_USE_COMPOSE_TEST_DB==='true' && process.env.DATABASE_URL){const url=new URL(process.env.DATABASE_URL);url.pathname='/catmouse_loadtest';loadDatabaseUrl=url.toString();}
  if(loadDatabaseUrl){
    const databaseName=decodeURIComponent(new URL(loadDatabaseUrl).pathname.slice(1));
    if(process.env.LOAD_ISOLATED_DB!=='true' || !databaseName.endsWith('_loadtest'))throw Error('LOAD_DATABASE_URL must point to an explicitly confirmed isolated *_loadtest database');
  }
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'catmouse-load-'));
  let ctx;
  const sockets=[];
  try {
    ctx=await createServer({env:{NODE_ENV:'test',ENABLE_LOCAL_TEST_IDENTITIES:'true',DATA_DIR:dataDir,DATABASE_URL:loadDatabaseUrl}});
    const rooms=[],users=[];
    for(let roomIndex=0;roomIndex<5;roomIndex++){
      const ids=Array.from({length:12},()=>crypto.randomUUID());
      const room=await ctx.service.create(ids[0],{total:12,venue:{lat:32,lng:118,radiusM:200,confirmed:true},nickname:'p0'});
      for(let i=1;i<12;i++)await ctx.service.join(room.roomId,ids[i],`p${i}`);
      const members=[];
      for(const id of ids){const session=await ctx.store.createSession(id);const user={roomId:room.roomId,id,token:session.token,seq:0};members.push(user);users.push(user);}
      rooms.push({roomId:room.roomId,owner:ids[0],members});
    }
    for(const room of rooms)for(const u of room.members){
      await ctx.service.location(u.roomId,u.id,{lat:32,lng:118,accuracy:5,sampledAt:Date.now(),sampleSeq:++u.seq,coordinateSystem:'gcj02'});
      await ctx.service.ready(u.roomId,u.id,true);
    }
    for(const room of rooms){
      for(const u of room.members)await ctx.service.location(u.roomId,u.id,{lat:32,lng:118,accuracy:5,sampledAt:Date.now(),sampleSeq:++u.seq,coordinateSystem:'gcj02'});
      await ctx.service.start(room.roomId,room.owner);
    }
    ctx.server.listen(0,'127.0.0.1');await new Promise(resolve=>ctx.server.once('listening',resolve));
    const port=ctx.server.address().port,base=`http://127.0.0.1:${port}`;
    let wsFrames=0,wsBytes=0,wsErrors=0,locationFailures=0,snapshotFailures=0,bodyBytes=0;
    const locationMs=[],snapshotMs=[],wsDeliveryMs=[];
    const connect=u=>new Promise((resolve,reject)=>{
      const ws=new WebSocket(`ws://127.0.0.1:${port}/api/v2/live?room=${u.roomId}`,{headers:{Authorization:`Bearer ${u.token}`}});
      ws.once('open',()=>resolve(ws));ws.once('error',reject);
      ws.on('error',()=>{wsErrors++;});
      ws.on('message',raw=>{try{const message=JSON.parse(raw);if(message.type==='SNAPSHOT'){wsFrames++;wsBytes+=raw.length;const own=message.payload.visiblePositions.find(p=>p.id===u.id);if(u.expectedLat && own && Math.abs(own.lat-u.expectedLat)<1e-8){wsDeliveryMs.push(performance.now()-u.sentAt);u.expectedLat=null;}}}catch{}});
    });
    sockets.push(...await Promise.all(users.map(connect)));
    const started=performance.now();
    for(let cycle=0;cycle<4;cycle++){
      const wave=performance.now();
      await Promise.all(users.map(async u=>{
        const began=performance.now();u.sentAt=began;u.expectedLat=32+(cycle+1)*0.00001;
        try{
          const res=await fetch(`${base}/api/v2/rooms/${u.roomId}/location`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${u.token}`},body:JSON.stringify({lat:u.expectedLat,lng:118,accuracy:5,sampledAt:Date.now(),sampleSeq:++u.seq,coordinateSystem:'gcj02'})});
          if(!res.ok || !(await res.json()).accepted)locationFailures++;
        }catch{locationFailures++;}
        locationMs.push(performance.now()-began);
      }));
      await Promise.all(users.map(async u=>{
        const began=performance.now();
        try{const res=await fetch(`${base}/api/v2/rooms/${u.roomId}`,{headers:{Authorization:`Bearer ${u.token}`}});const body=await res.text();if(!res.ok)snapshotFailures++;bodyBytes+=Buffer.byteLength(body);}catch{snapshotFailures++;}
        snapshotMs.push(performance.now()-began);
      }));
      if(cycle===1){
        const dropped=sockets.splice(0,18);
        await Promise.all(dropped.map(ws=>new Promise(resolve=>{ws.once('close',resolve);ws.close();setTimeout(resolve,1000);})));
        sockets.push(...await Promise.all(users.slice(0,18).map(connect)));
      }
      await sleep(Math.max(0,2000-(performance.now()-wave)));
    }
    const elapsedSec=(performance.now()-started)/1000;
    const result={scope:loadDatabaseUrl?'Same-host loopback load against an isolated PostgreSQL *_loadtest database; client and API share one Node process; not public network or device validation':'Local loopback Node + embedded PostgreSQL with client and server in one process; not a device, public network, production PostgreSQL or 4-core server result',databaseBackend:loadDatabaseUrl?'PostgreSQL isolated test DB':'PGlite local',rooms:5,online:60,locationIntervalTargetMs:2000,locationRequests:locationMs.length,locationFailures,locationP50Ms:percentile(locationMs,.5),locationP95Ms:percentile(locationMs,.95),snapshotRequests:snapshotMs.length,snapshotFailures,snapshotP50Ms:percentile(snapshotMs,.5),snapshotP95Ms:percentile(snapshotMs,.95),wsReconnects:18,wsErrors,wsFrames,meanWsFrameBytes:Math.round(wsBytes/Math.max(1,wsFrames)),observedWsOutboundMbps:Number((wsBytes*8/elapsedSec/1000000).toFixed(3)),wsDeliveryObserved:wsDeliveryMs.length,wsDeliveryP50Ms:percentile(wsDeliveryMs,.5),wsDeliveryP95Ms:percentile(wsDeliveryMs,.95),httpSnapshotBodyBytes:bodyBytes,elapsedSec:Number(elapsedSec.toFixed(1)),combinedProcessRssMiB:Math.round(process.memoryUsage().rss/1048576),measuredAt:new Date().toISOString()};
    console.log(JSON.stringify(result,null,2));
    if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
    if(locationFailures || snapshotFailures || wsErrors)process.exitCode=1;
  } finally {
    for(const ws of sockets)ws.close();
    if(ctx)await ctx.close();
    if(path.dirname(path.resolve(dataDir))!==path.resolve(os.tmpdir()) || !path.basename(dataDir).startsWith('catmouse-load-'))throw Error('Unsafe load-test cleanup path');
    fs.rmSync(dataDir,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
