const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function source(name){return fs.readFileSync(path.join(root,name),'utf8');}
function fixture(version='develop'){
  const wx={getAccountInfoSync:()=>({miniProgram:{envVersion:version}})};
  const module={exports:{}};
  vm.runInNewContext(source('utils/dev-preview.js'),{module,require:p=>p.includes('venue-catalog')?require('../../utils/venue-catalog'):({mode:'local'}),wx,Date});
  return module.exports;
}
function page(name,preview,events){
  let result;
  const fail=kind=>()=>{events.push(kind);throw Error('unexpected '+kind);};
  const wx={getStorageSync:()=>undefined,setStorageSync:fail('storage'),getLocation:fail('gps'),connectSocket:fail('socket'),scanCode:fail('camera'),request:fail('request'),navigateTo:x=>events.push(x.url),navigateBack:()=>events.push('back'),redirectTo:x=>events.push(x.url),reLaunch:x=>events.push(x.url)};
  const api={config:{mode:'local',localTestIdentities:false},session:fail('session'),room:fail('room'),create:fail('create'),join:fail('join'),ready:fail('ready'),start:fail('start'),pause:fail('pause'),resume:fail('resume'),cancel:fail('cancel'),leave:fail('leave'),token:fail('token')};
  const loc={start:fail('location-start'),once:fail('location-once'),stop:fail('location-stop')};
  const requireMock=p=>p.includes('venue-catalog')?require('../../utils/venue-catalog'):p.includes('venue-resources')?require('../../utils/venue-resources'):p.includes('map-markers')?require('../../utils/map-markers'):p.includes('capture-proof')?require('../../utils/capture-proof'):p.includes('team-config')?require('../../utils/team-config'):p.includes('presentation')?require('../../utils/presentation'):p.includes('dev-preview')?preview:p.includes('location-v2')?loc:p.includes('snapshot-v2')?{shouldApply:()=>true}:api;
  vm.runInNewContext(source('pages/'+name+'/'+name+'.js'),{Page:x=>result=x,require:requireMock,wx,Date,Math,Number,Error,Promise,JSON,encodeURIComponent,setInterval:fail('interval'),clearInterval:()=>{},setTimeout:(fn,ms)=>{if(ms===220 && result.data.drawerClosing)return 1;return fail('timeout')();},clearTimeout:()=>{},console});
  result.setData=function(changes){Object.assign(this.data,changes);};
  return result;
}
test('developer gallery lists every shipped core state and denies non-developer entry',()=>{
  const dev=fixture(),release=fixture('release');
  assert.equal(dev.enabled(),true);assert.equal(release.enabled(),false);
  assert.equal(dev.cases.length,14);
  for(const item of dev.cases){assert.equal(dev.accepts(item.id),true);assert.equal(release.accepts(item.id),false);assert.match(item.path,/^\/pages\/(index|room|map|qrcode)\//);}
  const compile=JSON.parse(source('project.config.json')).condition.miniprogram;
  assert.equal(compile.list.length,dev.cases.length+2);assert.ok(compile.list.some(mode=>mode.pathName==='pages/venue/venue'));
  assert.equal(compile.list[compile.current].pathName,'pages/dev/dev');
  for(const item of dev.cases){const [pathName,query]=item.path.slice(1).split('?');assert.ok(compile.list.some(mode=>mode.pathName===pathName&&mode.query===query),item.id);}
  const events=[];let gallery=page('dev',dev,events);gallery.onLoad();assert.equal(gallery.data.cases.length,14);
  for(const item of dev.cases)gallery.open({currentTarget:{dataset:{id:item.id}}});
  assert.deepEqual(events,Array.from(dev.cases,item=>item.path));
  gallery=page('dev',release,events);gallery.onLoad();assert.equal(gallery.data.available,false);assert.equal(events.pop(),'/pages/index/index');
});
test('preview cases render without API, positioning, socket, camera, storage or timers',async()=>{
  const preview=fixture(),events=[];
  for(const item of preview.cases){
    const name=item.path.split('/')[2],p=page(name,preview,events);
    p.onLoad({devPreview:item.id});await p.onShow();
    assert.equal(p.data.devPreview,true,item.id);
    if(name==='map'){
      assert.ok(p.data.match,item.id);
      assert.equal(p.data.connection,item.id==='offline'?'重连中':'界面预览');
      assert.equal(p.locationRunning,undefined);
      if(item.id==='captured'||item.id==='paused'||item.id==='catWin'||item.id==='mouseWin'||item.id==='cancelled')assert.equal(p.data.markers.length,1); // venue only
      if(item.id==='offline')assert.equal(p.data.markers.length,0);
      if(item.id==='alert')assert.equal(p.data.nearbyCat,true);
    }
    if(name==='qrcode')assert.equal(p.data.image,'');
    p.onHide?.();
  }
  assert.deepEqual(events,[]);
});
test('preview actions stay local and blocked preview URLs redirect',async()=>{
  const preview=fixture(),events=[];
  const home=page('index',preview,events);home.onLoad({devPreview:'home'});await home.onShow();await home.create();await home.join();
  assert.deepEqual(events.splice(0),['/pages/room/room?devPreview=create','/pages/room/room?devPreview=ready']);
  const room=page('room',preview,events);room.onLoad({devPreview:'create'});await room.onShow();room.chooseVenue();await room.create();await room.toggleReady();await room.start();assert.deepEqual(events,[]);await room.toggleReady();await room.start();
  assert.equal(room.data.devPreview,true);assert.deepEqual(events.splice(0),['/pages/map/map?devPreview=hiding&mapId=xuanwu-v4']);
  const map=page('map',preview,events);map.onLoad({devPreview:'mouse'});map.onShow();map.showCode();await map.pause();await map.resume();await map.cancel();await map.emergency();await map.leave();
  assert.deepEqual(events.splice(0),['/pages/dev/dev']);
  const code=page('qrcode',preview,events);code.onLoad({devPreview:'code'});code.back();assert.deepEqual(events.splice(0),['/pages/map/map?devPreview=mouse']);
  for(const p of [home,room,map,code])p.backToDev();assert.deepEqual(events.splice(0),Array(4).fill('/pages/dev/dev'));
  const denied=page('map',fixture('release'),events);denied.onLoad({devPreview:'cat'});denied.onShow();assert.deepEqual(events,['/pages/index/index']);
});
test('pilot preview roster, captures, frozen clock and event sequence stay consistent',()=>{
  const dev=fixture();
  for(const item of dev.cases.filter(x=>x.path.includes('/map/'))){
    const s=dev.mapSnapshot(item.id,'me');
    assert.equal(s.roster.length,8,item.id);assert.equal(s.roster.filter(p=>p.role==='cat').length,2,item.id);
    assert.equal(s.roster.filter(p=>p.status==='captured').length,s.match.captured,item.id);
    assert.equal(s.match.target,4);assert.equal(new Set(s.events.map(e=>e.seq)).size,s.events.length);
    for(const p of s.visiblePositions)assert.equal(s.roster.find(r=>r.id===p.id).role,s.match.myRole);
    if(item.id==='hiding'){assert.equal(s.match.captured,0);assert.equal(s.events.some(e=>e.kind==='CHASING'),false);}
    if(item.id==='paused')assert.equal(s.match.remainingMs,285000);
  }
});
test('room readiness controls explain waiting and never open a round early',async()=>{
  const preview=fixture(),events=[],room=page('room',preview,events);
  room.onLoad({devPreview:'ready'});await room.onShow();
  assert.equal(room.data.canStart,true);assert.equal(room.data.readyCount,8);
  await room.toggleReady();assert.equal(room.data.canStart,false);assert.equal(room.data.roster[0].ready,false);
  assert.match(room.data.startHint,/1 人未准备/);await room.start();assert.deepEqual(events,[]);
  room.applyRoom({roster:room.data.roster.slice(0,3)});assert.match(room.data.startHint,/5 位伙伴/);
  room.applyRoom({roster:preview.roomData('ready').roster,owner:false});await room.start();assert.deepEqual(events,[]);
  assert.match(source('pages/room/room.wxml'),/<pixel-action[^>]*bindaction="copy"/);
});
test('map view labels and drawer distinguish frozen, captured and public venue state',()=>{
  const preview=fixture(),events=[];
  const map=page('map',preview,events);map.onLoad({devPreview:'paused'});map.onShow();
  assert.equal(map.data.clock,'04:45');assert.equal(map.data.pauseReasonText,'组织者暂停');
  assert.equal(map.data.circles.length,1);assert.equal(map.data.circles[0].radius,200);
  map.toggleDrawer();assert.equal(map.data.drawer,true);map.closeDrawer();assert.equal(map.data.drawerClosing,true);map.drawerAnimationEnd();assert.equal(map.data.drawer,false);
  map.onLoad({devPreview:'captured'});map.onShow();assert.equal(map.data.phaseText,'本轮出局');
  assert.equal(map.data.markers.length,1);assert.equal(map.data.nearbyCat,false);
  assert.match(source('pages/map/map.wxml'),/<scroll-view scroll-y class="drawerBody">/);
  assert.match(source('pages/map/map.wxml'),/class="drawerMask[^\"]*" bindtap="closeDrawer"/);
});
