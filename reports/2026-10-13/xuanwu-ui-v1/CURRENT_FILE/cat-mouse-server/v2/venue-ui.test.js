const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
const camera=require('../../utils/venue-camera');
const asset='/assets/maps/xuanwu-lake-v3.png';

function componentFixture(overrides={}) {
  let definition;
  const ticks=[],queries=[],writes=[];
  const forbidden=name=>()=>{throw Error('unexpected component side effect: '+name);};
  const wx=new Proxy({nextTick:fn=>ticks.push(fn)},{get:(target,key)=>key in target?target[key]:forbidden(String(key))});
  vm.runInNewContext(read('components/venue-art/venue-art.js'),{
    Component:value=>definition=value,wx,
    require:name=>{assert.equal(name,'../../utils/venue-camera');return camera;},
    setTimeout:forbidden('setTimeout'),setInterval:forbidden('setInterval'),
    clearTimeout:forbidden('clearTimeout'),clearInterval:forbidden('clearInterval')
  });
  const defaults=Object.fromEntries(Object.entries(definition.properties).map(([key,value])=>[key,value.value]));
  const instance={...definition.methods,data:{...defaults,...plain(definition.data),...overrides}};
  instance.setData=patch=>{writes.push(plain(patch));Object.assign(instance.data,patch);};
  instance.createSelectorQuery=()=>({
    select(selector){assert.equal(selector,'.venueViewport');return this;},
    boundingClientRect(callback){queries.push(callback);return this;},
    exec(){}
  });
  const flush=()=>{while(ticks.length)ticks.shift()();};
  const attach=()=>definition.lifetimes.attached.call(instance);
  const detach=()=>definition.lifetimes.detached.call(instance);
  const imageEvent=(generation=instance._imageSerial)=>({currentTarget:{dataset:{generation}}});
  const cameraEvent=(detail={},serial=instance._cameraSerial)=>({detail,currentTarget:{dataset:{camera:serial}}});
  const measure=(width=390,height=600)=>{flush();assert.ok(queries.length,'a viewport query must be scheduled');queries.shift()({width,height});};
  const ready=()=>{attach();measure();instance.onImageLoad(imageEvent());};
  return {definition,instance,ticks,queries,writes,flush,attach,detach,imageEvent,cameraEvent,measure,ready};
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

for(const [label,width,height] of [
  ['390 px portrait',390,640],['320 px narrow',320,489],
  ['large text residual viewport',320,280],['tablet',1024,1180],
  ['landscape',844,240],['tall display',390,1600],['source size',1154,1363]
]) test('venue contain preserves every edge at '+label,()=>{
  const fit=camera.fitContain(width,height);
  assert.equal(fit.valid,true);assert.equal(fit.scale,1);
  assert.ok(Math.abs(fit.width/fit.height-1154/1363)<1e-12);
  assert.ok(fit.x>=0&&fit.y>=0);
  assert.ok(fit.x+fit.width<=width+1e-9&&fit.y+fit.height<=height+1e-9);
  assert.ok(Math.abs(fit.x-(width-fit.width)/2)<1e-9);
  assert.ok(Math.abs(fit.y-(height-fit.height)/2)<1e-9);
  assert.ok(Math.abs(fit.width-width)<1e-9||Math.abs(fit.height-height)<1e-9);
});

test('venue contain rejects nonfinite, nonnumeric, empty and underflow dimensions',()=>{
  for(const value of [0,-1,NaN,Infinity,-Infinity,null,'390',undefined]){
    const dimensions=[390,640,1154,1363];
    for(const index of [0,1,2,3]){
      if(value===undefined&&index>=2)continue; // Source defaults intentionally accept omitted values.
      const args=[...dimensions];args[index]=value;
      const fit=camera.fitContain(...args);
      assert.deepEqual(fit,{valid:false,width:0,height:0,x:0,y:0,scale:1});
    }
  }
  assert.equal(camera.fitContain(Number.MIN_VALUE,1,Number.MAX_VALUE,1363).valid,false);
  const changed=camera.fitContain(320,600,400,200);
  assert.equal(changed.width,320);assert.equal(changed.height,160);
});

test('venue scale is finite and bounded independently of gesture input',()=>{
  for(const value of [NaN,Infinity,-Infinity,undefined,null,'2',{},false])assert.equal(camera.clampScale(value),1);
  for(const [value,expected] of [[-50,1],[0,1],[1,1],[1.25,1.25],[2.999,2.999],[3,3],[400,3]])assert.equal(camera.clampScale(value),expected);
});

test('native venue component starts centered at uniform contain with a loading image',()=>{
  const f=componentFixture();f.attach();
  assert.equal(f.instance.data.imageState,'loading');assert.equal(f.instance.data.fitReady,false);
  f.measure(320,489);
  const expected=camera.fitContain(320,489);
  for(const [key,value] of Object.entries({fitWidth:expected.width,fitHeight:expected.height,x:expected.x,y:expected.y,scaleValue:1}))assert.equal(f.instance.data[key],value,key);
  assert.equal(f.instance.data.fitReady,true);assert.equal(f.instance.data.cameraNodes.length,1);assert.equal(f.instance.data.imageNodes.length,1);
  f.instance.onImageLoad(f.imageEvent());assert.equal(f.instance.data.imageState,'ready');
});

test('native zoom buttons require loaded artwork and stop at 1x and 3x',()=>{
  const f=componentFixture();f.attach();f.measure();
  f.instance.zoomIn();assert.equal(f.instance.data.scaleValue,1);
  f.instance.onImageLoad(f.imageEvent());
  f.instance.zoomIn();assert.equal(f.instance.data.scaleValue,1.25);assert.equal(f.instance.data.zoomLabel,'1.25×');
  for(let i=0;i<20;i++)f.instance.zoomIn();
  assert.equal(f.instance.data.scaleValue,3);assert.equal(f.instance.data.canZoomIn,false);assert.equal(f.instance.data.canZoomOut,true);
  for(let i=0;i<20;i++)f.instance.zoomOut();
  assert.equal(f.instance.data.scaleValue,1);assert.equal(f.instance.data.canZoomOut,false);assert.equal(f.instance.data.canZoomIn,true);
});

test('gesture frames remain native and commit a single finite camera patch on release',()=>{
  const f=componentFixture();f.ready();const before=f.writes.length;
  for(let i=0;i<200;i++)f.instance.onScale(f.cameraEvent({x:-i/2,y:-i,scale:1+i/100}));
  f.instance.onMove(f.cameraEvent({x:-99,y:-120}));
  assert.equal(f.writes.length,before,'gesture frames must not cross the setData bridge');
  f.instance.onGestureEnd(f.cameraEvent());assert.equal(f.writes.length,before);
  f.flush();assert.equal(f.writes.length,before+1);
  assert.equal(f.instance.data.x,-99);assert.equal(f.instance.data.y,-120);assert.equal(f.instance.data.scaleValue,2.99);assert.equal(f.instance.data.zoomLabel,'2.99×');
  f.instance.onScale(f.cameraEvent({x:NaN,y:Infinity,scale:Infinity}));
  f.instance.onGestureEnd(f.cameraEvent());f.flush();assert.equal(f.writes.length,before+1);
});

test('reset recreates the native camera and ignores old gesture generation',()=>{
  const f=componentFixture();f.ready();const old=f.instance._cameraSerial;
  f.instance.onScale(f.cameraEvent({x:-60,y:-70,scale:2}));f.instance.onGestureEnd(f.cameraEvent());f.flush();
  f.instance.reset();const expected=camera.fitContain(390,600);
  assert.ok(f.instance._cameraSerial>old);assert.equal(f.instance.data.scaleValue,1);
  assert.equal(f.instance.data.x,expected.x);assert.equal(f.instance.data.y,expected.y);
  const before=f.writes.length;
  f.instance.onMove(f.cameraEvent({x:-800,y:-900},old));f.instance.onScale(f.cameraEvent({scale:3},old));f.instance.onGestureEnd(f.cameraEvent({},old));f.flush();
  assert.equal(f.writes.length,before);assert.equal(f.instance.data.scaleValue,1);
});

test('viewport, compact and large font layout keys remeasure rather than crop',()=>{
  const f=componentFixture();f.ready();f.instance.zoomIn();
  Object.assign(f.instance.data,{layoutKey:'320:693:1.3:87:34',compact:true});
  f.definition.observers['layoutKey, compact, sourceWidth, sourceHeight'].call(f.instance);
  f.measure(296,250);
  const fit=camera.fitContain(296,250);
  assert.equal(f.instance.data.fitWidth,fit.width);assert.equal(f.instance.data.fitHeight,fit.height);
  assert.equal(f.instance.data.scaleValue,1);assert.equal(f.instance.data.y,fit.y);assert.equal(f.instance.data.x,fit.x);
});

test('latest viewport query wins and an invalid viewport never publishes NaN geometry',()=>{
  const f=componentFixture();f.attach();f.flush();const stale=f.queries.shift();
  f.definition.observers['layoutKey, compact, sourceWidth, sourceHeight'].call(f.instance);f.flush();
  f.queries.shift()({width:320,height:400});const before=f.writes.length;
  stale({width:999,height:999});assert.equal(f.writes.length,before);
  assert.equal(f.instance.data.fitWidth,camera.fitContain(320,400).width);
  f.instance._scheduleFit();f.flush();f.queries.shift()({width:0,height:NaN});
  assert.equal(f.instance.data.fitReady,false);assert.deepEqual(plain(f.instance.data.cameraNodes),[]);
  for(const key of ['fitWidth','fitHeight','x','y','scaleValue'])assert.ok(Number.isFinite(f.instance.data[key]),key);
});

test('image error retry remains local and rejects stale image callbacks',()=>{
  const f=componentFixture();f.ready();const old=f.instance._imageSerial;
  f.instance.onImageError(f.imageEvent());assert.equal(f.instance.data.imageState,'error');
  f.instance.retry();assert.equal(f.instance.data.imageState,'loading');assert.ok(f.instance._imageSerial>old);
  f.instance.onImageLoad(f.imageEvent(old));assert.equal(f.instance.data.imageState,'loading');
  f.measure();f.instance.onImageLoad(f.imageEvent());assert.equal(f.instance.data.imageState,'ready');
  const before=f.writes.length;f.instance.onImageError(f.imageEvent(old));assert.equal(f.writes.length,before);
  f.instance.data.src='';f.definition.observers.src.call(f.instance);f.flush();
  assert.equal(f.instance.data.imageState,'error');assert.deepEqual(plain(f.instance.data.imageNodes),[]);
});

test('detach suppresses pending tick, selector, image, gesture and button writes',()=>{
  const f=componentFixture();f.ready();
  f.instance._scheduleFit();f.flush();const late=f.queries.shift();
  const img=f.imageEvent(),gesture=f.cameraEvent({x:-100,scale:2});
  f.instance.onGestureEnd(gesture);f.instance.retry();
  f.detach();const before=f.writes.length;
  late({width:320,height:400});f.flush();
  f.instance.onImageLoad(img);f.instance.onImageError(img);f.instance.onMove(gesture);f.instance.onScale(gesture);f.instance.onGestureEnd(gesture);
  f.instance.zoomIn();f.instance.zoomOut();f.instance.reset();f.instance.retry();f.flush();
  assert.equal(f.writes.length,before);assert.equal(f.queries.length,0);
});

test('venue viewer has only display properties and native aspect-fit pan/zoom',()=>{
  const f=componentFixture();
  assert.deepEqual(Object.keys(f.definition.properties).sort(),['compact','layoutKey','sourceHeight','sourceWidth','src']);
  assert.equal(f.instance.data.src,asset);assert.equal(f.instance.data.sourceWidth,1154);assert.equal(f.instance.data.sourceHeight,1363);
  const w=read('components/venue-art/venue-art.wxml'),css=read('components/venue-art/venue-art.wxss');
  assert.match(w,/<movable-area\b/);assert.match(w,/<movable-view\b[^>]*direction="all"[^>]*scale="{{true}}"/);
  assert.match(w,/mode="aspectFit"/);assert.doesNotMatch(w,/scaleToFill|aspectFill|markers=|circles=|latitude=|longitude=/);
  assert.doesNotMatch(css,/scale[XY]\s*\(|object-fit\s*:\s*cover/);
  assert.match(w,/OpenStreetMap contributors/);assert.match(w,/非实时定位/);
  assert.match(css,/min-height:44px/);assert.match(css,/\.venueFooter\{flex:none/);
  for(const file of ['components/venue-art/venue-art.js','pages/venue/venue.js','utils/venue-camera.js']){
    const code=read(file);
    assert.doesNotMatch(code,/getLocation|startLocationUpdate|onLocationChange|connectSocket|\brequest\s*\(|StorageSync|setInterval|setTimeout|location-v2|utils\/v2|visiblePositions|\bintel\b/ ,file);
  }
});

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

test('every presentation state points to the shared v3 venue art without changing action gates',()=>{
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
  assert.equal(manifest.path,asset.slice(1));
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
