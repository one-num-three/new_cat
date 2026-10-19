const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),osm=require('../../utils/osm-art-registration'),catalog=require('../../utils/venue-catalog');
const id='seu-jiulonghu-v1',point={lat:31.882368,lng:118.828049};
test('reported GCJ02 point is inside campus but outside old hull; extended controls cover it and a 40m neighbourhood',()=>{
 assert.equal(catalog.contains(id,point),true);const wgs=osm.gcjToWgs(point,'gcj02'),old=require('../../design/maps/seu-campuses-v1/jiulonghu-registration.json');
 assert.equal(require('../../design/maps/seu-campuses-v1/mapping').geoToPixel([wgs.lng,wgs.lat],old),null);
 const q=osm.project(point,'gcj02',id);assert.ok(q);assert.ok(Math.hypot(q.u*1254-1077,q.v*1254-965)<10);assert.equal(q.fieldVerified,false);
 for(const dx of [-20,0,20])for(const dy of [-20,0,20])assert.ok(osm.project({lat:point.lat+dy/111200,lng:point.lng+dx/94600},'gcj02',id));
 assert.equal(osm.project(point,'wgs84',id),null);assert.equal(osm.project(point,'gcj02','seu-sipailou-v1'),null);assert.equal(osm.project({lat:0,lng:0},'gcj02',id),null);
 const m=require('../../design/maps/seu-jiulonghu-registration-v2/jiulonghu-registration.json');assert.equal(m.anchors.length,23);assert.equal(m.triangles.length,36);assert.deepEqual(m.quality.folds,[]);assert.equal(m.extrapolation,false);
 for(let i=0;i<20;i++){assert.deepEqual(m.anchors[i].wgs84,old.anchors[i].wgs84);assert.deepEqual(m.anchors[i].pixel,old.anchors[i].pixel);}
 assert.equal(m.quality.independentImageChecks.length,2);for(const c of m.quality.independentImageChecks)assert.ok(c.errorPx<10);
});
function scenarios(platform='devtools',env='develop'){
 const module={exports:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'utils/location-scenarios.js'),'utf8'),{module,wx:{getDeviceInfo:()=>({platform}),getAccountInfoSync:()=>({miniProgram:{envVersion:env}})}});return module.exports;
}
test('coordinate simulation requires explicit scenario plus developer-tool platform and develop build',()=>{
 for(const [platform,env]of [['ios','develop'],['android','develop'],['devtools','trial'],['devtools','release']])assert.equal(scenarios(platform,env).get('jiulonghu-meiyuan7b',id),null);
 const s=scenarios();assert.equal(s.get(undefined,id),null);assert.equal(s.get('unknown',id),null);assert.equal(s.get('jiulonghu-meiyuan7b','xuanwu-v4'),null);assert.equal(s.get('jiulonghu-meiyuan7b',id).simulated,true);
});
function page(platform='devtools'){
 let p;const simulated=scenarios(platform),wx={nextTick:f=>f()};vm.runInNewContext(fs.readFileSync(path.join(root,'pages/venue/venue.js'),'utf8'),{Page:d=>p=d,wx,Math,Number,Date,require:n=>n.includes('location-scenarios')?simulated:n.includes('foreground-location')?{create:()=>{throw Error('Simulation must never collect native GPS');}}:n.includes('presentation')?{metrics:()=>({viewportWidth:390,viewportHeight:844})}:require(path.resolve(root,'pages/venue',n))});
 p.setData=x=>Object.assign(p.data,x);p.selectComponent=()=>({focusSelf:()=>true});return p;
}
test('public page shows reported simulated point explicitly and clears it on stop, hide and site change',()=>{
 const p=page();p.onLoad({mapId:id,simPosition:'jiulonghu-meiyuan7b'});p.onShow();assert.equal(p.data.simulated,true);assert.match(p.data.locationText,/模拟定位/);assert.match(p.data.coordinateText,/31.882368, 118.828049/);assert.doesNotMatch(p.data.locationError,/超出|未完成/);assert.equal(p.data.geoData.points[0].label,'模拟本人');
 p.onHide();assert.equal(p.data.geoData.points.length,0);p.onShow();assert.equal(p.data.hasPosition,true);p.stopGps({currentTarget:{}});p.onShow();assert.equal(p.data.hasPosition,false);p.locate();assert.equal(p.data.hasPosition,true);
 p.selectMap('seu-sipailou-v1');assert.equal(p.data.hasPosition,false);assert.equal(p.simulation,null);
 const phone=page('ios');phone.onLoad({mapId:id,simPosition:'jiulonghu-meiyuan7b'});phone.onShow();assert.equal(phone.data.hasPosition,false);assert.match(phone.data.locationError,/仅限电脑/);
});
test('guide distinguishes reference footprint from broad venue bounding box without claiming campus membership',()=>{
 const p=page();p.onLoad({mapId:id});p.onShow();const insideBox={lat:31.8956,lng:118.82,accuracy:5};assert.equal(catalog.contains(id,insideBox),true);assert.equal(osm.project(insideBox,'gcj02',id),null);p.displayPosition(insideBox);assert.match(p.data.locationError,/超出图片参考范围/);assert.doesNotMatch(p.data.locationError,/你在校区范围内/);
 p.displayPosition({lat:0,lng:0,accuracy:5});assert.match(p.data.locationError,/远离所选场地/);
});

test('first local position waits for rendered art before focusing once, and late readiness cannot restart stopped GPS',()=>{
 const p=page();let ready=false,focus=0;p.selectComponent=()=>({focusSelf:()=>{focus++;return ready;}});
 p.onLoad({mapId:id,simPosition:'jiulonghu-meiyuan7b'});p.onShow();assert.equal(p.needsInitialFocus,true);const waiting=focus;
 ready=true;p.onArtReady();assert.equal(p.needsInitialFocus,false);assert.equal(focus,waiting+1);
 p.onArtReady();assert.equal(focus,waiting+1,'Readiness must not repeatedly recenter a manually panned map');
 p.stopGps({currentTarget:{}});p.onArtReady();assert.equal(focus,waiting+1);assert.equal(p.data.hasPosition,false);
});
