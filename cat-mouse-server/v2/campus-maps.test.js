const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),os=require('node:os');
const catalog=require('../../utils/venue-catalog'),osm=require('../../utils/osm-art-registration'),geo=require('../../utils/geo-registration');
const {wgs84togcj02}=require('../../utils/vendor/coordtransform');
const root=path.resolve(__dirname,'../..'),ids=['seu-jiulonghu-v1','seu-sipailou-v1'];
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
test('all miniprogram require dependencies are JavaScript modules available in their package graph',()=>{
 const app=JSON.parse(read('app.json')),starts=[...app.pages.map(p=>p+'.js'),'app.js',...Object.values(app.usingComponents).map(p=>p.slice(1)+'.js'),'components/venue-art/venue-art.js','components/map-icon/map-icon.js'],seen=new Set();
 function visit(file){if(seen.has(file))return;seen.add(file);const source=read(file);for(const [,name]of source.matchAll(/require\(['"]([^'"]+)['"]\)/g)){assert.ok(name.startsWith('.'),'no Node/npm dependency '+file+' '+name);assert.doesNotMatch(name,/\.json$/,'WeChat logic layer does not load JSON with require');const target=path.resolve(root,path.dirname(file),name)+(name.endsWith('.js')?'':'.js');assert.ok(fs.existsSync(target),target);const relative=path.relative(root,target);assert.ok(!relative.startsWith('venue-maps'),'main package never imports subpackage JS');visit(relative);}}
 starts.forEach(visit);assert.ok(seen.size>20);
});
test('both campus models retain all handoff controls, explicit CRS and separate image identities',()=>{
 assert.deepEqual(fs.readFileSync(path.join(root,'utils/venue-images.js')),fs.readFileSync(path.join(root,'cat-mouse-server/shared/venue-images.js')));
 const manifest=require('../../design/maps/seu-campuses-v1/manifest.json');for(const e of manifest.files){const b=fs.readFileSync(path.join(root,'design/maps/seu-campuses-v1',e.file));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),e.sha256);}
 for(const [index,key]of ['jiulonghu','sipailou'].entries()){
  const id=ids[index],image=catalog.get(id),model=require('../../design/maps/seu-campuses-v1/'+key+'-registration.json');
  const bytes=fs.readFileSync(path.join(root,image.src.slice(1)));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),image.sha256);assert.equal(image.sourceSha256,model.image.sha256);assert.equal(image.fieldVerified,false);assert.equal(osm.available(id),true);
  for(const a of model.anchors){const [lng,lat]=wgs84togcj02(...a.wgs84),p=osm.project({lng,lat},'gcj02',id);assert.ok(p);assert.ok(Math.hypot(p.u*1254-a.pixel[0],p.v*1254-a.pixel[1])<.001);assert.equal(osm.project({lng,lat},'WGS84',id),null);assert.equal(osm.project({lng,lat},'gcj02',ids[1-index]),null);}
  assert.equal(osm.project({lat:0,lng:0},'gcj02',id),null);assert.equal(catalog.contains(id,image.demoPoints[0]),true);assert.equal(catalog.contains(id,{lat:32,lng:118}),false);
 }
 assert.equal(osm.available('unknown'),false);
});
test('campus overlays preserve uncertainty, ignore missing data, and fail closed on a foreign room model',()=>{
 for(const id of ids){const p=catalog.get(id).demoPoints[0],f=osm.overlay({points:[{...p,tone:'self'}],regions:[{...p,radiusM:50}]},null,600,600,id);assert.equal(f.points.length,1);assert.equal(f.regions.length,1);assert.ok(f.regions[0].rx>1&&f.regions[0].ry>1);assert.equal(f.regions[0].tone,undefined);
  const wrong=geo.compile(require('./geo-fixture.cjs').fixture());assert.equal(osm.overlay({points:[{...p,tone:'self'}]},wrong,600,600,id).points.length,0);
  const outside=osm.overlay({points:[{lat:0,lng:0,tone:'self'}],regions:[{lat:0,lng:0,radiusM:50}]},null,600,600,id);assert.equal(outside.points.length,0);assert.equal(outside.omittedRegions,1);
 }
});
test('resource package merges concurrent campus requests and retries after failure',async()=>{
 const module={exports:{}},calls=[];vm.runInNewContext(read('utils/venue-resources.js'),{module,require:()=>catalog,wx:{navigateTo:x=>calls.push(x)},Map,Set,Promise,Error});const resources=module.exports;
 const a=resources.ensure(ids[0]),b=resources.ensure(ids[1]);assert.equal(a,b);assert.equal(calls.length,1);calls[0].fail();await assert.rejects(a,/加载失败/);await Promise.resolve();assert.equal(resources.ready(ids[0]),false);
 const c=resources.ensure(ids[0]);assert.equal(calls.length,2);resources.markLoaded('venue-maps');await c;assert.equal(resources.ready(ids[1]),true);await resources.ensure(ids[1]);assert.equal(calls.length,2);await assert.rejects(resources.ensure('unknown'),/未知/);
});
test('late package completion cannot restore an older campus image or detached component',async()=>{
 let definition;const jobs=[],writes=[];const resources={ensure:()=>new Promise(resolve=>jobs.push(resolve))};
 vm.runInNewContext(read('components/venue-art/venue-art.js'),{Component:d=>definition=d,require:n=>n.includes('venue-resources')?resources:require(path.resolve(root,'components/venue-art',n)),wx:{nextTick:fn=>fn()},clearTimeout(){},Date});
 const instance={...definition.methods,_alive:true,_tourSerial:0,_imageSerial:0,data:{...plain(definition.data)},setData(p){writes.push(p);Object.assign(this.data,p);}};
 for(const id of ids){instance.data.imageId=id;instance.data.src=catalog.get(id).src;instance._reloadImage();}
 jobs[0]();await Promise.resolve();assert.equal(instance.data.imageNodes.length,0);jobs[1]();await Promise.resolve();assert.deepEqual(plain(instance.data.imageNodes),[2]);
 instance._reloadImage();instance._alive=false;const count=writes.length;jobs[2]();await Promise.resolve();assert.equal(writes.length,count);
});
test('changing campus invalidates venue confirmation and ignores an older GPS response',async()=>{
 let p;const callbacks=[];vm.runInNewContext(read('pages/room/room.js'),{Page:d=>p=d,require:n=>n.includes('venue-resources')?{ready:()=>true}:n.includes('venue-catalog')?catalog:n.includes('team-config')?require('../../utils/team-config'):{},wx:{getLocation:x=>callbacks.push(x)},Math,Number});p.setData=x=>Object.assign(p.data,x);p.active=true;p.lifecycle=1;
 p.data.venue={lat:32,lng:118,confirmed:true};p.selectVenueMap({detail:{value:1}});assert.equal(p.data.venue,null);p.chooseVenue();p.selectVenueMap({detail:{value:2}});callbacks[0].success({latitude:catalog.get(ids[0]).demoPoints[0].lat,longitude:catalog.get(ids[0]).demoPoints[0].lng});assert.equal(p.data.venue,null);
 p.chooseVenue();callbacks[1].success({latitude:32,longitude:118});assert.equal(p.data.venue,null);assert.match(p.data.error,/不在所选校区/);
 p.chooseVenue();const q=catalog.get(ids[1]).demoPoints[0];callbacks[2].success({latitude:q.lat,longitude:q.lng});assert.equal(p.data.venue.mapId,ids[1]);assert.equal(p.data.venue.confirmed,true);
});
test('campus rooms bind map/calibration, isolate locations across rooms and persist on restart',async()=>{
 const {Store}=require('./store'),{Service}=require('./service');const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'catmouse-campus-'));let store,service;const now=Date.now(),actor=crypto.randomUUID(),guest=crypto.randomUUID();
 const boot=async()=>{store=new Store({dataDir});await store.init();service=new Service(store,{localTest:true,now:()=>now});await service.recover();};
 try{
  await boot();const rooms=[];
  for(const id of ids){const p=catalog.get(id).demoPoints[0],created=await service.create(actor,{total:2,nickname:'房主',venue:{...p,radiusM:200,confirmed:true,mapId:id}});rooms.push(created.roomId);await service.join(created.roomId,guest,'队友');await service.location(created.roomId,actor,{...p,accuracy:5,sampledAt:now,sampleSeq:1,coordinateSystem:'gcj02'});}
  assert.equal(service.fresh(actor,rooms[0]).lat,catalog.get(ids[0]).demoPoints[0].lat);assert.equal(service.fresh(actor,rooms[1]).lat,catalog.get(ids[1]).demoPoints[0].lat);
  await assert.rejects(service.create(actor,{total:2,nickname:'房主',venue:{lat:32,lng:118,radiusM:200,confirmed:true,mapId:ids[0]}}),/VENUE_MAP_MISMATCH/);
  await assert.rejects(service.create(actor,{total:2,nickname:'房主',venue:{lat:32,lng:118,radiusM:200,confirmed:true,mapId:'fake'}}),/INVALID_VENUE_MAP/);
  const before=await service.read(rooms[0],actor),image=catalog.get(ids[0]),f=require('./geo-fixture.cjs').fixture(),o={lat:32.073,lng:118.789},base=image.demoPoints[0];
  const body={...f,commandId:crypto.randomUUID(),expectedVersion:before.version,imageId:image.id,imageSha256:image.sha256,points:f.points.map(p=>({...p,lat:p.lat-o.lat+base.lat,lng:p.lng-o.lng+base.lng}))};
  await assert.rejects(service.calibrate(rooms[0],guest,body),/FORBIDDEN/);await assert.rejects(service.calibrate(rooms[1],actor,body),/CALIBRATION_IMAGE_OR_CRS/);
  const saved=await service.calibrate(rooms[0],actor,body);assert.equal(saved.mapCalibration.imageId,ids[0]);assert.equal(geo.project(base,saved.mapCalibration,ids[0])!==null,true);assert.equal(geo.project(base,saved.mapCalibration,ids[1]),null);
  await service.leave(rooms[0],actor);assert.equal(service.fresh(actor,rooms[0]),null);assert.ok(service.fresh(actor,rooms[1]));
  await store.close();store=null;await boot();const restored=await service.read(rooms[1],actor);assert.equal(restored.venue.mapId,ids[1]);assert.equal(service.fresh(actor,rooms[1]),null);assert.equal(restored.visiblePositions.length,0);const calibrated=await service.read(rooms[0],guest);assert.equal(calibrated.venue.mapId,ids[0]);assert.equal(calibrated.mapCalibration.imageId,ids[0]);
 }finally{if(store)await store.close();fs.rmSync(dataDir,{recursive:true,force:true});}
});
