const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
function fixture(){
 let p,id=0;const timeouts=new Map(),timers=new Map(),files=new Map(),calls=[],api={config:{},token:async()=>({expiresAt:Date.now()+15000,qrPngBase64:'server-png'})};
 const wx={getStorageSync:()=> 'me',env:{USER_DATA_PATH:'/local'},getFileSystemManager:()=>({writeFileSync:(p,b)=>files.set(p,b),unlinkSync:p=>files.delete(p)})};
 const loc={start:()=>calls.push('start'),stop:()=>calls.push('stop')};
 vm.runInNewContext(fs.readFileSync(path.join(root,'pages/map/map.js'),'utf8'),{Page:d=>p=d,require:n=>n.includes('room-live')?require('../../utils/room-live'):n.includes('venue-boundary')?require('../../utils/venue-boundary'):n.includes('venue-catalog')?require('../../utils/venue-catalog'):n.includes('venue-resources')?require('../../utils/venue-resources'):n.includes('map-markers')?require('../../utils/map-markers'):n.includes('capture-flow')?require('../../utils/capture-flow'):n.includes('qr-protocol')?require('../../utils/qr-protocol'):n.includes('capture-proof')?require('../../utils/capture-proof'):n.includes('presentation')?require('../../utils/presentation'):n.includes('snapshot-v2')?require('../../utils/snapshot-v2'):n.includes('location-v2')?loc:api,wx,Date,Math,Number,Error,Promise,JSON,encodeURIComponent,setInterval:fn=>{timers.set(++id,fn);return id;},clearInterval:id=>timers.delete(id),setTimeout:fn=>{timeouts.set(++id,fn);return id;},clearTimeout:id=>timeouts.delete(id)});
 p.selectComponent=()=>null;p.setData=x=>Object.assign(p.data,x);p.active=true;p.data.roomId='r';p.realPoll=p.poll;p.poll=async()=>{};
 return {p,api,timers,timeouts,files,calls};
}
function snap(version=1,phase='CHASING') {return {version,serverTime:Date.now()+version,owner:false,venue:{lat:32,lng:118,radiusM:200},roster:[{id:'me',role:'mouse'},{id:'hidden',role:'cat',lat:99,lng:99}],visiblePositions:phase==='CHASING'?[{id:'me',lat:32.001,lng:118.001,accuracy:7}]:[],intel:[],match:{id:'match',phase,myRole:'mouse',myStatus:'active',captured:1,target:4,remainingMs:50000}};}
const settle=()=>new Promise(r=>setImmediate(r));

test('campus map identity survives disconnect and hide while all tactical positions clear',()=>{
 const catalog=require('../../utils/venue-catalog');
 for(const id of ['seu-jiulonghu-v1','seu-sipailou-v1']){
  const {p}=fixture(),s=snap();s.venue={...s.venue,mapId:id};p.apply(s);
  p.setOffline('lost');assert.equal(p.data.venueMapId,id);assert.equal(p.data.parkArt,catalog.get(id).src);assert.equal(p.data.geoData.points.length,0);assert.equal(p.data.markers.length,0);
  p.cleanup();assert.equal(p.data.venueMapId,id);assert.equal(p.data.parkArt,catalog.get(id).src);
  p.active=true;p.apply({...s,version:2});assert.equal(p.data.offline,false);assert.equal(p.data.venueMapId,id);assert.ok(p.data.geoData.points.length>0);
 }
});
test('map code sheet reuses server PNG, one timer and existing position subscription',async()=>{
 const f=fixture(),p=f.p;p.apply(snap());assert.deepEqual(f.calls,['start']);
 p.showCode();p.showCode();await settle();assert.equal(p.data.codeOpen,true);assert.equal(f.timers.size,1);assert.equal(f.files.size,1);assert.equal([...f.files.values()][0],'server-png');assert.deepEqual(f.calls,['start']);
 p.closeCode();assert.equal(f.timers.size,0);assert.equal(f.files.size,0);assert.equal(p.data.codeOpen,false);assert.deepEqual(f.calls,['start']);
});
test('late code responses cannot restore hidden, disconnected, captured or changed-match sheets',async()=>{
 for(const stop of ['close','offline','paused','captured','newMatch','hide']){
  const f=fixture(),p=f.p;let resolve;p.apply(snap());f.api.token=()=>new Promise(r=>resolve=r);p.showCode();
  if(stop==='close')p.closeCode();if(stop==='offline')p.setOffline('lost');if(stop==='paused')p.apply(snap(2,'PAUSED'));
  if(stop==='captured'){const s=snap(2);s.match.myStatus='captured';s.visiblePositions=[];p.apply(s);}
  if(stop==='newMatch'){const s=snap(2);s.match.id='next';p.apply(s);}if(stop==='hide')p.cleanup();
  resolve({expiresAt:Date.now()+15000,qrPngBase64:'late-png'});await settle();assert.equal(p.data.codeOpen,false,stop);assert.equal(f.files.size,0,stop);assert.equal(f.timers.size,0,stop);
 }
});
test('manual map gestures survive snapshots; explicit self action resumes following',()=>{
 const {p}=fixture();p.data.artMode=false;p.apply(snap());p.onMapRegion({type:'end',causedBy:'gesture',detail:{scale:15}});p.setData({latitude:31.9,longitude:117.9});p.apply(snap(2));assert.equal(p.data.latitude,31.9);assert.equal(p.data.longitude,117.9);assert.equal(p.data.mapScale,15);p.locateSelf();assert.equal(p.data.latitude,32.001);assert.equal(p.data.followSelf,true);assert.equal(p.data.mapScale,17);
});
test('polygon venue displays the public boundary on both maps and clears it on disconnect',()=>{
 const {p}=fixture(),s=snap();s.venue={lat:32,lng:118,confirmed:true,boundary:[{lat:31.999,lng:117.999},{lat:31.999,lng:118.001},{lat:32.001,lng:118.001},{lat:32.001,lng:117.999}]};p.apply(s);assert.equal(p.data.venuePolygons.length,1);assert.equal(p.data.circles.length,0);assert.deepEqual(JSON.parse(JSON.stringify(p.data.geoData.boundary)),s.venue.boundary);assert.equal(p.data.markers.length,2);p.setOffline('lost');assert.deepEqual(JSON.parse(JSON.stringify(p.data.venuePolygons)),[]);assert.equal(p.data.geoData.boundary,undefined);
});
test('offline and invalid models cannot invent self position or expose hidden roster coordinates',()=>{
 const {p}=fixture();p.apply(snap());assert.equal(p.data.markers.length,2);assert.equal(p.data.geoData.points.length,2);assert.ok([...p.data.geoData.points,...p.data.geoData.regions,...(p.data.geoData.boundary||[])].every(q=>q.lat!==99&&q.lng!==99));assert.equal(p.data.artMode,true);p.locateSelf();assert.match(p.data.error,/超出此图参考/);p.toggleMapMode();assert.equal(p.data.artMode,false);p.setOffline('lost');assert.equal(p.data.hasSelf,false);assert.equal(p.data.markers.length,0);assert.equal(p.data.geoData.points.length,0);const before=p.data.latitude;p.locateSelf();assert.equal(p.data.latitude,before);assert.match(p.data.error,/连接恢复/);
});
test('drawer closes only after exit animation and swipe competes only on its grip',()=>{
 const {p}=fixture();p.openDrawer({currentTarget:{dataset:{tab:'rules'}}});assert.equal(p.data.drawerTab,'rules');p.sheetTouchStart({touches:[{clientX:100,clientY:10}]});p.sheetTouchEnd({changedTouches:[{clientX:105,clientY:90}]});assert.equal(p.data.drawer,true);assert.equal(p.data.drawerClosing,true);p.drawerAnimationEnd({detail:{animationName:'sheetEnter'}});assert.equal(p.data.drawer,true);p.drawerAnimationEnd({detail:{animationName:'sheetExit'}});assert.equal(p.data.drawer,false);
});
test('failed and expired proof never render a stale image; retry uses same live match',async()=>{
 const f=fixture(),p=f.p;p.apply(snap());p.showCode();await settle();assert.equal(f.files.size,1);f.api.token=async()=>({expiresAt:Date.now()-1,qrPngBase64:'expired'});await p.refresh();assert.equal(p.data.image,'');assert.equal(f.files.size,0);assert.match(p.data.codeError,/过期/);p.closeCode();
});

test('fixed compact header survives tray folds without changing authoritative match or positions',()=>{const {p,calls}=fixture();p.apply(snap());const m=p.data.match,g=p.data.geoData;p.toggleTray();assert.equal(p.toggleHud,undefined);assert.equal(p.data.trayExpanded,false);assert.equal(p.data.match,m);assert.equal(p.data.geoData,g);assert.deepEqual(calls,['start']);p.toggleTray();assert.equal(p.data.trayExpanded,true);});

test('visible map zoom controls delegate art camera and keep native map scale within bounds',()=>{
 const {p,calls}=fixture();p.apply(snap());const match=p.data.match,zoom=[];p.selectComponent=()=>({zoomIn:()=>zoom.push(1),zoomOut:()=>zoom.push(-1)});p.zoomMapIn();p.zoomMapOut();assert.deepEqual(zoom,[1,-1]);p.data.artMode=false;for(let i=0;i<30;i++)p.zoomMapIn();assert.equal(p.data.mapScale,20);for(let i=0;i<30;i++)p.zoomMapOut();assert.equal(p.data.mapScale,3);assert.equal(p.data.match,match);assert.deepEqual(calls,['start']);
});

test('hide clears tactical positions and rejects a delayed poll after returning to the page',async()=>{
 const {p,api}=fixture();p.apply(snap());let oldResolve,newResolve;api.room=()=>new Promise(r=>oldResolve=r);const old=p.realPoll();
 p.cleanup();assert.equal(p.data.geoData.points.length,0);assert.equal(p.data.geoData.regions.length,0);assert.equal(p.data.offline,true);assert.equal(p.data.hasSelf,false);
 p.active=true;api.room=()=>new Promise(r=>newResolve=r);const current=p.realPoll();oldResolve(snap(20));await old;assert.equal(p.fetching,true);assert.equal(p.data.geoData.points.length,0);
 newResolve(snap(3));await current;assert.equal(p.data.version,3);assert.equal(p.fetching,false);assert.equal(p.data.offline,false);
});

test('drawer exit fallback removes mask without native animation event and cleans pending timer on hide',()=>{const {p,timeouts}=fixture();p.openDrawer();p.closeDrawer();assert.equal(timeouts.size,1);[...timeouts.values()][0]();assert.equal(p.data.drawer,false);p.openDrawer();p.closeDrawer();p.cleanup();assert.equal(p.data.drawer,false);assert.equal(p.drawerExitTimer,null);});

test('tray downward and upward grip gestures snap to state, suppress duplicate tap, and cancel safely',()=>{
 const {p}=fixture();const event=(x,y)=>({touches:[{clientX:x,clientY:y}]});p.trayTouchStart(event(100,100));p.trayTouchMove(event(101,160));assert.equal(p.data.trayDragging,true);assert.equal(p.data.trayDragY,60);p.trayTouchEnd();assert.equal(p.data.trayExpanded,false);p.toggleTray();assert.equal(p.data.trayExpanded,false);
 p._traySuppressUntil=0;p.trayTouchStart(event(100,200));p.trayTouchMove(event(100,150));p.trayTouchEnd();assert.equal(p.data.trayExpanded,true);
 p.trayTouchStart(event(100,100));p.trayTouchMove(event(180,105));p.trayTouchEnd();p.toggleTray();assert.equal(p.data.trayExpanded,true);assert.equal(p.data.trayDragging,false);
 p.trayTouchStart(event(100,100));p.trayTouchMove({touches:[{clientX:100,clientY:130},{clientX:140,clientY:130}]});assert.equal(p._trayGesture,null);assert.equal(p.data.trayDragY,0);
 p.trayTouchStart(event(100,100));p.trayTouchMove(event(100,120));p.cleanup();assert.equal(p.data.trayDragging,false);assert.equal(p.data.trayDragY,0);
});


test('new pixel markers use only authorized positions, share anchors and clear on disconnect',()=>{
 const {p}=fixture(),s=snap();s.visiblePositions.push({id:'friend',lat:32.002,lng:118.002});s.roster.push({id:'friend',role:'mouse'});p.apply(s);
 const icons=require('../../utils/map-markers');assert.equal(p.data.markers.length,3);
 for(const [i,role] of ['self','ally','venue'].entries()){const m=p.data.markers[i],icon=icons.sprite(role);assert.equal(m.iconPath,icon.iconPath);assert.deepEqual(JSON.parse(JSON.stringify(m.anchor)),icon.anchor);assert.equal(m.width,48);assert.equal(m.height,48);}
 assert.ok(!JSON.stringify(p.data.markers).includes('hidden'));assert.equal(p.data.geoData.points.length,3);p.setOffline('lost');assert.equal(p.data.markers.length,0);assert.equal(p.data.geoData.points.length,0);
});
