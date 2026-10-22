const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),vm=require('node:vm');
const geometry=require('../../utils/venue-boundary'),catalog=require('../../utils/venue-catalog'),model=require('../../utils/model-map');
const root=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
const image=catalog.get('seu-jiulonghu-v1'),origin=image.demoPoints[0];
const p=(x,y)=>({lat:origin.lat+y/111320,lng:origin.lng+x/(111320*Math.cos(origin.lat*Math.PI/180))});
const venue=(boundary=[p(-100,-100),p(100,-100),p(100,100),p(-100,100)])=>({...origin,mapId:image.id,confirmed:true,boundary});
test('simple/concave GCJ-02 polygons validate; intersections, unsafe sizes and foreign coordinates fail closed',()=>{
 assert.deepEqual(fs.readFileSync(path.join(root,'utils/venue-boundary.js')),fs.readFileSync(path.join(root,'cat-mouse-server/shared/venue-boundary.js')));
 const v=geometry.normalize(venue(),image);assert.ok(Math.abs(geometry.area(v.boundary)-40000)<1);assert.equal(geometry.outsideDistance(v,p(0,0)),0);assert.equal(geometry.outsideDistance(v,p(100,0)),0);assert.ok(Math.abs(geometry.outsideDistance(v,p(160,0))-60)<.1);
 const concave=venue([p(-100,-100),p(100,-100),p(100,100),p(20,100),p(20,20),p(-100,20)]);assert.ok(geometry.normalize(concave,image));assert.ok(geometry.outsideDistance(concave,p(-50,80))>50);
 for(const [v,code]of [[venue([]),'INVALID_BOUNDARY'],[venue([p(0,0),p(20,0),p(0,20)]),'BOUNDARY_TOO_SMALL'],[venue([p(-100,-100),p(100,100),p(-100,100),p(100,-100)]),'BOUNDARY_INTERSECTS'],[venue([p(-100,0),p(100,0),p(0,0),p(0,100)]),'BOUNDARY_INTERSECTS'],[venue([p(0,0),p(1,1),p(100,0)]),'BOUNDARY_POINTS_CLOSE'],[{...venue(),lat:p(150,0).lat,lng:p(150,0).lng},'MEETING_OUTSIDE'],[venue([p(-100,-100),p(100,-100),{lat:0,lng:0}]),'VENUE_MAP_MISMATCH'],[venue(Array.from({length:17},(_,i)=>p(Math.cos(i)*100,Math.sin(i)*100))),'INVALID_BOUNDARY']])assert.throws(()=>geometry.normalize(v,image),new RegExp(code));
 assert.equal(geometry.outsideDistance({...venue(),boundary:null,radiusM:500},origin),Infinity);
 assert.equal(geometry.outsideDistance({...origin,radiusM:200},p(250,0))>49,true);
 const overlay=model.overlay({points:[],boundary:v.boundary},image.id);assert.ok(overlay.boundary.length>=5);assert.equal(overlay.omittedBoundary,false);assert.equal(overlay.points.length,0);assert.deepEqual(model.overlay({boundary:[...v.boundary,{lat:0,lng:0}]},image.id).boundary,[]);
});
test('venue mutation is host-only, versioned, idempotent, persisted, and invalidates readiness only after commit',async()=>{
 const {createServer}=require('./server');const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'catmouse-polygon-'));let ctx,now=Date.now();
 const boot=async()=>{ctx=await createServer({env:{NODE_ENV:'test',ENABLE_LOCAL_TEST_IDENTITIES:'true',DATA_DIR:dataDir},now:()=>now});ctx.server.listen(0,'127.0.0.1');await new Promise(r=>ctx.server.once('listening',r));};
 const req=async(method,url,body,token)=>{const r=await fetch('http://127.0.0.1:'+ctx.server.address().port+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{await boot();const a=(await req('POST','/api/v2/session/test',{})).data,b=(await req('POST','/api/v2/session/test',{})).data,outsider=(await req('POST','/api/v2/session/test',{})).data;
  const legacy=await ctx.service.create(a.id,{total:2,nickname:'旧房间',venue:{...origin,radiusM:200,confirmed:true}}),legacyRoom=await ctx.store.room(legacy.roomId);delete legacyRoom.state.venue.mapId;await ctx.store.query('UPDATE rooms SET state=$2 WHERE id=$1',[legacy.roomId,JSON.stringify(legacyRoom.state)]);const legacyUpdated=await ctx.service.setVenue(legacy.roomId,a.id,{commandId:crypto.randomUUID(),expectedVersion:1,venue:{...origin,radiusM:200,confirmed:true,mapId:'xuanwu-v4'}});assert.equal(legacyUpdated.venue.mapId,'xuanwu-v4');
  const input={total:2,nickname:'房主',venue:venue(),venueFormat:'polygon-v1'};
  assert.equal((await req('POST','/api/v2/rooms',{...input,venueFormat:undefined},a.token)).data.error,'INVALID_CONFIG');
  assert.equal((await req('POST','/api/v2/rooms',{...input,venue:venue([])},a.token)).data.error,'INVALID_BOUNDARY');
  const created=(await req('POST','/api/v2/rooms',input,a.token)).data,id=created.roomId,url='/api/v2/rooms/'+id;
  assert.ok(id);await req('POST',url+'/join',{nickname:'伙伴'},b.token);
  const loc=(point,seq)=>({...point,accuracy:5,sampledAt:now,sampleSeq:seq,coordinateSystem:'gcj02'});
  for(const x of [a,b]){await ctx.service.location(id,x.id,loc(origin,1));await ctx.service.ready(id,x.id,true);}
  const before=await ctx.service.read(id,a.id),body={commandId:crypto.randomUUID(),expectedVersion:before.version,venue:venue()};
  assert.equal((await req('PUT',url+'/venue',body)).status,401);assert.equal((await req('PUT',url+'/venue',body,b.token)).status,403);assert.equal((await req('PUT',url+'/venue',{...body,actor:a.id},outsider.token)).status,403);
  const save=ctx.store.save;ctx.store.save=()=>{throw Error('INJECTED_WRITE_FAILURE');};await assert.rejects(ctx.service.setVenue(id,a.id,body),/INJECTED_WRITE_FAILURE/);ctx.store.save=save;
  assert.ok(ctx.service.fresh(a.id,id));assert.equal((await ctx.service.read(id,a.id)).roster.every(p=>p.ready),true);
  const saved=await ctx.service.setVenue(id,a.id,body);assert.equal(saved.version,before.version+1);assert.equal(ctx.service.fresh(a.id,id),null);assert.equal((await ctx.service.read(id,a.id)).roster.some(p=>p.ready),false);
  await ctx.service.location(id,a.id,loc(origin,2));assert.deepEqual(await ctx.service.setVenue(id,a.id,body),saved);assert.ok(ctx.service.fresh(a.id,id),'replay must not discard new samples');
  await assert.rejects(ctx.service.setVenue(id,a.id,{...body,venue:{...venue(),lat:p(1,0).lat,lng:p(1,0).lng}}),/COMMAND_CONFLICT/);
  await assert.rejects(ctx.service.setVenue(id,a.id,{...body,commandId:crypto.randomUUID()}),/VERSION_CONFLICT/);
  const concurrent=await Promise.allSettled([1,2].map(()=>ctx.service.setVenue(id,a.id,{...body,expectedVersion:saved.version,commandId:crypto.randomUUID()})));assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);assert.match(concurrent.find(x=>x.status==='rejected').reason.message,/VERSION_CONFLICT/);
  for(const x of [a,b]){await ctx.service.location(id,x.id,loc(origin,3));await ctx.service.ready(id,x.id,true);}
  const started=await ctx.service.start(id,a.id),matchId=started.match.id;
  await assert.rejects(ctx.service.setVenue(id,a.id,{commandId:crypto.randomUUID(),expectedVersion:started.version,venue:venue()}),/IN_PROGRESS/);
  // Outside a non-circular boundary must invalidate the previous good sample immediately.
  await ctx.service.location(id,a.id,loc(p(60,0),4));now+=4000;const outsideSample=loc(p(160,0),5);assert.equal((await ctx.service.location(id,a.id,outsideSample)).accepted,false);assert.equal(ctx.service.fresh(a.id,id),null);
  await assert.rejects(ctx.service.location(id,a.id,outsideSample),/STALE_LOCATION/);assert.equal(ctx.service.outside.get(id+':'+a.id).count,1);
  let seq=10;for(const dt of [5000,5000]){now+=dt;await ctx.service.location(id,b.id,loc(origin,seq++));await ctx.service.location(id,a.id,loc(p(160,0),seq++));}
  const paused=await ctx.service.read(id,a.id);assert.equal(paused.match.phase,'PAUSED');assert.equal(paused.match.pauseReason,'outside_venue');await assert.rejects(ctx.service.resume(id,a.id),/LOCATION_REQUIRED/);
  await ctx.service.cancel(id,a.id);const result=(await ctx.store.query('SELECT result FROM match_results WHERE match_id=$1',[matchId])).rows[0].result;assert.deepEqual(result.venue,venue());
  const terminal=await ctx.service.read(id,a.id),next={...venue(),boundary:[p(-80,-80),p(80,-80),p(80,80),p(-80,80)]};await ctx.service.setVenue(id,a.id,{commandId:crypto.randomUUID(),expectedVersion:terminal.version,venue:next});
  assert.deepEqual((await ctx.store.query('SELECT result FROM match_results WHERE match_id=$1',[matchId])).rows[0].result,result);
  await ctx.close();ctx=null;await boot();const restored=await ctx.service.read(id,a.id);assert.deepEqual(restored.venue,next);assert.equal(ctx.service.fresh(a.id,id),null);
  assert.equal((await req('PUT',url+'/venue',{commandId:crypto.randomUUID(),expectedVersion:restored.version,venue:{...next,mapId:'unknown-map'}},a.token)).data.error,'INVALID_VENUE_MAP');
 }finally{if(ctx)await ctx.close();fs.rmSync(dataDir,{recursive:true,force:true});}
});
function editor(api={},wx={}){let def;vm.runInNewContext(read('field-editor/pages/edit/edit.js'),{Page:d=>def=d,require:n=>n.endsWith('/v2')?api:n.includes('dev-preview')?{enabled:()=>true}:require(path.resolve(root,'field-editor/pages/edit',n)),wx,Math,Number,JSON,Promise,Error});const page={...def,data:plain(def.data),history:[],serial:1,active:true,image};page.setData=p=>Object.assign(page.data,plain(p));page.data.mapId=image.id;page.data.editable=true;return page;}
test('editor supports points, vertex moves, meeting, undo, validation, no late GPS writes',()=>{
 let gps;const page=editor({}, {getLocation:o=>{gps=o;}}),tap=q=>page.tapMap({detail:{latitude:q.lat,longitude:q.lng}});for(const q of venue().boundary)tap(q);assert.equal(page.data.canSave,false);
 page.setMode({currentTarget:{dataset:{mode:'meeting'}}});tap(origin);assert.equal(page.data.canSave,true);page.tapMarker({detail:{markerId:0}});tap(p(-90,-100));assert.equal(page.data.points.length,4);assert.equal(page.data.points[0].lng,p(-90,-100).lng);page.undo();assert.equal(page.data.points[0].lng,p(-100,-100).lng);
 page.tapMarker({detail:{markerId:1}});page.remove();assert.equal(page.data.points.length,3);page.undo();page.clear();assert.equal(page.data.points.length,0);page.undo();assert.equal(page.data.canSave,true);
 page.locate();const before=plain(page.data);page.onHide();gps.success({latitude:origin.lat,longitude:origin.lng,accuracy:5});assert.deepEqual(plain(page.data),before);
});
test('editor retries the same command after timeout and never submits as non-owner',async()=>{
 const calls=[];const page=editor({venue:async(id,body)=>{calls.push(plain(body));throw Error('timeout');}});page.data.roomId=crypto.randomUUID();page.version=7;page.init({mapId:image.id,venue:venue()});await page.save();await page.save();assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].expectedVersion,7);page.setData({editable:false});page.assess();await page.save();assert.equal(calls.length,2);
});
test('editor preserves polygon on version conflict and requires a second explicit save',async()=>{
 const calls=[],page=editor({venue:async(id,body)=>{calls.push(plain(body));const e=Error('changed');e.code='VERSION_CONFLICT';throw e;},room:async()=>({version:12,owner:true,match:null})});page.data.roomId=crypto.randomUUID();page.version=7;page.init({mapId:image.id,venue:venue()});const draft=plain(page.data.points);await page.save();assert.equal(calls.length,1);assert.equal(page.version,12);assert.equal(page.body,null);assert.deepEqual(plain(page.data.points),draft);assert.match(page.data.error,/再次保存/);await page.save();assert.equal(calls.length,2);assert.equal(calls[1].expectedVersion,12);assert.notEqual(calls[1].commandId,calls[0].commandId);
});
test('existing-room editor trusts server ownership and cannot be made editable by opener data',async()=>{
 let init;const page=editor({session:async()=>{},room:async()=>({owner:false,version:4,venue:venue(),match:null})});page.getOpenerEventChannel=()=>({on:(event,fn)=>{init=fn;}});page.onLoad({roomId:crypto.randomUUID()});await new Promise(r=>setImmediate(r));assert.equal(page.data.editable,false);assert.equal(page.data.canSave,false);assert.equal(init,undefined);assert.match(page.data.error,/只有房主/);page.tapMap({detail:{latitude:origin.lat,longitude:origin.lng}});assert.equal(page.data.points.length,4);
});
test('room consumes an editor draft, resets preview readiness, and ignores a late result after unload',()=>{
 let def,nav;const wx={navigateTo:o=>{nav=o;}};vm.runInNewContext(read('pages/room/room.js'),{Page:d=>def=d,require:n=>n.endsWith('/v2')?{config:{}}:n.includes('location-v2')?{}:require(path.resolve(root,'pages/room',n)),wx,Math,Number,JSON,clearInterval(){},clearTimeout(){}});
 const room={...def,data:plain(def.data),active:true,devPreview:true,setData(p){Object.assign(this.data,plain(p));}};room.data.mapId=image.id;room.openVenueEditor();assert.match(nav.url,/field-editor/);let init;nav.success({eventChannel:{emit:(name,data)=>{init=data;}}});assert.equal(init.mapId,image.id);nav.events.venueSaved({venue:venue()});assert.deepEqual(plain(room.data.venue),venue());assert.match(room.data.venueSummaryText,/4点范围/);
 room.data.roomId='preview-room';room.data.owner=true;room.data.roster=[{id:'a',ready:true},{id:'b',ready:true}];room.openVenueEditor();nav.events.venueSaved({venue:venue()});assert.equal(room.data.roster.some(p=>p.ready),false);room.onUnload();const before=plain(room.data);nav.events.venueSaved({venue:{...venue(),lat:p(10,0).lat,lng:p(10,0).lng}});assert.deepEqual(plain(room.data),before);
});
test('returning from editor cannot restore the venue from an older room request',async()=>{
 let def;const reads=[],api={config:{},room:()=>new Promise(r=>reads.push(r))};vm.runInNewContext(read('pages/room/room.js'),{Page:d=>def=d,require:n=>n.endsWith('/v2')?api:n.includes('location-v2')?{}:require(path.resolve(root,'pages/room',n)),wx:{getStorageSync:()=> 'host'},Math,Number,JSON,clearInterval(){},clearTimeout(){}});
 const room={...def,data:plain(def.data),active:true,lifecycle:1,setData(p){Object.assign(this.data,plain(p));}};room.data.roomId='room';const old=room.refresh();room.onHide();room.active=true;room.lifecycle++;const current=room.refresh(),fresh={code:'A',venue:venue(),version:8,roster:[],rules:{total:8,cats:2,mice:6},match:null,owner:true};reads[1](fresh);await current;reads[0]({...fresh,venue:{...origin,radiusM:200,mapId:image.id},version:7});await old;assert.deepEqual(plain(room.data.venue),venue());assert.equal(room.data.matchVersion,8);assert.equal(room.fetching,false);
});
test('late opener draft preserves edits while keeping the return channel available',async()=>{
 let init,returned,back=0;const page=editor({}, {navigateBack:()=>back++});page.getOpenerEventChannel=()=>({on:(name,fn)=>{init=fn;},emit:(name,data)=>{returned=data;}});page.onLoad({mapId:image.id});for(const q of venue().boundary)page.tapMap({detail:{latitude:q.lat,longitude:q.lng}});init({mapId:image.id,venue:{...origin,confirmed:true,radiusM:200,mapId:image.id}});assert.equal(page.data.points.length,4);assert.equal(page.data.meeting,null);page.setMode({currentTarget:{dataset:{mode:'meeting'}}});page.tapMap({detail:{latitude:origin.lat,longitude:origin.lng}});await page.save();assert.equal(back,1);assert.deepEqual(plain(returned.venue),venue());
});
