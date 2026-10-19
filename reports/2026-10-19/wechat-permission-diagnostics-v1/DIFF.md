# 本轮源码对照

仅对照本轮保存的9个文件；不是全仓快照。项目配置另新增一项显式资源包含规则。

## pages/index/index.js

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\pages\\index\\index.js" "b/D:\\cat-mouse-miniprogram\\pages\\index\\index.js"
index 1d5f7fb..b73ea86 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\pages\\index\\index.js"
+++ "b/D:\\cat-mouse-miniprogram\\pages\\index\\index.js"
@@ -3,7 +3,7 @@ const api = require('../../utils/v2');
 const preview = require('../../utils/dev-preview');
 Page({
   onResize(e) { this.setData(presentation.resize(e)); },
-  data: { nickname:'', code:'', loading:false, error:'', resumeKind:'', devAvailable:false, devPreview:false },
+  data: { fontScale:1, nickname:'', code:'', loading:false, error:'', resumeKind:'', devAvailable:false, devPreview:false },
   onLoad(options={}) { this.setData(presentation.metrics()); this.devPreview=preview.accepts(options.devPreview);this.setData({devPreview:this.devPreview,devAvailable:preview.enabled()}); },
   async onShow() {
     if(this.devPreview){this.setData({nickname:'',code:'',resumeKind:''});return;}

```

## pages/room/room.js

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\pages\\room\\room.js" "b/D:\\cat-mouse-miniprogram\\pages\\room\\room.js"
index 2efd173..7a2cba4 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\pages\\room\\room.js"
+++ "b/D:\\cat-mouse-miniprogram\\pages\\room\\room.js"
@@ -4,7 +4,7 @@ const catalog=require('../../utils/venue-catalog'),resources=require('../../util
 const api = require('../../utils/v2'); const location = require('../../utils/location-v2'); const preview = require('../../utils/dev-preview');
 Page({
   onResize(e) { this.setData(presentation.resize(e)); },
-  data:{ mapId:catalog.DEFAULT_ID,venueOptions:catalog.options,venueMapIndex:0,venueName:catalog.get().label,venueSource:catalog.get().src,venueResource:'ready',roomId:'', code:'', roster:[], rules:null, owner:false, total:8, totals:[6,7,8,9,10,11,12], venue:null, catsCount:2, miceCount:6, teamError:'', editingField:'', targetCount:4, ready:false, readyCount:0, canStart:false, startHint:'等待伙伴加入', error:'', loading:false, match:null, devPreview:false },
+  data:{ fontScale:1, mapId:catalog.DEFAULT_ID,venueOptions:catalog.options,venueMapIndex:0,venueName:catalog.get().label,venueSource:catalog.get().src,venueResource:'ready',roomId:'', code:'', roster:[], rules:null, owner:false, total:8, totals:[6,7,8,9,10,11,12], venue:null, catsCount:2, miceCount:6, teamError:'', editingField:'', targetCount:4, ready:false, readyCount:0, canStart:false, startHint:'等待伙伴加入', error:'', loading:false, match:null, devPreview:false },
   onLoad(options) { this.setData({...presentation.metrics(),catsCount:2,targetCount:4}); this.devPreview=preview.accepts(options.devPreview);if(options.devPreview && !this.devPreview){this.previewDenied=true;wx.reLaunch({url:'/pages/index/index'});return;}this.creating=options.mode==='create' || options.devPreview==='create' && this.devPreview;this.setData({roomId:options.roomId || '',devPreview:this.devPreview}); if (this.creating && api.config.localTestIdentities && !this.devPreview) this.setData({totals:[2,6,7,8,9,10,11,12]}); },
   async onShow() { if(this.previewDenied)return;this.active=true;this.lifecycle=(this.lifecycle||0)+1;this.loadVenueArt();if(this.devPreview){this.applyRoom(this.previewRoom || preview.roomData(this.creating?'create':'ready'));return;}this.updateTitle();const run=this.lifecycle;if(this.data.roomId) { try { await api.session();if(!this.active || run!==this.lifecycle)return; if(/^[0-9A-F]{10}$/.test(this.data.roomId)) { const r=await api.join(this.data.roomId,wx.getStorageSync('nickname') || '玩家');if(!this.active || run!==this.lifecycle)return;this.setData({roomId:r.roomId}); wx.setStorageSync('v2RoomId',r.roomId); } this.retryAttempt=0;this.begin(); } catch(e) { if(this.active && run===this.lifecycle){this.setData({error:'连接房间失败：'+e.message});this.scheduleRetry(e);} } } },
   updateTitle(){wx.setNavigationBarTitle?.({title:this.data.roomId?'房间准备':'创建活动'});},

```

## pages/map/map.js

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\pages\\map\\map.js" "b/D:\\cat-mouse-miniprogram\\pages\\map\\map.js"
index 2ace32b..08c35f2 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\pages\\map\\map.js"
+++ "b/D:\\cat-mouse-miniprogram\\pages\\map\\map.js"
@@ -15,7 +15,7 @@ Page({
   tiltModel(){this.selectComponent('.campusModel')?.tilt();},
   useArtMap(){this.selectMapLayer('art');},
   onResize(e) { this.setData(presentation.resize(e)); },
-  data:{ roomId:'', match:null, roster:[], events:[], markers:[], circles:[], nearbyCat:false, offline:false, latitude:32.0584,longitude:118.7968, clock:'--:--', roleText:'', phaseText:'', pauseReasonText:'', connection:'正在连接', error:'', drawer:false, owner:false, loading:false, devPreview:false, artMode:true,modelMode:false,layerLoading:false,trayExpanded:true,trayDragging:false,trayDragY:0, drawerTab:'team', drawerClosing:false, codeOpen:false, image:'',seconds:0,codeError:'',hasSelf:false,locationText:'等待定位',mapScale:17,followSelf:true },
+  data:{ fontScale:1, roomId:'', match:null, roster:[], events:[], markers:[], circles:[], nearbyCat:false, offline:false, latitude:32.0584,longitude:118.7968, clock:'--:--', roleText:'', phaseText:'', pauseReasonText:'', connection:'正在连接', error:'', drawer:false, owner:false, loading:false, devPreview:false, artMode:true,modelMode:false,layerLoading:false,trayExpanded:true,trayDragging:false,trayDragY:0, drawerTab:'team', drawerClosing:false, codeOpen:false, image:'',seconds:0,codeError:'',hasSelf:false,locationText:'等待定位',mapScale:17,followSelf:true },
   onLoad(o) { this.setData(presentation.metrics()); this.devPreview=preview.accepts(o.devPreview);if(o.devPreview && !this.devPreview){this.previewDenied=true;wx.reLaunch({url:'/pages/index/index'});return;}this.previewCase=o.devPreview;this.previewMapId=this.devPreview&&venueCatalog.get(o.mapId)?o.mapId:venueCatalog.DEFAULT_ID;this.setData({roomId:this.devPreview?'dev-preview-room':o.roomId || wx.getStorageSync('v2RoomId'),devPreview:this.devPreview,artMode:true}); },
   onShow() { if(this.previewDenied)return;this.active=true;this.lifecycle=(this.lifecycle||0)+1;if(this.devPreview){this.lastSnapshot=null;this.apply(preview.mapSnapshot(this.previewCase,'dev-preview-me',this.previewMapId));if(this.previewCase==='offline')this.setOffline('', '重连中');else this.setData({connection:'界面预览'});return;}this.reconnectAttempt=0; this.poll(); this.startPolling(); this.startSocket(); clearInterval(this.clockTimer); this.clockTimer=setInterval(()=>this.updateClock(),1000); },
   onHide() { this.cleanup(); }, onUnload() { this.unloaded=true;this.cleanup(); },

```

## pages/qrcode/qrcode.js

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\pages\\qrcode\\qrcode.js" "b/D:\\cat-mouse-miniprogram\\pages\\qrcode\\qrcode.js"
index 577e179..72a74fe 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\pages\\qrcode\\qrcode.js"
+++ "b/D:\\cat-mouse-miniprogram\\pages\\qrcode\\qrcode.js"
@@ -3,7 +3,7 @@ const api=require('../../utils/v2'); const loc=require('../../utils/location-v2'
 const proof=require('../../utils/capture-proof').create(api,wx);
 Page({
   onResize(e) { this.setData(presentation.resize(e)); },
-  data:{roomId:'',image:'',seconds:0,error:'',devPreview:false},
+  data:{fontScale:1,roomId:'',image:'',seconds:0,error:'',devPreview:false},
   onLoad(o){this.setData(presentation.metrics());this.devPreview=preview.accepts(o.devPreview);if(o.devPreview && !this.devPreview){this.previewDenied=true;wx.reLaunch({url:'/pages/index/index'});return;}this.setData({roomId:this.devPreview?'dev-preview-room':o.roomId,devPreview:this.devPreview});},
   onShow(){if(this.previewDenied)return;this.active=true;this.lifecycle=(this.lifecycle||0)+1;if(this.devPreview){this.setData({image:'',seconds:15,error:''});return;}this.expiresAt=0;this.nextRetryAt=0;this.setData({image:'',seconds:0,error:''});loc.start(this.data.roomId,()=>{if(this.active)this.setData({error:'定位中断，请返回地图检查权限'});});this.refresh();clearInterval(this.timer);clearInterval(this.statusTimer);this.timer=setInterval(()=>{if(!this.active)return;if(!this.expiresAt){if(!this.refreshing && Date.now()>=this.nextRetryAt)this.refresh();return;}const seconds=Math.max(0,Math.ceil((this.expiresAt-Date.now())/1000));this.setData({seconds});if(seconds<=2 && !this.refreshing)this.refresh();},1000);this.statusTimer=setInterval(()=>this.checkStatus(),3000);},
   onHide(){this.stop();},onUnload(){this.stop();},

```

## components/campus-model/campus-model.js

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\components\\campus-model\\campus-model.js" "b/D:\\cat-mouse-miniprogram\\components\\campus-model\\campus-model.js"
index ca01aa5..217de10 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\components\\campus-model\\campus-model.js"
+++ "b/D:\\cat-mouse-miniprogram\\components\\campus-model\\campus-model.js"
@@ -15,7 +15,8 @@ Component({
    if(!this._alive||run!==this._serial)return;
    try{const item=r[0];if(!item?.node||!item.width||!item.height)throw Error('画布尚未就绪');this._canvas=item.node;this._width=item.width;this._height=item.height;
     this._output=item.node.getContext('2d');this._surface=wx.createOffscreenCanvas({type:'webgl',width:Math.round(item.width*1.5),height:Math.round(item.height*1.5)});const gl=this._gl=this._surface.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:true});if(!gl)throw Error('此设备暂不支持3D画布');
-    const [text,blob]=await Promise.all([read('campus.json','utf8'),read('campus.bin')]);if(!this._alive||run!==this._serial)return;
+    // JSON is compiled as mini-program configuration, not a readable asset.
+    const [text,blob]=await Promise.all([read('campus-meta.bin','utf8'),read('campus.bin')]);if(!this._alive||run!==this._serial)return;
     const meta=JSON.parse(text);if(meta.schema!=='campus-mesh-v1'||meta.stride!==16||Object.prototype.toString.call(blob)!=='[object ArrayBuffer]'||blob.byteLength<16)throw Error('模型资源不完整');
     this._program=gl.createProgram();const vs=shader(gl,gl.VERTEX_SHADER,VERTEX),fs=shader(gl,gl.FRAGMENT_SHADER,FRAGMENT);gl.attachShader(this._program,vs);gl.attachShader(this._program,fs);gl.linkProgram(this._program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(this._program,gl.LINK_STATUS))throw Error('3D材质未能编译');
     this._parts=meta.parts.map(p=>{if(p.vertexCount>65535||p.indexCount%3||p.vertexOffset<0||p.indexOffset<0||p.vertexOffset+p.vertexCount*16>blob.byteLength||p.indexOffset+p.indexCount*2>blob.byteLength)throw Error('模型资源边界错误');const vertex=gl.createBuffer(),index=gl.createBuffer();this._gpu.push(vertex,index);gl.bindBuffer(gl.ARRAY_BUFFER,vertex);gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(blob,p.vertexOffset,p.vertexCount*16),gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,index);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(blob,p.indexOffset,p.indexCount),gl.STATIC_DRAW);return {vertex,index,count:p.indexCount};});
@@ -46,7 +47,7 @@ Component({
   reset(){if(this._ready){this._camera=camera.initial(this._width,this._height);this.schedule();}},
   tilt(){if(this._ready){this._camera={...this._camera,pitch:this._camera.pitch>1.4?.88:Math.PI/2-.001};this.schedule();}},
   focusSelf(){const p=this._world?.points.find(p=>p.tone==='self');if(!this._ready||!p)return false;this._camera=camera.constrain({...this._camera,x:p.x,z:p.z,size:1000});this.schedule();return true;},
-  fail(e){this._ready=false;this.cancelFrame();this.dispose();this.setData({status:'error',error:e?.message||'请切换图层后重试',pins:[],previewSrc:''});this.triggerEvent('failure');},onCanvasError(){if(this._alive)this.fail(Error('画布初始化失败'));},fallback(){this.triggerEvent('fallback');},
+  fail(e){this._ready=false;this.cancelFrame();this.dispose();this.setData({status:'error',error:e?.message||e?.errMsg||'请切换图层后重试',pins:[],previewSrc:''});this.triggerEvent('failure');},onCanvasError(){if(this._alive)this.fail(Error('画布初始化失败'));},fallback(){this.triggerEvent('fallback');},
   dispose(){this._output?.clearRect(0,0,this._canvas?.width||0,this._canvas?.height||0);const gl=this._gl;if(gl){for(const b of this._gpu||[])gl.deleteBuffer(b);if(this._texture)gl.deleteTexture(this._texture);if(this._program)gl.deleteProgram(this._program);}this._gpu=[];this._texture=null;this._program=null;this._gl=null;if(this._image){this._image.onload=null;this._image.onerror=null;}this._image=null;this._parts=[];this._ready=false;if(this._surface){this._surface.width=1;this._surface.height=1;}this._output=null;this._surface=null;}
  }
 });

```

## campus3d/assets/campus.json

```diff

```

## scripts/export-jiulonghu-runtime.py

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\scripts\\export-jiulonghu-runtime.py" "b/D:\\cat-mouse-miniprogram\\scripts\\export-jiulonghu-runtime.py"
index 51feb25..88fb49e 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\scripts\\export-jiulonghu-runtime.py"
+++ "b/D:\\cat-mouse-miniprogram\\scripts\\export-jiulonghu-runtime.py"
@@ -54,6 +54,6 @@ metadata=dict(schema='campus-mesh-v1',stride=16,positionScale=.1,parts=parts,bou
  sourceAxes='Blender +Y north, +Z up',runtimeAxes='+Y up, -Z north',
  fieldVerified=False,georeferencedInSource=False,
  lod='All 331 original building base meshes and roofs, no bevel modifiers; 720 evenly sampled decorative tree instances maximum; hidden reference/studio excluded.')
-(OUT/'campus.json').write_text(json.dumps(metadata,separators=(',',':')),encoding='utf8')
+(OUT/'campus-meta.bin').write_text(json.dumps(metadata,separators=(',',':')),encoding='utf8')
 (ROOT/'design/models/jiulonghu-blender-v1/runtime/export-audit.json').write_text(json.dumps(dict(metadata,objectTriangles=counts),ensure_ascii=False,indent=2),encoding='utf8')
 print('EXPORTED',len(blob),'bytes;',metadata['triangles'],'triangles;',len(chunks),'draws')

```

## scripts/finalize-model-evidence.cjs

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\scripts\\finalize-model-evidence.cjs" "b/D:\\cat-mouse-miniprogram\\scripts\\finalize-model-evidence.cjs"
index 1930302..ab2ef86 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\scripts\\finalize-model-evidence.cjs"
+++ "b/D:\\cat-mouse-miniprogram\\scripts\\finalize-model-evidence.cjs"
@@ -9,7 +9,7 @@ fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});const rows=[];
 for(const [folder,names]of sets)for(const name of names){const file=name+'.png',data=fs.readFileSync(path.join(folder,file));assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');fs.writeFileSync(path.join(out,'screenshots',file),data);const meta=path.join(folder,name+'.json');let state=null;if(fs.existsSync(meta)){state=JSON.parse(fs.readFileSync(meta));fs.writeFileSync(path.join(out,'screenshots',name+'.json'),JSON.stringify(state,null,2));}rows.push({file,caption:captions[name],sha256:sha(data),imageWidth:data.readUInt32BE(16),imageHeight:data.readUInt32BE(20),reviewedPixels:true,claim:'Official WeChat simulator capture; developer data only. No phone GPS, native phone touch or field accuracy claims.',state});}
 fs.writeFileSync(path.join(out,'screenshot-verification.json'),JSON.stringify(rows,null,2));
 const original=JSON.parse(fs.readFileSync(path.join(model,'import-manifest.json')));for(const item of original)assert.equal(sha(fs.readFileSync(path.join(model,item.file))),item.sha256,item.file);
-const inputResult={files:original.length,allImportedSourceHashesUnchanged:true,sourceBlendSha256:JSON.parse(fs.readFileSync(path.join(root,'campus3d/assets/campus.json'))).sourceBlendSha256};fs.writeFileSync(path.join(out,'source-verification.json'),JSON.stringify(inputResult,null,2));
+const inputResult={files:original.length,allImportedSourceHashesUnchanged:true,sourceBlendSha256:JSON.parse(fs.readFileSync(path.join(root,'campus3d/assets/campus-meta.bin'))).sourceBlendSha256};fs.writeFileSync(path.join(out,'source-verification.json'),JSON.stringify(inputResult,null,2));
 const template=JSON.parse(fs.readFileSync(path.join(root,'reports/2026-10-16/campus-integration-v1/compile-args.json'))),base='D:/Program Files (x86)/微信web开发者工具/resources/app.asar.unpacked/node_modules/wcc-exec/';
 for(const [type,exe]of [['wxml','wcc.exe'],['wxss','wcsc.exe']]){const files=[...template[type],'components/campus-model/campus-model.'+type,'campus3d/pages/open/open.'+type],r=cp.spawnSync(base+exe,files,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});fs.writeFileSync(path.join(out,'compile-'+type+'.json'),JSON.stringify({status:r.status,files,compiler:base+exe,outputBytes:Buffer.byteLength(r.stdout||''),stderr:r.stderr,error:r.error?.message},null,2));assert.equal(r.status,0,r.stderr||r.error?.message);}
 const js=['pages/map/map.js','pages/venue/venue.js','components/campus-model/campus-model.js','components/map-icon/map-icon.js','utils/model-map.js','utils/model-reference.js','utils/model-camera.js','utils/model-resources.js','campus3d/pages/open/open.js','scripts/model-runtime-review.cjs','scripts/export-jiulonghu-runtime.py','scripts/build-model-reference.cjs','scripts/finalize-model-evidence.cjs'];const checks=[];

```

## cat-mouse-server/v2/campus-model.test.js

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\cat-mouse-server\\v2\\campus-model.test.js" "b/D:\\cat-mouse-miniprogram\\cat-mouse-server\\v2\\campus-model.test.js"
index 6fd7f09..2588e17 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-19\\wechat-permission-diagnostics-v1\\before\\cat-mouse-server\\v2\\campus-model.test.js"
+++ "b/D:\\cat-mouse-miniprogram\\cat-mouse-server\\v2\\campus-model.test.js"
@@ -3,7 +3,7 @@ const root=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(roo
 const model=require('../../utils/model-map'),camera=require('../../utils/model-camera'),{wgs84togcj02}=require('../../utils/vendor/coordtransform');
 const id='seu-jiulonghu-v1',self={lat:31.882368,lng:118.828049,tone:'self',label:'本人'};
 test('runtime is exported from the supplied filtered Blender: all 331 roots, no planned blocks, finite indexed geometry',()=>{
- const meta=JSON.parse(read('campus3d/assets/campus.json')),data=fs.readFileSync(path.join(root,'campus3d/assets/campus.bin'));
+ const meta=JSON.parse(read('campus3d/assets/campus-meta.bin')),data=fs.readFileSync(path.join(root,'campus3d/assets/campus.bin'));
  assert.equal(meta.buildingComponents,331);assert.deepEqual(meta.statusCounts,{existing:302,under_construction:29});assert.equal(meta.runtimeTrees,720);assert.equal(meta.triangles,27992);assert.equal(meta.parts.length,2);
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'),meta.meshSha256);
  const blend=fs.readFileSync(path.join(root,'design/models/jiulonghu-blender-v1/filtered/东南大学九龙湖_已建与在建_去规划/东南大学九龙湖_已建与在建_去规划.blend'));
@@ -40,7 +40,7 @@ test('model coalesces redraws, cancels pending frames on hide/detach and clears
 test('late resource read after component detach never allocates GPU buffers or restores UI',async()=>{
  let def;const replies=[];let allocations=0;const gl={createBuffer:()=>allocations++};const node={getContext:()=>({clearRect(){}})};
  vm.runInNewContext(read('components/campus-model/campus-model.js'),{Component:d=>def=d,require:n=>require(path.resolve(root,'components/campus-model',n)),wx:{createOffscreenCanvas:()=>({getContext:()=>gl}),getFileSystemManager:()=>({readFile:o=>replies.push(o)})},Promise,ArrayBuffer,Uint8Array,Uint16Array,Float32Array,Math,Number,Error,JSON,Date,Object});
- const writes=[],c={...def.methods,data:{imageId:id,geoData:{}},setData:p=>writes.push(p),createSelectorQuery:()=>({select:()=>({fields:()=>({exec:fn=>fn([{node,width:320,height:600}])})})})};def.lifetimes.attached.call(c);c.initialize();assert.equal(replies.length,2);def.lifetimes.detached.call(c);const count=writes.length;replies[0].success({data:read('campus3d/assets/campus.json')});replies[1].success({data:new ArrayBuffer(16)});await Promise.resolve();await Promise.resolve();assert.equal(writes.length,count);assert.equal(allocations,0);
+ const writes=[],c={...def.methods,data:{imageId:id,geoData:{}},setData:p=>writes.push(p),createSelectorQuery:()=>({select:()=>({fields:()=>({exec:fn=>fn([{node,width:320,height:600}])})})})};def.lifetimes.attached.call(c);c.initialize();assert.equal(replies.length,2);def.lifetimes.detached.call(c);const count=writes.length;replies[0].success({data:read('campus3d/assets/campus-meta.bin')});replies[1].success({data:new ArrayBuffer(16)});await Promise.resolve();await Promise.resolve();assert.equal(writes.length,count);assert.equal(allocations,0);
 });
 test('failed WebGL context releases GPU resources and offers explicit fallback',()=>{
  const {c,jobs,events}=component();const freed=[];c._gl={deleteBuffer:b=>freed.push(b),deleteTexture:t=>freed.push(t),deleteProgram:p=>freed.push(p)};c._gpu=['vertex','index'];c._texture='texture';c._program='shader';c.schedule();c.fail(Error('context lost'));assert.equal(jobs.size,0);assert.deepEqual(freed,['vertex','index','texture','shader']);assert.equal(c.data.status,'error');assert.deepEqual(plain(c.data.pins),[]);assert.equal(events[0][0],'failure');c.fallback();assert.equal(events[1][0],'fallback');
@@ -48,6 +48,11 @@ test('failed WebGL context releases GPU resources and offers explicit fallback',
 test('3D resource requests merge and retry without mini-game loading APIs',async()=>{
  const calls=[],module={exports:{}};vm.runInNewContext(read('utils/model-resources.js'),{module,wx:{navigateTo:o=>calls.push(o)},Promise,Error});const r=module.exports,a=r.ensure(),b=r.ensure();assert.equal(a,b);assert.equal(calls.length,1);calls[0].fail();await assert.rejects(a,/加载失败/);const c=r.ensure();assert.equal(calls.length,2);r.markLoaded();await c;assert.equal(r.ready(),true);await r.ensure();assert.equal(calls.length,2);assert.doesNotMatch(read('utils/model-resources.js'),/loadSubpackage/);
 });
+
+test('structured WeChat resource errors retain their message and clear the failed renderer',()=>{
+ const {c,jobs}=component();c.schedule();c.fail({errMsg:'readFile:fail resource unavailable'});
+ assert.equal(c.data.status,'error');assert.equal(c.data.error,'readFile:fail resource unavailable');assert.equal(jobs.size,0);assert.equal(c._ready,false);assert.deepEqual(plain(c.data.pins),[]);
+});
 test('3D is an optional Jiulonghu-only layer, one mounted renderer and one authorized input per page',()=>{
  const app=JSON.parse(read('app.json'));assert.ok(app.subPackages.some(x=>x.root==='campus3d'));
  for(const page of ['map','venue']){const w=read('pages/'+page+'/'+page+'.wxml');assert.match(w,/<campus-model wx:if="{{modelMode}}"/);assert.match(w,/<venue-art[^>]*wx:elif="{{artMode}}"/);assert.match(w,/<map wx:else/);assert.match(w,/geo-data="{{geoData}}"/);}

```
