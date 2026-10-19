const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),camera=require('../../utils/venue-camera'),catalog=require('../../utils/venue-catalog');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('all four map edges have resting space and progressive overscroll, including a whole-map view',()=>{
 for(const [vw,vh,scale] of [[390,700,1],[320,600,320/600],[800,400,1]]){
  const f=camera.fitCover(vw,vh,1254,1254),pad=camera.panPadding(vw,vh),min=Math.min(vw/f.width,vh/f.height);
  const center={x:(vw-f.width*scale)/2,y:(vh-f.height*scale)/2,scale};
  for(const axis of ['x','y'])for(const dir of [-1,1]){
   const raw={...center,[axis]:dir*100000},edge=camera.boundCamera(vw,vh,f.width,f.height,raw,min,pad),rubber=camera.rubberCamera(vw,vh,f.width,f.height,raw,min,pad);
   assert.ok(dir*(rubber[axis]-edge[axis])>0);assert.ok(Math.abs(rubber[axis]-edge[axis])<80);
   const inverse=camera.unrubberCamera(vw,vh,f.width,f.height,rubber,min,pad),again=camera.rubberCamera(vw,vh,f.width,f.height,inverse,min,pad);
   assert.ok(Math.abs(again[axis]-rubber[axis])<1e-8);
   const size=(axis==='x'?f.width:f.height)*scale,view=axis==='x'?vw:vh;
   const limit=dir>0?(size<=view?(view-size)/2+pad:pad):(size<=view?(view-size)/2-pad:view-size-pad);
   assert.ok(Math.abs(edge[axis]-limit)<1e-8);
  }
 }
});
function gpsFixture(){
 let now=100000;const handlers=new Set(),requests=[],starts=[],timers=new Map(),positions=[],errors=[];let next=0,stops=0;
 const wx={onLocationChange:f=>handlers.add(f),offLocationChange:f=>handlers.delete(f),startLocationUpdate:o=>starts.push(o),stopLocationUpdate:()=>stops++,getLocation:o=>requests.push(o)};
 const module={exports:{}};vm.runInNewContext(read('utils/foreground-location.js'),{module,wx,Number,Math,Error,Date:{now:()=>now},setInterval:f=>{timers.set(++next,f);return next;},clearInterval:id=>timers.delete(id)});
 const gps=module.exports.create(p=>positions.push(p),e=>errors.push(e));
 return {gps,handlers,requests,starts,timers,positions,errors,get stops(){return stops;},advance:ms=>{now+=ms;for(const f of timers.values())f();}};
}
test('guide GPS starts explicitly in GCJ02, merges starts, never overwrites a newer stream sample, and stops late callbacks',()=>{
 const f=gpsFixture();assert.equal(f.starts.length,0);f.gps.start();f.gps.start();assert.equal(f.starts.length,1);assert.equal(f.starts[0].type,'gcj02');assert.equal(f.requests[0].type,'gcj02');
 const callback=[...f.handlers][0],p={latitude:32,longitude:118,accuracy:5};callback(p);f.requests[0].success({...p,latitude:31});assert.equal(f.positions.length,1);assert.equal(f.positions[0].lat,32);
 f.gps.stop();const stopped=f.stops;f.gps.stop();assert.equal(f.stops,stopped);callback(p);f.requests[0].success(p);assert.equal(f.positions.length,1);assert.equal(f.handlers.size,0);assert.equal(f.timers.size,0);
 f.gps.start();const count=f.errors.length;f.starts[0].fail(Error('old'));assert.equal(f.errors.length,count);assert.equal(f.gps.isActive(),true);f.gps.stop();
});
test('guide clears stale/invalid GPS and can recover; permission failure releases native subscriptions',()=>{
 const f=gpsFixture();f.gps.start();const callback=[...f.handlers][0];callback({latitude:32,longitude:118,accuracy:7});f.advance(10001);assert.match(f.errors[0].message,/10秒/);f.advance(5000);assert.equal(f.errors.length,1);
 callback({latitude:32,longitude:118,accuracy:8});assert.equal(f.positions.length,2);callback({latitude:NaN,longitude:118,accuracy:5});assert.match(f.errors.at(-1).message,/无效/);
 f.starts[0].fail({errMsg:'auth deny'});assert.equal(f.gps.isActive(),false);assert.equal(f.handlers.size,0);assert.equal(f.timers.size,0);
});
function guide(){
 let p,position,error,starts=0,stops=0,focus=0;const gps={start:()=>starts++,stop:()=>stops++,isActive:()=>starts>stops};
 const wx={nextTick:f=>f(),showActionSheet:o=>o.success({tapIndex:1})};vm.runInNewContext(read('pages/venue/venue.js'),{Page:d=>p=d,wx,Math,Number,Date,require:n=>n.includes('foreground-location')?{create:(a,b)=>{position=a;error=b;return gps;}}:n.includes('presentation')?{metrics:()=>({viewportWidth:390,viewportHeight:844})}:require(path.resolve(root,'pages/venue',n))});
 p.setData=x=>Object.assign(p.data,x);p.selectComponent=()=>({focusSelf:()=>{focus++;return true;}});p.onLoad();p.onShow();return {p,push:v=>position(v),fail:e=>error(e),get starts(){return starts;},get stops(){return stops;},get focus(){return focus;}};
}

test('changing campus preserves native view and only falls back when the selected 3D model is unavailable',()=>{
 const {p}=guide();p.data.artMode=false;p.selectMap('seu-sipailou-v1');assert.equal(p.data.artMode,false);p.selectMap('seu-jiulonghu-v1');assert.equal(p.data.artMode,false);
 p.data.modelMode=true;p.selectMap('seu-sipailou-v1');assert.equal(p.data.artMode,true);assert.equal(p.data.modelMode,false);assert.equal(p.data.locationOn,false);
});
test('public guide renders only live local self, supports campus switching and clears on hide, failure and stop',()=>{
 const f=guide();assert.equal(f.starts,0);f.p.locate();assert.equal(f.starts,1);const image=catalog.get('seu-sipailou-v1');f.p.selectMap(image.id);const pos={...image.demoPoints[0],accuracy:6,receivedAt:Date.now(),coordinateSystem:'gcj02'};f.push(pos);
 assert.equal(f.p.data.geoData.points.length,1);assert.equal(f.p.data.geoData.points[0].tone,'self');assert.equal(f.p.data.markers.length,1);assert.ok(f.focus>0);f.p.locate();assert.equal(f.starts,1);
 f.p.selectMap('seu-jiulonghu-v1');assert.match(f.p.data.locationError,/远离所选场地/);assert.equal(f.p.data.markers[0].latitude,pos.lat);
 f.p.toggleLayer();assert.equal(f.p.data.locationError,'');const center=f.p.data.latitude;f.p.onNativeRegion({causedBy:'gesture'});f.push({...pos,lat:pos.lat+.0001});assert.equal(f.p.data.latitude,center);f.p.locate();assert.equal(f.p.data.latitude,pos.lat+.0001);assert.equal(f.p.data.followSelf,true);
 f.fail(Error('stale'));assert.equal(f.p.data.geoData.points.length,0);assert.equal(f.p.data.markers.length,0);f.p.onHide();f.push(pos);assert.equal(f.p.data.hasPosition,false);assert.equal(f.p.data.coordinateText,'');f.p.onShow();assert.equal(f.p.data.locationOn,false);
});
