const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const catalog=require('../../utils/venue-catalog'),geometry=require('../../utils/venue-boundary'),{createServer}=require('./server');
const image=catalog.get('native-gcj02-v1'),point={lat:31.23,lng:121.47};
const venue={...point,mapId:image.id,confirmed:true,boundary:[{lat:31.229,lng:121.469},{lat:31.229,lng:121.471},{lat:31.231,lng:121.471},{lat:31.231,lng:121.469}]};
test('native catalog is image-free and validates arbitrary venue polygons without campus restrictions',()=>{
 assert.equal(image.nativeOnly,true);assert.equal(image.src,'');assert.ok(catalog.contains(image.id,point));assert.deepEqual(geometry.normalize(venue,image),venue);
 assert.throws(()=>geometry.normalize({...point,confirmed:true,radiusM:200},image),/INVALID_BOUNDARY/);
 assert.throws(()=>geometry.normalize({...venue,lat:31.24},image),/MEETING_OUTSIDE/);
 assert.throws(()=>geometry.normalize({...venue,boundary:[venue.boundary[0],venue.boundary[2],venue.boundary[1],venue.boundary[3]]},image),/BOUNDARY_INTERSECTS/);
 assert.ok(geometry.outsideDistance(venue,{lat:31.24,lng:121.47})>50);
});
test('native room runs authenticated invite, polygon update, location, capture, tracks, restart and replay',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'catmouse-native-'));let now=Date.now(),ctx,seq=0;
 const boot=async()=>{ctx=await createServer({env:{NODE_ENV:'test',ENABLE_LOCAL_TEST_IDENTITIES:'true',DATA_DIR:dir},now:()=>now});ctx.server.listen(0,'127.0.0.1');await new Promise(r=>ctx.server.once('listening',r));};
 const req=async(method,url,data,actor)=>{const r=await fetch('http://127.0.0.1:'+ctx.server.address().port+url,{method,headers:{'Content-Type':'application/json',...(actor?{Authorization:'Bearer '+actor.token}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{})});return {status:r.status,data:await r.json()};};
 try{await boot();const a=(await req('POST','/api/v2/session/test',{})).data,b=(await req('POST','/api/v2/session/test',{})).data;
 const maps=(await req('GET','/api/v2/maps')).data;assert.deepEqual(maps.maps.find(m=>m.id===image.id).layers,['native']);
 const input={total:2,cats:1,mice:1,nickname:'host',mapId:image.id,mapRevision:image.sha256,venue,venueFormat:'polygon-v1',commandId:crypto.randomUUID()};
 assert.equal((await req('POST','/api/v2/rooms',input)).status,401);
 assert.equal((await req('POST','/api/v2/rooms',{...input,mapRevision:'stale'},a)).data.error,'MAP_REVISION_MISMATCH');
 const created=(await req('POST','/api/v2/rooms',input,a)).data,url='/api/v2/rooms/'+created.roomId;assert.ok(created.roomId);
 assert.equal((await req('POST',url+'/join',{nickname:'mouse'},b)).status,200);
 assert.equal((await req('GET',url+'/invite',undefined,a)).status,200);
 let snap=(await req('GET',url,undefined,a)).data;assert.deepEqual(snap.venue.boundary,venue.boundary);
 const update={commandId:crypto.randomUUID(),expectedVersion:snap.version,mapRevision:image.sha256,venue};
 assert.equal((await req('PUT',url+'/venue',update,b)).status,403);assert.equal((await req('PUT',url+'/venue',update,a)).status,200);
 assert.equal((await req('PUT',url+'/calibration',{commandId:crypto.randomUUID()},a)).data.error,'CALIBRATION_IMAGE_OR_CRS');
 const locate=async(actor,matchId)=>req('POST',url+'/location',{...point,accuracy:50,sampledAt:now,sampleSeq:++seq,coordinateSystem:'gcj02',...(matchId?{matchId}:{})},actor);
 for(const actor of [a,b]){assert.equal((await locate(actor)).data.accepted,true);assert.equal((await req('POST',url+'/ready',{ready:true},actor)).status,200);}
 snap=(await req('POST',url+'/start',{},a)).data;const matchId=snap.match.id;now+=30000;
 for(const actor of [a,b])assert.equal((await locate(actor,matchId)).data.accepted,true);
 snap=(await req('GET',url,undefined,a)).data;assert.equal(snap.match.phase,'CHASING');const cat=snap.match.myRole==='cat'?a:b,mouse=cat===a?b:a;
 assert.equal((await req('GET',url,undefined,cat)).data.visiblePositions.length,1);
 const proof=(await req('POST',url+'/token',{},mouse)).data,body={commandId:crypto.randomUUID(),matchId,token:proof.token};
 const result=await req('POST',url+'/capture',body,cat);assert.equal(result.data.outcome,'cat_win');assert.deepEqual((await req('POST',url+'/capture',body,cat)).data,result.data);
 const tracks=(await req('GET','/api/v2/matches/'+matchId+'/tracks?scope=self',undefined,mouse)).data;assert.equal(tracks.players.length,1);assert.equal(tracks.venue.mapId,image.id);assert.ok(tracks.players[0].points.length);
 await ctx.close();ctx=null;await boot();snap=(await req('GET',url,undefined,a)).data;assert.equal(snap.match.id,matchId);assert.equal(snap.match.outcome,'cat_win');assert.equal(snap.venue.mapId,image.id);
 for(const actor of [a,b]){await locate(actor);await req('POST',url+'/ready',{ready:true},actor);}const next=(await req('POST',url+'/start',{},a)).data;assert.notEqual(next.match.id,matchId);
 }finally{await ctx?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
