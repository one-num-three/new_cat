const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const camera=require('../../utils/venue-camera');
const config=require('../../utils/venue-art-config');
const asset=config.src;

function componentFixture(overrides={}){
 let definition,now=0,id=0;const ticks=[],queries=[],writes=[],timers=new Map(),animations=[];
 const wx={nextTick:fn=>ticks.push(fn),createAnimation:options=>{const a={ops:[],translate3d(x,y,z){this.ops.push(['translate',x,y,z]);return this;},scale(s){this.ops.push(['scale',s]);return this;},step(){return this;},export(){const data={options,ops:this.ops};animations.push(plain(data));return data;}};return a;}};
 vm.runInNewContext(read('components/venue-art/venue-art.js'),{Component:d=>definition=d,wx,Date:{now:()=>now},require:n=>n.includes('venue-camera')?camera:config,setTimeout:(fn,ms)=>{const key=++id;timers.set(key,{fn,at:now+ms});return key;},clearTimeout:key=>timers.delete(key)});
 const defaults=Object.fromEntries(Object.entries(definition.properties).map(([k,v])=>[k,v.value]));const instance={...definition.methods,data:{...defaults,...plain(definition.data),autoTour:false,...overrides}};
 instance.setData=p=>{writes.push(plain(p));Object.assign(instance.data,p);};instance.createSelectorQuery=()=>({select:s=>{assert.equal(s,'.venueViewport');return {boundingClientRect:cb=>{queries.push(cb);return {exec(){}};}};}});
 const flush=()=>{while(ticks.length)ticks.shift()();};const measure=(width=390,height=600)=>{flush();assert.ok(queries.length);queries.shift()({width,height,left:0,top:0});};const attach=()=>definition.lifetimes.attached.call(instance),detach=()=>definition.lifetimes.detached.call(instance);const imageEvent=(generation=instance._imageSerial)=>({currentTarget:{dataset:{generation}}});const ready=()=>{attach();measure();instance.onImageLoad(imageEvent());flush();};const setNow=n=>now=n;const advance=ms=>{now+=ms;const due=[...timers].filter(([,t])=>t.at<=now);for(const [key,t]of due){timers.delete(key);t.fn();}};
 return {definition,instance,ticks,queries,writes,timers,animations,flush,measure,attach,detach,imageEvent,ready,setNow,advance};
}
function pageFixture(name,overrides={}) {
  let page;
  const effects=[];
  const forbidden=kind=>()=>{effects.push(kind);throw Error('unexpected page side effect: '+kind);};
  const wx=new Proxy(overrides.wx||{},{get:(target,key)=>key in target?target[key]:forbidden('wx.'+String(key))});
  const presentation=overrides.presentation||require('../../utils/presentation');
  const api=new Proxy({config:{mode:'local'}},{get:(target,key)=>key in target?target[key]:forbidden('api.'+String(key))});
  vm.runInNewContext(read('pages/'+name+'/'+name+'.js'),{
    Page:value=>page=value,wx,Date,Math,Number,Error,Promise,JSON,encodeURIComponent,
    require:p=>p.includes('presentation')?presentation:p.includes('location-v2')?(overrides.loc||new Proxy({},{get:(_,key)=>forbidden('location.'+String(key))})):p.includes('snapshot-v2')?{shouldApply:()=>true}:p.includes('dev-preview')?(overrides.preview||{}):api,
    setTimeout:forbidden('setTimeout'),setInterval:forbidden('setInterval'),
    clearTimeout:forbidden('clearTimeout'),clearInterval:forbidden('clearInterval')
  });
  const writes=[];
  page.setData=patch=>{writes.push(plain(patch));Object.assign(page.data,patch);};
  return {page,effects,writes};
}


for(const [w,h]of [[390,640],[320,489],[320,280],[1024,1180],[844,240],[390,1600],[1254,1254]])test('immersive cover fills viewport uniformly '+w+'x'+h,()=>{const fit=camera.fitCover(w,h,config.width,config.height);assert.ok(fit.valid);assert.ok(fit.width>=w-1e-9&&fit.height>=h-1e-9);assert.ok(Math.abs(fit.width/fit.height-config.width/config.height)<1e-12);assert.ok(fit.x<=0&&fit.y<=0);for(const p of camera.perimeter(w,h,fit.width,fit.height)){assert.ok(p.x<=0&&p.y<=0);assert.ok(p.x+fit.width*p.scale>=w-1e-9);assert.ok(p.y+fit.height*p.scale>=h-1e-9);}});
test('cover rejects invalid sizes and camera never publishes nonfinite values',()=>{for(const v of [0,-1,NaN,Infinity,'390',null])assert.equal(camera.fitCover(v,600).valid,false);assert.deepEqual(camera.boundCamera(0,1,1,1),{x:0,y:0,scale:1});const c=camera.boundCamera(320,240,320,320,{x:Infinity,y:NaN,scale:Infinity});assert.ok(Object.values(c).every(Number.isFinite));});
test('camera scale is bounded to1–4 and pinch preserves its focal point before edge clamping',()=>{assert.equal(camera.clampScale(99),4);assert.equal(camera.clampScale(NaN),1);const c={x:-100,y:-100,scale:2},z=camera.zoomAt(c,3,150,150,300,300,300,300);assert.equal((150-z.x)/z.scale,(150-c.x)/c.scale);assert.equal((150-z.y)/z.scale,(150-c.y)/c.scale);});
test('single image starts in cover instead of letterboxed contain',()=>{const f=componentFixture();f.ready();const fit=camera.fitCover(390,600,config.width,config.height);assert.equal(f.instance.data.fitWidth,fit.width);assert.equal(f.instance.data.fitHeight,fit.height);assert.equal(f.instance.data.imageNodes.length,1);assert.equal(f.instance.data.imageState,'ready');});
test('automatic tour uses one native animation per leg and exactly one timer',()=>{const f=componentFixture({autoTour:true});f.ready();assert.equal(f.instance.data.mode,'auto');assert.equal(f.instance.data.showControls,false);assert.equal(f.timers.size,1);const first=f.instance._segment.to;f.advance(7500);assert.equal(f.timers.size,1);assert.notDeepEqual(plain(f.instance._segment.to),plain(first));assert.equal(f.animations.at(-1).options.duration,7500);for(let i=0;i<9;i++){f.advance(7500);assert.equal(f.timers.size,1);}});
test('touch immediately freezes interpolated auto position and permanently hands over until explicit resume',()=>{const f=componentFixture({autoTour:true});f.ready();f.setNow(3750);const expected=f.instance._sample();f.instance.onTouchStart({touches:[{clientX:150,clientY:150}]});assert.equal(f.timers.size,0);assert.equal(f.instance.data.mode,'manual');assert.equal(f.instance.data.showControls,true);assert.ok(Math.abs(f.instance.data.x-expected.x)<.001);f.instance.onTouchEnd({touches:[]});f.advance(20000);assert.equal(f.timers.size,0);f.instance.resumeTour();f.flush();assert.equal(f.timers.size,1);});
test('manual pan clamps edges without blank strips and throttles move paints',()=>{const f=componentFixture();f.ready();f.instance.zoomIn();f.instance.onTouchStart({touches:[{clientX:180,clientY:300}]});const before=f.writes.length;for(let i=0;i<100;i++)f.instance.onTouchMove({touches:[{clientX:180-i*3,clientY:300-i*3}]});assert.ok(f.writes.length-before<10);f.instance.onTouchEnd({touches:[]});const c=f.instance._camera;assert.ok(c.x<=0&&c.y<=0);assert.ok(c.x+f.instance.data.fitWidth*c.scale>=390);assert.ok(c.y+f.instance.data.fitHeight*c.scale>=600);assert.equal(f.instance._gesture,null);});
test('two finger pinch changes uniform scale and ends cleanly',()=>{const f=componentFixture();f.ready();f.instance.onTouchStart({touches:[{clientX:140,clientY:300},{clientX:240,clientY:300}]});f.instance.onTouchMove({touches:[{clientX:90,clientY:300},{clientX:290,clientY:300}]});f.instance.onTouchEnd({touches:[]});assert.equal(f.instance.data.scaleValue,2);assert.equal(f.instance.data.mode,'manual');});
test('invalid touches and zero-distance pinch do not publish NaN',()=>{const f=componentFixture();f.ready();f.instance.onTouchStart({touches:[{clientX:NaN,clientY:2}]});assert.equal(f.instance._gesture,null);f.instance.onTouchStart({touches:[{clientX:2,clientY:2},{clientX:2,clientY:2}]});f.instance.onTouchMove({touches:[{clientX:9,clientY:2},{clientX:20,clientY:2}]});assert.ok([f.instance.data.x,f.instance.data.y,f.instance.data.scaleValue].every(Number.isFinite));});
test('reset stays full-bleed at1x and unchanged layout retains manual zoom',()=>{const f=componentFixture();f.ready();f.instance.zoomIn();const scale=f.instance.data.scaleValue;f.instance.remeasure();f.measure();assert.equal(f.instance.data.scaleValue,scale);f.instance.reset();assert.equal(f.instance.data.scaleValue,1);assert.equal(f.instance.data.x,camera.fitCover(390,600,config.width,config.height).x);});
test('manual focal position survives viewport change and invalid viewport stops animation',()=>{const f=componentFixture();f.ready();f.instance.zoomIn();f.instance.remeasure();f.measure(320,280);assert.equal(f.instance.data.scaleValue,1.25);assert.ok(f.instance.data.fitWidth>=320&&f.instance.data.fitHeight>=280);f.instance.remeasure();f.measure(0,0);assert.equal(f.instance.data.fitReady,false);assert.equal(f.timers.size,0);});
test('latest query wins; stale image callback and retry do not resurrect old assets',()=>{const f=componentFixture();f.attach();f.flush();const stale=f.queries.shift();f.instance.remeasure();f.measure(320,400);const before=f.writes.length;stale({width:999,height:999});assert.equal(f.writes.length,before);f.instance.onImageLoad(f.imageEvent());const old=f.instance._imageSerial;f.instance.onImageError(f.imageEvent());f.instance.retry();f.instance.onImageLoad(f.imageEvent(old));assert.equal(f.instance.data.imageState,'loading');f.measure();f.instance.onImageLoad(f.imageEvent());assert.equal(f.instance.data.imageState,'ready');});
test('page hide suspends tour, show resumes only untouched auto, detach cancels timer and late writes',()=>{const f=componentFixture({autoTour:true});f.ready();const timer=[...f.timers.values()][0].fn;f.definition.pageLifetimes.hide.call(f.instance);assert.equal(f.timers.size,0);f.definition.pageLifetimes.show.call(f.instance);f.flush();assert.equal(f.timers.size,1);f.instance.onTouchStart({touches:[{clientX:5,clientY:5}]});f.definition.pageLifetimes.hide.call(f.instance);f.definition.pageLifetimes.show.call(f.instance);assert.equal(f.timers.size,0);f.detach();const before=f.writes.length;timer();f.flush();f.instance.onImageLoad(f.imageEvent());f.instance.zoomIn();f.instance.onTouchEnd({touches:[]});assert.equal(f.writes.length,before);});
test('viewer is a single image with no footer band, no geographic input and no network sampling',()=>{const f=componentFixture();assert.deepEqual(Object.keys(f.definition.properties).sort(),['autoTour','compact','layoutKey','sourceHeight','sourceWidth','src']);const w=read('components/venue-art/venue-art.wxml'),css=read('components/venue-art/venue-art.wxss');assert.equal((w.match(/<image\b/g)||[]).length,1);assert.doesNotMatch(w,/movable-area|venueFooter|markers=|latitude=|longitude=/);assert.match(w,/catchtouchmove="onTouchMove"/);assert.match(w,/animation="{{imageAnimation}}"/);assert.doesNotMatch(css,/scale[XY]\s*\(/);for(const file of ['components/venue-art/venue-art.js','pages/venue/venue.js'])assert.doesNotMatch(read(file),/getLocation|connectSocket|\brequest\s*\(|StorageSync|setInterval/);});
test('public guide is registered and refreshes real layout without joining a game',()=>{
  const app=JSON.parse(read('app.json'));assert.ok(app.pages.includes('pages/venue/venue'));
  const config=JSON.parse(read('pages/venue/venue.json'));
  assert.equal(config.usingComponents['venue-art'],'/components/venue-art/venue-art');
  let metrics={viewportWidth:390,viewportHeight:844,fontScale:1,navHeight:87,safeBottom:34};
  const f=pageFixture('venue',{presentation:{metrics:()=>({...metrics}),resize:e=>({...metrics,viewportWidth:e.size.windowWidth,viewportHeight:e.size.windowHeight})}});
  f.page.onLoad();assert.equal(f.page.data.venueSource,asset);assert.equal(f.page.data.layoutKey,'390:844:1:87:34');
  metrics={...metrics,fontScale:1.3};f.page.onShow();assert.equal(f.page.data.layoutKey,'390:844:1.3:87:34');
  f.page.onResize({size:{windowWidth:320,windowHeight:693}});assert.equal(f.page.data.layoutKey,'320:693:1.3:87:34');
  assert.deepEqual(f.effects,[]);assert.equal(f.page.data.match,undefined);assert.equal(f.page.data.roomId,undefined);
  const w=read('pages/venue/venue.wxml');assert.match(w,/场地导览 · 非实时定位/);assert.match(w,/<venue-art\b[^>]*layout-key="{{layoutKey}}"/);
});

test('map display toggle changes only artMode and never restarts server or location work',()=>{
  const f=pageFixture('map');
  Object.assign(f.page.data,{artMode:true,devPreview:false,match:{id:'live-match',phase:'CHASING'},canScan:true,canShowCode:false,canResume:false,clock:'04:45',markers:[{id:1,latitude:32.1,longitude:118.8}],circles:[{radius:200}],offline:false});
  f.page.active=true;f.page.locationRunning=true;f.page.pollTimer=31;f.page.clockTimer=32;f.page.socket={identity:'unchanged'};
  const before=plain(f.page.data),match=f.page.data.match,markers=f.page.data.markers,circles=f.page.data.circles,socket=f.page.socket;
  for(const desired of [false,true,false,true]){
    f.page.toggleMapMode();assert.equal(f.page.data.artMode,desired);
    assert.deepEqual({...plain(f.page.data),artMode:true},before);
    assert.equal(f.page.data.match,match);assert.equal(f.page.data.markers,markers);assert.equal(f.page.data.circles,circles);
  }
  for(const patch of f.writes)assert.deepEqual(Object.keys(patch),['artMode']);
  assert.equal(f.page.locationRunning,true);assert.equal(f.page.pollTimer,31);assert.equal(f.page.clockTimer,32);assert.equal(f.page.socket,socket);assert.deepEqual(f.effects,[]);
});

test('developer preview remains illustration-only after repeated map toggles',()=>{
  const f=pageFixture('map');f.page.devPreview=true;Object.assign(f.page.data,{devPreview:true,artMode:true,clock:'04:45'});
  for(let i=0;i<5;i++)f.page.toggleMapMode();
  assert.equal(f.page.data.artMode,true);assert.equal(f.page.data.clock,'04:45');assert.deepEqual(f.effects,[]);
  const w=read('pages/map/map.wxml');
  assert.match(w,/<venue-art\b/);assert.match(w,/<map\b[^>]*markers="{{markers}}"[^>]*circles="{{circles}}"/);
  const condition=w.match(/<venue-art\b[^>]*wx:if="{{([^}]+)}}"/);
  assert.ok(condition,'venue art must own the if/else branch before the live map');
  for(const devPreview of [false,true])for(const artMode of [false,true])assert.equal(vm.runInNewContext(condition[1],{devPreview,artMode}),devPreview||artMode);
  assert.match(w,/<\/venue-art>|<venue-art\b[^>]*\/>/);assert.match(w,/<map wx:else\b/);
  assert.doesNotMatch(w,/<venue-art\b[^>]*(?:markers|circles|latitude|longitude|players|positions)=/);
  assert.doesNotMatch(w,/park-stage-|class="parkArt"/);
});

test('actual developer map cases enter art mode without timers, storage, network or GPS',()=>{
  const module={exports:{}};
  vm.runInNewContext(read('utils/dev-preview.js'),{module,require:()=>({mode:'local'}),wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}})},Date});
  const preview=module.exports;
  const cases=preview.cases.filter(item=>item.path.startsWith('/pages/map/map'));
  assert.ok(cases.length>0);
  for(const item of cases){
    const f=pageFixture('map',{preview});
    assert.equal(f.page.data.artMode,false,'production starts with native geographic map');
    f.page.onLoad({devPreview:item.id});f.page.onShow();
    assert.equal(f.page.data.devPreview,true,item.id);assert.equal(f.page.data.artMode,true,item.id);
    assert.equal(f.page.data.parkArt,asset,item.id);const before=plain(f.page.data);
    f.page.toggleMapMode();assert.deepEqual(plain(f.page.data),before,item.id);
    assert.equal(f.page.locationRunning,undefined,item.id);assert.deepEqual(f.effects,[],item.id);
  }
});

test('home, gallery and preview-map guide buttons navigate without authentication or room mutation',()=>{
  for(const name of ['index','dev','map']){
    const destinations=[],f=pageFixture(name,{wx:{navigateTo:options=>destinations.push(options.url)}});
    if(name==='map'){
      f.page.openVenue();assert.deepEqual(destinations,[],'live game stays on its native map page');
      f.page.data.devPreview=true;
    }
    const before=plain(f.page.data);f.page.openVenue();
    assert.deepEqual(destinations,['/pages/venue/venue'],name);assert.deepEqual(plain(f.page.data),before,name);assert.deepEqual(f.effects,[],name);
    assert.match(read('pages/'+name+'/'+name+'.wxml'),/<button\b[^>]*bindtap="openVenue"/);
  }
});

test('production snapshot renders only server-visible positions and server intel on native map',()=>{
  const location=[];
  const f=pageFixture('map',{wx:{getStorageSync:key=>{assert.equal(key,'v2UserId');return 'self';}},loc:{stop:()=>location.push('stop')}});
  f.page.active=true;f.page.devPreview=false;
  const snapshot={version:1,serverTime:100,owner:false,rules:{mice:6},match:{id:'m-real',phase:'FINISHED',myRole:'cat',myStatus:'active',captured:4,target:4,outcome:'cat_win',remainingMs:0},
    roster:[{id:'self',role:'cat',nickname:'本人'},{id:'authorized',role:'cat',nickname:'队友'},{id:'hidden',role:'mouse',nickname:'不可见角色',lat:1,lng:2}],
    visiblePositions:[{id:'self',lat:32.0711,lng:118.7922},{id:'authorized',lat:32.0722,lng:118.7933}],
    intel:[{cellLat:32.0733,cellLng:118.7944,radiusM:120}],venue:{lat:32.07,lng:118.79,radiusM:200},events:[]};
  const untouched=plain(snapshot);f.page.apply(snapshot);
  assert.deepEqual(plain(snapshot),untouched);
  assert.deepEqual(plain(f.page.data.markers.map(p=>[p.latitude,p.longitude])),[[32.0711,118.7922],[32.0722,118.7933],[32.07,118.79]]);
  assert.deepEqual(plain(f.page.data.circles.map(p=>[p.latitude,p.longitude,p.radius])),[[32.07,118.79,200],[32.0733,118.7944,120]]);
  assert.equal(f.page.data.latitude,32.0711);assert.equal(f.page.data.longitude,118.7922);assert.deepEqual(location,['stop']);assert.deepEqual(f.effects,[]);
});

test('every presentation state points to the active uncalibrated venue artwork without changing action gates',()=>{
  const {project}=require('../../utils/presentation');
  for(const phase of ['HIDING','CHASING','PAUSED','FINISHED','CANCELLED'])for(const role of ['cat','mouse'])for(const offline of [false,true]){
    const result=project({owner:true,match:{phase,myRole:role,myStatus:'active'},roster:[]},offline);
    assert.equal(result.parkArt,asset);
    assert.equal(result.canScan,!offline&&phase==='CHASING'&&role==='cat');
    assert.equal(result.canShowCode,!offline&&phase==='CHASING'&&role==='mouse');
    assert.equal(result.canResume,!offline&&phase==='PAUSED');
  }
});

test('packaged venue PNG and unchanged approved source match independently recorded hashes',()=>{
  const manifest=JSON.parse(read('design/maps/xuanwu-lake/runtime-v1/manifest.json'));
  const approved=JSON.parse(read('design/maps/xuanwu-lake/huanzhou-yingzhou-v3/manifest.json'));
  const source=fs.readFileSync(path.join(root,manifest.source)),runtime=fs.readFileSync(path.join(root,manifest.path));
  const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
  assert.equal(manifest.path,'assets/maps/xuanwu-lake-v3.png');
  assert.equal(manifest.source,'design/maps/xuanwu-lake/huanzhou-yingzhou-v3/huanzhou-yingzhou-corridor.png');
  assert.equal(hash(source),'c3abcab8c59bdd55d3529d8457fb03c53a8f852f2529f1dd6515f5447f34b4a6');
  assert.equal(hash(source),approved.output_sha256);assert.equal(hash(source),manifest.sourceSha256);
  assert.equal(hash(runtime),manifest.sha256);assert.equal(runtime.length,manifest.bytes);
  for(const bytes of [source,runtime]){
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(bytes.toString('ascii',12,16),'IHDR');
    assert.equal(bytes.readUInt32BE(16),1154);assert.equal(bytes.readUInt32BE(20),1363);
  }
  assert.equal(manifest.width,1154);assert.equal(manifest.height,1363);
  assert.ok(runtime.length<source.length,'runtime asset should reduce byte size without changing dimensions');
});

test('venue runtime has explicit no-georeferencing metadata and no invented calibration',()=>{
  const manifest=JSON.parse(read('design/maps/xuanwu-lake/runtime-v1/manifest.json'));
  assert.equal(manifest.georeferenced,false);assert.equal(manifest.geographicOverlay,false);
  assert.match(manifest.attribution,/OpenStreetMap contributors/);
  assert.equal(manifest.sourceLicenseUrl,'https://www.openstreetmap.org/copyright');
  assert.doesNotMatch(JSON.stringify(manifest),/"(?:bbox|gcp|gcps|homography|affine|worldFile|latitude|longitude)"\s*:/i);
  for(const file of ['components/venue-art/venue-art.js','utils/venue-camera.js','pages/venue/venue.js']){
    assert.doesNotMatch(read(file),/two-maps-v1|registration\.json|\.pgw|\bbbox\b|\bGCP\b|cellLat|cellLng|\.lat\b|\.lng\b/,file);
  }
  const map=read('pages/map/map.js');
  assert.doesNotMatch(map,/venue-camera|registration\.json|homography|latLngToPixel|geoToPixel|projectToArt/);
});




test('generated square map and packaged JPEG are independently locked without inventing calibration',()=>{const m=JSON.parse(read('design/maps/xuanwu-lake/immersive-v4/manifest.json')),hash=b=>crypto.createHash('sha256').update(b).digest('hex');assert.equal(m.width,1254);assert.equal(m.height,1254);assert.equal(m.georeferenced,false);assert.equal(m.geographicOverlay,false);assert.equal(hash(fs.readFileSync(path.join(root,m.source))),'8efcec9c8b99a73c544bee57b52b276e0cabe0a40bbf0841fd2c840999d02de6');assert.equal(hash(fs.readFileSync(path.join(root,m.path))),m.sha256);assert.equal(config.src,'/'+m.path);assert.equal(config.width,m.width);assert.equal(config.height,m.height);assert.ok(m.bytes<950000);});


test('touch before the deferred first tour leg prevents that stale leg from starting',()=>{const f=componentFixture({autoTour:true});f.attach();f.measure();f.instance.onImageLoad(f.imageEvent());f.instance.onTouchStart({touches:[{clientX:10,clientY:10}]});f.flush();assert.equal(f.timers.size,0);assert.equal(f.instance.data.mode,'manual');});
