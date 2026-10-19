const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
const model=require('../../utils/model-map'),camera=require('../../utils/model-camera'),{wgs84togcj02}=require('../../utils/vendor/coordtransform');
const id='seu-jiulonghu-v1',self={lat:31.882368,lng:118.828049,tone:'self',label:'本人'};
test('runtime is exported from the supplied filtered Blender: all 331 roots, no planned blocks, finite indexed geometry',()=>{
 const meta=JSON.parse(read('campus3d/assets/campus-meta.bin')),data=fs.readFileSync(path.join(root,'campus3d/assets/campus.bin'));
 assert.equal(meta.buildingComponents,331);assert.deepEqual(meta.statusCounts,{existing:302,under_construction:29});assert.equal(meta.runtimeTrees,720);assert.equal(meta.triangles,27992);assert.equal(meta.parts.length,2);
 assert.equal(crypto.createHash('sha256').update(data).digest('hex'),meta.meshSha256);
 const blend=fs.readFileSync(path.join(root,'design/models/jiulonghu-blender-v1/filtered/东南大学九龙湖_已建与在建_去规划/东南大学九龙湖_已建与在建_去规划.blend'));
 assert.equal(crypto.createHash('sha256').update(blend).digest('hex'),meta.sourceBlendSha256);
 for(const p of meta.parts){assert.ok(p.vertexCount<=65535);assert.equal(p.indexCount%3,0);assert.ok(p.indexOffset+p.indexCount*2<=data.length);for(let i=0;i<p.indexCount;i++)assert.ok(data.readUInt16LE(p.indexOffset+2*i)<p.vertexCount);for(let i=0;i<p.vertexCount;i++)for(let k=0;k<3;k++){const v=data.readInt16LE(p.vertexOffset+i*16+k*2)*.1;assert.ok(v>=meta.bounds[0][k]-.1&&v<=meta.bounds[1][k]+.1);}}
 assert.equal(meta.fieldVerified,false);assert.equal(meta.georeferencedInSource,false);
});
test('model reference is independent of pixel art and explicitly approximate; held-out check and reported coordinate map locally',()=>{
 const ref=require('../../utils/model-reference');assert.equal(ref.anchors.filter(a=>a.fit).length,6);assert.equal(ref.anchors.filter(a=>!a.fit).length,1);assert.equal(ref.fieldVerified,false);assert.ok(ref.anchors.find(a=>!a.fit).errorPx<10);
 for(const a of ref.anchors){const [lng,lat]=wgs84togcj02(...a.wgs84),p=model.project({lng,lat},id);assert.ok(p);const px=[p.x/1.9+520,p.z/1.9+470];assert.ok(Math.hypot(...px.map((x,i)=>x-a.predicted[i]))<.001);}
 const p=model.project(self,id);assert.ok(p.x>500&&p.x<550&&p.z>450&&p.z<480);assert.equal(p.fieldVerified,false);
 assert.equal(model.project(self,'seu-sipailou-v1'),null);assert.equal(model.project({lat:0,lng:0},id),null);assert.equal(model.project({lat:NaN,lng:118},id),null);
 assert.doesNotMatch(read('utils/model-map.js')+read('scripts/build-model-reference.cjs'),/osm\.project|pixel-art.*require|campus-art-models/);
});
test('3D uses only explicitly supplied authorized pins; enemy intelligence stays an uncertainty ring, outside regions are never clipped to a point',()=>{
 const hidden={lat:31.89,lng:118.825,tone:'enemy',label:'秘密'};
 const data={points:[self,hidden,{...self,tone:'ally'},{...self,tone:'venue'}],regions:[{...self,radiusM:45}],roster:[hidden]};
 const before=plain(data),out=model.overlay(data,id);assert.deepEqual(data,before);assert.equal(out.points.length,3);assert.ok(!JSON.stringify(out).includes('秘密'));assert.equal(out.regions.length,1);assert.equal(out.regions[0].length,65);assert.ok(out.regions[0].every(p=>Math.hypot(p.x-out.points[0].x,p.z-out.points[0].z)>30));assert.equal(out.omittedRegions,0);
 assert.equal(model.overlay({regions:[{lat:0,lng:0,radiusM:45},{...self,radiusM:-1}]},id).omittedRegions,2);assert.deepEqual(model.overlay({},id).points,[]);
 assert.deepEqual(model.overlay(data,'seu-sipailou-v1').points,[]);
});
test('camera keeps source proportions through portrait/landscape, pan, pinch, rotation, tilt and bounded margins',()=>{
 for(const [w,h] of [[390,700],[320,400],[800,400]]){let c=camera.initial(w,h),m=camera.matrix(c,w,h);const center=camera.project({x:c.x,y:0,z:c.z},m,w,h);assert.ok(Math.abs(center.x-w/2)<.001&&Math.abs(center.y-h/2)<.001);
 const origin=camera.project({x:0,z:0},m,w,h),x=camera.project({x:100,z:0},m,w,h);assert.ok(Math.abs((x.x-origin.x)/100-h/c.size)<1e-6);
 c=camera.move(c,100,-50,w,h);assert.ok(c.x<0&&c.z>0);const moved=camera.project({x:0,z:0},camera.matrix(c,w,h),w,h);assert.ok(Math.abs(moved.x-origin.x-100)<.001&&Math.abs(moved.y-origin.y+50)<.001,'ground follows the finger in both axes');const a=camera.gesture([{x:100,y:100},{x:200,y:100}]),b=camera.gesture([{x:150,y:50},{x:150,y:250}]),d=camera.update(c,a,b,w,h);assert.ok(Math.abs(d.size-c.size/2)<1e-8);assert.ok(Math.abs(d.yaw-Math.PI/2)<1e-8);
 const edge=camera.move(c,1e6,1e6,w,h);assert.ok(edge.x>=-1200&&edge.x<=1200&&edge.z>=-1050&&edge.z<=1050);assert.ok(edge.x<-760||edge.z>614,'model edges have extra panning space');
 assert.equal(camera.update(c,a,null,w,h),c);assert.equal(camera.gesture([]),null);
 }
});
function component(){let def;const jobs=new Map(),writes=[],events=[];let seq=0;vm.runInNewContext(read('components/campus-model/campus-model.js'),{Component:d=>def=d,require:n=>require(path.resolve(root,'components/campus-model',n)),wx:{},Promise,ArrayBuffer,Uint8Array,Uint16Array,Float32Array,Math,Number,Error,JSON,Date,Object});const c={...def.methods,data:{...plain(def.data),imageId:id,geoData:{points:[self],regions:[]}},setData:p=>{writes.push(plain(p));Object.assign(c.data,p);},triggerEvent:(...a)=>events.push(a)};def.lifetimes.attached.call(c);c._canvas={requestAnimationFrame:fn=>{jobs.set(++seq,fn);return seq;},cancelAnimationFrame:key=>jobs.delete(key)};c._ready=true;c.draw=()=>{c.draws=(c.draws||0)+1;};return {c,def,jobs,writes,events};}
test('model coalesces redraws, cancels pending frames on hide/detach and clears stopped position on show',()=>{
 const {c,def,jobs}=component();c.schedule();c.schedule();assert.equal(jobs.size,1);const callback=[...jobs.values()][0];def.pageLifetimes.hide.call(c);assert.equal(jobs.size,0);assert.equal(c._world.points.length,0);callback();assert.equal(c.draws,undefined);c.data.geoData={points:[],regions:[]};c.measure=()=>{};def.pageLifetimes.show.call(c);assert.equal(c._world.points.length,0);assert.equal(jobs.size,1);def.lifetimes.detached.call(c);assert.equal(jobs.size,0);c.schedule();assert.equal(jobs.size,0);callback();assert.equal(c.draws,undefined);
});
test('late resource read after component detach never allocates GPU buffers or restores UI',async()=>{
 let def;const replies=[];let allocations=0;const gl={createBuffer:()=>allocations++};const node={getContext:()=>({clearRect(){}})};
 vm.runInNewContext(read('components/campus-model/campus-model.js'),{Component:d=>def=d,require:n=>require(path.resolve(root,'components/campus-model',n)),wx:{createOffscreenCanvas:()=>({getContext:()=>gl}),getFileSystemManager:()=>({readFile:o=>replies.push(o)})},Promise,ArrayBuffer,Uint8Array,Uint16Array,Float32Array,Math,Number,Error,JSON,Date,Object});
 const writes=[],c={...def.methods,data:{imageId:id,geoData:{}},setData:p=>writes.push(p),createSelectorQuery:()=>({select:()=>({fields:()=>({exec:fn=>fn([{node,width:320,height:600}])})})})};def.lifetimes.attached.call(c);c.initialize();assert.equal(replies.length,2);def.lifetimes.detached.call(c);const count=writes.length;replies[0].success({data:read('campus3d/assets/campus-meta.bin')});replies[1].success({data:new ArrayBuffer(16)});await Promise.resolve();await Promise.resolve();assert.equal(writes.length,count);assert.equal(allocations,0);
});
test('failed WebGL context releases GPU resources and offers explicit fallback',()=>{
 const {c,jobs,events}=component();const freed=[];c._gl={deleteBuffer:b=>freed.push(b),deleteTexture:t=>freed.push(t),deleteProgram:p=>freed.push(p)};c._gpu=['vertex','index'];c._texture='texture';c._program='shader';c.schedule();c.fail(Error('context lost'));assert.equal(jobs.size,0);assert.deepEqual(freed,['vertex','index','texture','shader']);assert.equal(c.data.status,'error');assert.deepEqual(plain(c.data.pins),[]);assert.equal(events[0][0],'failure');c.fallback();assert.equal(events[1][0],'fallback');
});
test('3D resource requests merge and retry without mini-game loading APIs',async()=>{
 const calls=[],module={exports:{}};vm.runInNewContext(read('utils/model-resources.js'),{module,wx:{navigateTo:o=>calls.push(o)},Promise,Error});const r=module.exports,a=r.ensure(),b=r.ensure();assert.equal(a,b);assert.equal(calls.length,1);calls[0].fail();await assert.rejects(a,/加载失败/);const c=r.ensure();assert.equal(calls.length,2);r.markLoaded();await c;assert.equal(r.ready(),true);await r.ensure();assert.equal(calls.length,2);assert.doesNotMatch(read('utils/model-resources.js'),/loadSubpackage/);
});

test('structured WeChat resource errors retain their message and clear the failed renderer',()=>{
 const {c,jobs}=component();c.schedule();c.fail({errMsg:'readFile:fail resource unavailable'});
 assert.equal(c.data.status,'error');assert.equal(c.data.error,'readFile:fail resource unavailable');assert.equal(jobs.size,0);assert.equal(c._ready,false);assert.deepEqual(plain(c.data.pins),[]);
});
test('3D is an optional Jiulonghu-only layer, one mounted renderer and one authorized input per page',()=>{
 const app=JSON.parse(read('app.json'));assert.ok(app.subPackages.some(x=>x.root==='campus3d'));
 for(const page of ['map','venue']){const w=read('pages/'+page+'/'+page+'.wxml');assert.match(w,/<campus-model wx:if="{{modelMode}}"/);assert.match(w,/<venue-art[^>]*wx:elif="{{artMode}}"/);assert.match(w,/<map wx:else/);assert.match(w,/geo-data="{{geoData}}"/);}
 const code=read('components/campus-model/campus-model.js');assert.doesNotMatch(code,/getLocation|connectSocket|setInterval|setTimeout|StorageSync/);assert.match(read('components/campus-model/campus-model.wxml'),/type="2d"/);assert.match(code,/createOffscreenCanvas/);
});

function mapPage(){let p,resolve,loads=0;const sideEffects=[];vm.runInNewContext(read('pages/map/map.js'),{Page:d=>p=d,require:n=>n.includes('model-resources')?{ensure:()=>{loads++;return new Promise(yes=>resolve=yes);}}:n.includes('/v2')?{config:{}}:n.includes('location-v2')?{start:()=>sideEffects.push('start'),stop:()=>sideEffects.push('stop')}:require(path.resolve(root,'pages/map',n)),wx:{},Date,Math,Number,Error,Promise,JSON,encodeURIComponent});p.setData=x=>Object.assign(p.data,x);p.data.venueMapId=id;p.data.geoData={points:[self],regions:[]};p.active=true;return {p,sideEffects,get loads(){return loads;},complete:()=>resolve()};}
test('first 3D package return may precede onShow without losing selection or creating a second position stream',async()=>{
 const f=mapPage(),p=f.p,points=p.data.geoData,socket=p.socket={session:'same-session'},match=p.data.match={id:'same-match'};
 const a=p.selectMapLayer('model');p.active=false;assert.equal(p.data.layerLoading,true);assert.equal(f.loads,1);await p.selectMapLayer('model');assert.equal(f.loads,1);f.complete();await a;assert.equal(p.data.modelMode,true);assert.equal(p.data.artMode,false);assert.equal(p.data.layerLoading,false);assert.equal(p.data.geoData,points);assert.equal(p.data.match,match);assert.equal(p.socket,socket);assert.deepEqual(f.sideEffects,[]);
});
test('late model loading cannot change an unloaded page or a different campus',async()=>{
 for(const kind of ['unload','campus']){const f=mapPage(),p=f.p,a=p.selectMapLayer('model');if(kind==='unload'){p.cleanup=()=>{};p.onUnload();}else p.data.venueMapId='seu-sipailou-v1';f.complete();await a;assert.equal(p.data.modelMode,false);assert.equal(p.data.artMode,true);}
 const f=mapPage();f.p.data.venueMapId='xuanwu-v4';await f.p.selectMapLayer('model');assert.equal(f.loads,0);assert.equal(f.p.data.modelMode,false);
});
