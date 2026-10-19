const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const geo=require('../../utils/geo-registration');
// Entirely synthetic field in GCJ02-labelled test coordinates, not a real park calibration.
const {fixture}=require('./geo-fixture.cjs');
test('shared runtime identical and registration is tied to actual art bytes',()=>{
 assert.deepEqual(fs.readFileSync(path.resolve(__dirname,'../../utils/geo-registration.js')),fs.readFileSync(path.resolve(__dirname,'../shared/geo-registration.js')));
 assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../../assets/maps/xuanwu-lake-v4.jpg'))).digest('hex'),geo.IMAGE.sha256);
});
test('independent checks validate inverse coordinates, never assert field survey passed',()=>{
 const m=geo.compile(fixture());assert.equal(m.fieldVerified,false);assert.ok(m.quality.maxErrorM<1e-7);
 for(let i=0;i<10;i++){const q={u:.2+i*.05,v:.4},p=geo.pixelToGeo(q,m),back=geo.project(p,m);assert.ok(Math.abs(back.u-q.u)<1e-10);assert.ok(Math.abs(back.v-q.v)<1e-10);}
 assert.equal(geo.project(geo.pixelToGeo({u:.05,v:.4},m),m),null);
});
test('wrong image/CRS, degenerate points, duplicate checks and check residual rejected',()=>{
 const f=fixture();for(const patch of [{crs:'wgs84'},{imageSha256:'other'},{imageId:'old'},{points:f.points.filter(p=>p.kind==='control')}])assert.throws(()=>geo.compile({...f,...patch}));
 const moved=fixture();moved.points[4].lat+=.001;assert.throws(()=>geo.compile(moved),/CALIBRATION_ERROR/);
 const duplicate=fixture();duplicate.points[4]={...duplicate.points[0],kind:'check'};assert.throws(()=>geo.compile(duplicate),/CALIBRATION_DUPLICATE/);
 const line=fixture();line.points.forEach(p=>{p.v=.5;});assert.throws(()=>geo.compile(line),/CALIBRATION_DEGENERATE/);
 const nan=fixture();nan.points[0].u=NaN;assert.throws(()=>geo.compile(nan),/CALIBRATION_POINTS/);
});
test('uncertainty ellipse and point scene use same image geometry and fail closed',()=>{
 const m=geo.compile(fixture()),p=geo.pixelToGeo({u:.5,v:.5},m),e=geo.ellipse(p,50,m,600,600);assert.ok(e.rx>60&&e.ry>60&&Number.isFinite(e.angle));
 const frame=geo.frame({points:[{...p,tone:'self',label:'本人'}],regions:[{...p,radiusM:50}]},m,600,600);assert.ok(Math.abs(frame.points[0].x-300)<1e-8);assert.ok(Math.abs(frame.regions[0].x-300)<1e-8);assert.equal(geo.frame({},null,600,600).points.length,0);
 for(const bad of [null,{}, {...m,imageSha256:'wrong'}, {...m,east:[NaN,0,0]}])assert.equal(geo.project(p,bad),null);
});
test('HTTP host calibration is atomic, idempotent, persistent and cannot alter active game',async()=>{
 const os=require('node:os'),crypto=require('node:crypto'),{createServer}=require('./server');const env={NODE_ENV:'test',ENABLE_LOCAL_TEST_IDENTITIES:'true',DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'catmouse-geo-'))};let ctx,now=Date.now();
 const boot=async()=>{ctx=await createServer({env,now:()=>now});ctx.server.listen(0,'127.0.0.1');await new Promise(r=>ctx.server.once('listening',r));};
 const req=async(method,url,body,token)=>{const r=await fetch('http://127.0.0.1:'+ctx.server.address().port+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{await boot();const a=(await req('POST','/api/v2/session/test',{})).data,b=(await req('POST','/api/v2/session/test',{})).data;
  const venue={lat:32.073,lng:118.789,radiusM:200,confirmed:true},room=(await req('POST','/api/v2/rooms',{total:2,venue,nickname:'host'},a.token)).data,id=room.roomId,url=`/api/v2/rooms/${id}/calibration`;
  await req('POST',`/api/v2/rooms/${id}/join`,{nickname:'friend'},b.token);
  const snap=(await req('GET',`/api/v2/rooms/${id}`,undefined,a.token)).data;
  const body={...fixture(),commandId:crypto.randomUUID(),expectedVersion:snap.version};
  assert.equal((await req('PUT',url,body)).status,401);assert.equal((await req('PUT',url,body,b.token)).status,403);
  const [x,y]=await Promise.all([req('PUT',url,body,a.token),req('PUT',url,body,a.token)]);assert.equal(x.status,200);assert.deepEqual(x.data,y.data);
  assert.equal((await req('PUT',url,{...body,crs:'wgs84'},a.token)).data.error,'COMMAND_CONFLICT');
  assert.equal((await req('PUT',url,{...body,commandId:crypto.randomUUID()},a.token)).data.error,'VERSION_CONFLICT');
  const current=(await req('GET',`/api/v2/rooms/${id}`,undefined,b.token)).data;assert.equal(current.mapCalibration.id,x.data.mapCalibration.id);assert.equal(current.mapCalibration.fieldVerified,false);assert.equal(current.roster.filter(p=>p.ready).length,0);
  for(const p of [a,b]){await req('POST',`/api/v2/rooms/${id}/location`,{...venue,accuracy:5,sampledAt:now,sampleSeq:1,coordinateSystem:'gcj02'},p.token);await req('POST',`/api/v2/rooms/${id}/ready`,{ready:true},p.token);}
  const start=(await req('POST',`/api/v2/rooms/${id}/start`,{},a.token)).data;assert.equal(start.match.phase,'HIDING');
  assert.equal((await req('PUT',url,{...body,commandId:crypto.randomUUID(),expectedVersion:start.version},a.token)).data.error,'IN_PROGRESS');
  await ctx.close();ctx=null;await boot();const restored=(await req('GET',`/api/v2/rooms/${id}`,undefined,a.token)).data;assert.equal(restored.mapCalibration.id,x.data.mapCalibration.id);assert.equal(restored.match.pauseReason,'server_restart');assert.equal(restored.visiblePositions.length,0);
 }finally{if(ctx)await ctx.close();fs.rmSync(env.DATA_DIR,{recursive:true,force:true});}
});
