# 运行变更对照

对照2026-10-18已交付目录；并非本轮开始时的工作区快照，包含之后已完成的全校覆盖/首次定位调整。未从该目录恢复任何文件。

## app.json

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\app.json" "b/D:\\cat-mouse-miniprogram\\app.json"
index 86c9bcc..404651b 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\app.json"
+++ "b/D:\\cat-mouse-miniprogram\\app.json"
@@ -33,6 +33,7 @@
     "pixel-action": "/components/pixel-action/pixel-action"
   },
   "subPackages": [
+    {"name":"campus3d","root":"campus3d","pages":["pages/open/open"]},
     {
       "name": "venue-maps",
       "root": "venue-maps",

```

## pages/map/map.js

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\map\\map.js" "b/D:\\cat-mouse-miniprogram\\pages\\map\\map.js"
index c61a63d..2ace32b 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\map\\map.js"
+++ "b/D:\\cat-mouse-miniprogram\\pages\\map\\map.js"
@@ -1,6 +1,7 @@
 const presentation=require('../../utils/presentation');
 const mapMarkers=require('../../utils/map-markers');
 const venueCatalog=require('../../utils/venue-catalog');
+const modelResources=require('../../utils/model-resources');
 const api = require('../../utils/v2'); const loc = require('../../utils/location-v2'); const {shouldApply}=require('../../utils/snapshot-v2'); const preview=require('../../utils/dev-preview');
 const proof=require('../../utils/capture-proof').create(api,wx);
 const done = m => m && (m.phase==='FINISHED' || m.phase==='CANCELLED');
@@ -9,12 +10,15 @@ Page({
   onArtProjection(e){const n=e.detail.omittedRegions||0,s=e.detail.source;if(this.active&&(n!==this.data.omittedArtRegions||s!==this.data.artReferenceState))this.setData({omittedArtRegions:n,artReferenceState:s});},
   onArtCamera(e){if(this.active)this.setData({artCanZoomIn:e.detail.canZoomIn,artCanZoomOut:e.detail.canZoomOut});},
   zoomMapIn(){this.zoomMap(1);},zoomMapOut(){this.zoomMap(-1);},
-  zoomMap(direction){if(this.data.artMode){const c=this.selectComponent('.venueArt');if(direction>0)c?.zoomIn();else c?.zoomOut();}else this.setData({mapScale:Math.max(3,Math.min(20,(this.data.mapScale||17)+direction))});},
+  zoomMap(direction){if(this.data.artMode||this.data.modelMode){const c=this.selectComponent(this.data.modelMode?'.campusModel':'.venueArt');if(direction>0)c?.zoomIn();else c?.zoomOut();}else this.setData({mapScale:Math.max(3,Math.min(20,(this.data.mapScale||17)+direction))});},
+  onMapReady(){const key=this.data.match?.id+'/'+this.data.venueMapId;if(!this.active||!this.data.hasSelf||this.initialMapFocus===key)return;const c=this.selectComponent(this.data.modelMode?'.campusModel':'.venueArt');if((this.data.artMode||this.data.modelMode)&&c?.focusSelf())this.initialMapFocus=key;},
+  tiltModel(){this.selectComponent('.campusModel')?.tilt();},
+  useArtMap(){this.selectMapLayer('art');},
   onResize(e) { this.setData(presentation.resize(e)); },
-  data:{ roomId:'', match:null, roster:[], events:[], markers:[], circles:[], nearbyCat:false, offline:false, latitude:32.0584,longitude:118.7968, clock:'--:--', roleText:'', phaseText:'', pauseReasonText:'', connection:'正在连接', error:'', drawer:false, owner:false, loading:false, devPreview:false, artMode:true,trayExpanded:true,trayDragging:false,trayDragY:0, drawerTab:'team', drawerClosing:false, codeOpen:false, image:'',seconds:0,codeError:'',hasSelf:false,locationText:'等待定位',mapScale:17,followSelf:true },
+  data:{ roomId:'', match:null, roster:[], events:[], markers:[], circles:[], nearbyCat:false, offline:false, latitude:32.0584,longitude:118.7968, clock:'--:--', roleText:'', phaseText:'', pauseReasonText:'', connection:'正在连接', error:'', drawer:false, owner:false, loading:false, devPreview:false, artMode:true,modelMode:false,layerLoading:false,trayExpanded:true,trayDragging:false,trayDragY:0, drawerTab:'team', drawerClosing:false, codeOpen:false, image:'',seconds:0,codeError:'',hasSelf:false,locationText:'等待定位',mapScale:17,followSelf:true },
   onLoad(o) { this.setData(presentation.metrics()); this.devPreview=preview.accepts(o.devPreview);if(o.devPreview && !this.devPreview){this.previewDenied=true;wx.reLaunch({url:'/pages/index/index'});return;}this.previewCase=o.devPreview;this.previewMapId=this.devPreview&&venueCatalog.get(o.mapId)?o.mapId:venueCatalog.DEFAULT_ID;this.setData({roomId:this.devPreview?'dev-preview-room':o.roomId || wx.getStorageSync('v2RoomId'),devPreview:this.devPreview,artMode:true}); },
   onShow() { if(this.previewDenied)return;this.active=true;this.lifecycle=(this.lifecycle||0)+1;if(this.devPreview){this.lastSnapshot=null;this.apply(preview.mapSnapshot(this.previewCase,'dev-preview-me',this.previewMapId));if(this.previewCase==='offline')this.setOffline('', '重连中');else this.setData({connection:'界面预览'});return;}this.reconnectAttempt=0; this.poll(); this.startPolling(); this.startSocket(); clearInterval(this.clockTimer); this.clockTimer=setInterval(()=>this.updateClock(),1000); },
-  onHide() { this.cleanup(); }, onUnload() { this.cleanup(); },
+  onHide() { this.cleanup(); }, onUnload() { this.unloaded=true;this.cleanup(); },
   cleanup() { this.closeCode();if(this.drawerExitTimer){clearTimeout(this.drawerExitTimer);this.drawerExitTimer=null;}if(this.data.drawer)this.setData({drawer:false,drawerClosing:false});this._sheetStart=null;this._trayGesture=null;if(this.data.trayDragging)this.setData({trayDragging:false,trayDragY:0});this.active=false;this.pollSerial=(this.pollSerial||0)+1;this.fetching=false;this.setOffline('', '正在连接'); clearInterval(this.pollTimer); clearInterval(this.clockTimer); clearInterval(this.heartbeatTimer); clearTimeout(this.reconnectTimer); this.pollTimer=null; this.clockTimer=null; this.heartbeatTimer=null; this.reconnectTimer=null; const socket=this.socket;this.socket=null;this.socketOpen=false;if(socket)socket.close();if(!this.devPreview)loc.stop();this.locationRunning=false; },
   startLocation() { if(!this.data.match || done(this.data.match) || this.data.match.myStatus==='captured' || this.locationRunning)return; this.locationRunning=true; loc.start(this.data.roomId,()=>this.setData({error:'定位中断：请保持页面在前台并检查权限'})); },
   startPolling() { if(this.pollTimer) return; this.pollTimer=setInterval(()=>this.poll(),2000); },
@@ -68,7 +72,7 @@ Page({
     const follow=!this.hasCenter||this.data.followSelf;const latitude=follow&&Number.isFinite(mine?.lat)?mine.lat:(this.hasCenter?this.data.latitude:s.venue.lat),longitude=follow&&Number.isFinite(mine?.lng)?mine.lng:(this.hasCenter?this.data.longitude:s.venue.lng);this.hasCenter=true;
     const pauseReasonText={host:'组织者暂停',emergency:'玩家紧急暂停',lost_position:'定位或连接失联',outside_venue:'超出活动范围',server_restart:'服务重启，等待重新定位',leave:'有玩家退出'}[m.pauseReason] || '等待组织者确认';
     const projected=presentation.project(s);if(!projected.canShowCode)this.closeCode();
-    this.setData({...projected,hasSelf,locationText,match:m,roster:s.roster,events:(s.events||[]).map(e=>({...e,timeText:presentation.eventTime(e.at)})),owner:s.owner,version:s.version,mapCalibration:s.mapCalibration||null,geoData:{points:s.visiblePositions.map(p=>({lat:p.lat,lng:p.lng,label:p.id===myId?'本人':'队友',tone:p.id===myId?'self':'ally'})).concat([{...s.venue,label:'集合点',tone:'venue'}]),regions:(s.intel||[]).map(p=>({lat:p.cellLat,lng:p.cellLng,radiusM:p.radiusM}))},markers,circles,nearbyCat:!!s.nearbyCat,offline:false,latitude,longitude,roleText:m.myRole==='cat'?'猫队':'鼠队',phaseText:m.myStatus==='captured' && !done(m)?'本轮出局':{HIDING:'躲藏阶段',CHASING:'追逐中',PAUSED:'已暂停',FINISHED:'本局结束',CANCELLED:'本局取消'}[m.phase],pauseReasonText,connection:this.socketOpen?'实时连接':'轮询同步',error:''});
+    this.setData({...projected,hasSelf,locationText,match:m,roster:s.roster,events:(s.events||[]).map(e=>({...e,timeText:presentation.eventTime(e.at)})),owner:s.owner,version:s.version,mapCalibration:s.mapCalibration||null,geoData:{points:s.visiblePositions.map(p=>({lat:p.lat,lng:p.lng,label:p.id===myId?'本人':'队友',tone:p.id===myId?'self':'ally'})).concat([{...s.venue,label:'集合点',tone:'venue'}]),regions:(s.intel||[]).map(p=>({lat:p.cellLat,lng:p.cellLng,radiusM:p.radiusM}))},markers,circles,nearbyCat:!!s.nearbyCat,offline:false,latitude,longitude,roleText:m.myRole==='cat'?'猫队':'鼠队',phaseText:m.myStatus==='captured' && !done(m)?'本轮出局':{HIDING:'躲藏阶段',CHASING:'追逐中',PAUSED:'已暂停',FINISHED:'本局结束',CANCELLED:'本局取消'}[m.phase],pauseReasonText,connection:this.socketOpen?'实时连接':'轮询同步',error:''},()=>this.onMapReady());
     this.serverRemaining=m.remainingMs; this.syncedAt=Date.now(); this.updateClock();
     if(this.devPreview)return;
     if(done(m) || m.myStatus==='captured') { loc.stop(); this.locationRunning=false; } else this.startLocation();
@@ -86,9 +90,10 @@ Page({
   trayTouchMove(e){const g=this._trayGesture;if(!g)return;if(e.touches?.length!==1){this.trayTouchCancel();return;}const t=e.touches[0],dy=t.clientY-g.y;if(Math.abs(t.clientX-g.x)>Math.max(24,Math.abs(dy))){this.trayTouchCancel();return;}g.dy=dy;if(g.expanded&&dy>6)this.setData({trayDragging:true,trayDragY:Math.min(220,dy)});},
   trayTouchEnd(){const g=this._trayGesture;this._trayGesture=null;if(!g)return;const moved=Math.abs(g.dy)>8;if(moved)this._traySuppressUntil=Date.now()+350;this.setData({trayExpanded:g.expanded?g.dy<36:g.dy< -28,trayDragging:false,trayDragY:0});},
   trayTouchCancel(){this._traySuppressUntil=Date.now()+350;this._trayGesture=null;this.setData({trayDragging:false,trayDragY:0});},
-  toggleMapMode() { this.setData({artMode:!this.data.artMode,error:''}); },
+  toggleMapMode() {if(this.data.layerLoading)return;if(this.data.venueMapId!=='seu-jiulonghu-v1'){this.selectMapLayer(this.data.artMode?'native':'art');return;}wx.showActionSheet({itemList:['像素地图','实时地图','3D校园 · 体量示意'],success:r=>this.selectMapLayer(['art','native','model'][r.tapIndex])});},
+  async selectMapLayer(layer){if(!['art','native','model'].includes(layer)||this.data.layerLoading)return;const id=this.data.venueMapId;if(layer==='model'&&id!=='seu-jiulonghu-v1')return;if(layer!=='model'){this.initialMapFocus=null;this.setData({artMode:layer==='art',modelMode:false,error:''});return;}this.setData({layerLoading:true,error:''});try{if(layer==='model')await modelResources.ensure();if(this.unloaded||this.data.venueMapId!==id)return;this.initialMapFocus=null;this.setData({artMode:layer==='art',modelMode:layer==='model'});}catch(e){if(this.active)this.setData({error:e.message});}finally{if(!this.unloaded)this.setData({layerLoading:false});}},
   openVenue() { if(this.data.devPreview)wx.navigateTo({url:'/pages/venue/venue?mapId='+encodeURIComponent(this.data.venueMapId||venueCatalog.DEFAULT_ID)}); },
-  locateSelf(){if(!this.data.hasSelf){this.setData({error:this.data.offline?'连接恢复后可重新定位':'尚无可用的本人位置，请检查定位权限并等待同步'});return;}if(this.data.artMode){if(!this.selectComponent('.venueArt')?.focusSelf())this.setData({error:'本人位置超出图片覆盖或地图尚未就绪，请点叠层图标切换实时地图。'});else this.setData({error:''});return;}const p=this.data.geoData.points.find(p=>p.tone==='self');if(p)this.setData({latitude:p.lat,longitude:p.lng,mapScale:17,followSelf:true});},
+  locateSelf(){if(!this.data.hasSelf){this.setData({error:this.data.offline?'连接恢复后可重新定位':'尚无可用的本人位置，请检查定位权限并等待同步'});return;}if(this.data.artMode||this.data.modelMode){if(!this.selectComponent(this.data.modelMode?'.campusModel':'.venueArt')?.focusSelf())this.setData({error:'本人位置超出此图参考或地图尚未就绪，请切换实时地图。'});else this.setData({error:''});return;}const p=this.data.geoData.points.find(p=>p.tone==='self');if(p)this.setData({latitude:p.lat,longitude:p.lng,mapScale:17,followSelf:true});},
   onMapRegion(e){if((e.causedBy||e.detail?.causedBy)==='gesture')this.setData({followSelf:false});if(e.type==='end' && Number.isFinite(e.detail?.scale))this.setData({mapScale:e.detail.scale});},
   ignoreTouch() {},
   showCode() {

```

## pages/map/map.wxml

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\map\\map.wxml" "b/D:\\cat-mouse-miniprogram\\pages\\map\\map.wxml"
index 50d194e..49de2df 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\map\\map.wxml"
+++ "b/D:\\cat-mouse-miniprogram\\pages\\map\\map.wxml"
@@ -9,19 +9,21 @@
 </scroll-view>
 <block wx:else>
  <view class="mapCanvas" aria-label="对局定位地图">
-  <venue-art class="venueArt" style="--venue-dock-display:none" wx:if="{{artMode}}" src="{{parkArt}}" image-id="{{venueMapId}}" registration="{{mapCalibration}}" osm-reference="{{true}}" geo-data="{{geoData}}" bindprojection="onArtProjection" bindcamera="onArtCamera" auto-tour="{{false}}" compact="{{true}}" layout-key="{{viewportWidth+'x'+viewportHeight+'-'+fontScale+'-'+uiState}}" />
+  <campus-model wx:if="{{modelMode}}" class="campusModel" compact="{{true}}" image-id="{{venueMapId}}" geo-data="{{geoData}}" layout-key="{{viewportWidth+'x'+viewportHeight}}" bindready="onMapReady" bindfallback="useArtMap" />
+  <venue-art class="venueArt" style="--venue-dock-display:none" wx:elif="{{artMode}}" bindready="onMapReady" src="{{parkArt}}" image-id="{{venueMapId}}" registration="{{mapCalibration}}" osm-reference="{{true}}" geo-data="{{geoData}}" bindprojection="onArtProjection" bindcamera="onArtCamera" auto-tour="{{false}}" compact="{{true}}" layout-key="{{viewportWidth+'x'+viewportHeight+'-'+fontScale+'-'+uiState}}" />
   <map wx:else id="gameMap" class="gameMap" latitude="{{latitude}}" longitude="{{longitude}}" scale="{{mapScale}}" markers="{{markers}}" circles="{{circles}}" show-location="{{false}}" enable-rotate="{{false}}" enable-overlooking="{{false}}" bindregionchange="onMapRegion" />
  </view>
  <view class="playHud compactHud role-{{match.myRole}}" aria-label="本局状态">
   <image class="hudAvatar" src="{{roleArt}}" mode="aspectFit" aria-hidden="true"/>
   <view class="compactIdentity"><text class="roleName">{{roleText}}</text><text class="phaseName">{{offline?'重连中':uiState==='paused'?'本局暂停':uiState==='captured'?'已出局':phaseText}}</text></view>
   <text class="compactClock">{{clock}}</text><view class="compactProgress"><text class="orangeNumber">{{match.captured}}</text><text> / {{match.target}}</text></view>
-  <text class="registrationState">{{offline?'断线':artMode?(mapCalibration?'待核验':artReferenceState==='none'?'待标定':'OSM参考'):hasSelf?'已定位':'定位中'}}</text>
+  <text class="registrationState">{{offline?'断线':modelMode?'3D参考':artMode?(mapCalibration?'待核验':artReferenceState==='none'?'待标定':'OSM参考'):hasSelf?'已定位':'定位中'}}</text>
  </view>
  <view class="mapTools">
   <button class="edgeButton locateButton" bindtap="locateSelf" aria-label="回到本人位置"><pixel-glyph kind="locate" size="27"/></button>
-  <button class="edgeButton layerButton" bindtap="toggleMapMode" aria-label="{{artMode?'切换实时地图':'切换场地艺术地图'}}"><pixel-glyph kind="layers" size="25"/></button>
-  <view class="zoomControls"><button class="edgeButton zoomInButton" bindtap="zoomMapIn" disabled="{{artMode?artCanZoomIn===false:mapScale>=20}}" aria-label="放大地图"><pixel-glyph kind="plus" size="23"/></button><button class="edgeButton zoomOutButton" bindtap="zoomMapOut" disabled="{{artMode?artCanZoomOut===false:mapScale<=3}}" aria-label="缩小地图"><pixel-glyph kind="minus" size="23"/></button></view>
+  <button class="edgeButton layerButton" bindtap="toggleMapMode" disabled="{{layerLoading}}" aria-label="选择地图图层"><pixel-glyph kind="layers" size="25"/></button>
+  <button wx:if="{{modelMode}}" class="edgeButton" bindtap="tiltModel" aria-label="切换3D俯视与斜视"><pixel-glyph kind="cube" size="25"/></button>
+  <view class="zoomControls"><button class="edgeButton zoomInButton" bindtap="zoomMapIn" disabled="{{modelMode?false:artMode?artCanZoomIn===false:mapScale>=20}}" aria-label="放大地图"><pixel-glyph kind="plus" size="23"/></button><button class="edgeButton zoomOutButton" bindtap="zoomMapOut" disabled="{{modelMode?false:artMode?artCanZoomOut===false:mapScale<=3}}" aria-label="缩小地图"><pixel-glyph kind="minus" size="23"/></button></view>
   <button wx:if="{{!offline && (match.phase==='CHASING' || match.phase==='HIDING')}}" class="edgeButton pauseButton" bindtap="emergency" aria-label="紧急暂停"><pixel-glyph kind="pause" size="25"/></button>
  </view>
  <view class="mapStatusRegion {{trayExpanded?'aboveDrawer':'aboveTab'}}">

```

## pages/map/map.wxss

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\map\\map.wxss" "b/D:\\cat-mouse-miniprogram\\pages\\map\\map.wxss"
index 0dfddc6..5b132ec 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\map\\map.wxss"
+++ "b/D:\\cat-mouse-miniprogram\\pages\\map\\map.wxss"
@@ -1,4 +1,5 @@
 @import "../../utils/pixel-theme.wxss";
+campus-model{display:block;width:100%;height:100%}
 .mapPage{position:relative;box-sizing:border-box;width:var(--vw,100vw);height:var(--vh,100vh);padding-top:var(--nav-height,64px);background:#fcf8ed;color:#050b14;--font-scale:1;overflow:hidden}.playPage{display:block}.terminalScroll{height:calc(var(--vh) - var(--nav-height));padding-bottom:max(20px,var(--safe-bottom),env(safe-area-inset-bottom))}
 .statLabel{display:block;font-size:calc(15px*var(--font-scale));line-height:1.3}.bodyCopy{display:block;font-size:calc(14px*var(--font-scale));line-height:1.5}.statusTitle{display:block;font-size:calc(16px*var(--font-scale));line-height:1.3}.waitingHost{display:block;text-align:center;padding:12px;font-size:14px}
 .pauseHero,.resultHero{display:block;width:100%;height:auto}.pauseHero{margin-top:8px}.statusMessage{text-align:center;padding:14px 20px 8px}.statusMessage .bodyCopy{margin-top:6px}.statusActions{margin:5px 14px 0}.waitingHost{text-align:center;display:block;padding:13px;font-size:calc(15px*var(--font-scale));color:#65635b}

```

## pages/map/map.json

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\map\\map.json" "b/D:\\cat-mouse-miniprogram\\pages\\map\\map.json"
index d87f0ae..e2b7cae 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\map\\map.json"
+++ "b/D:\\cat-mouse-miniprogram\\pages\\map\\map.json"
@@ -1,6 +1,7 @@
 {
   "disableSwipeBack": true,
   "usingComponents": {
+    "campus-model": "/components/campus-model/campus-model",
     "venue-art": "/components/venue-art/venue-art",
     "pixel-glyph": "/components/map-icon/map-icon"
   },

```

## pages/venue/venue.js

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\venue\\venue.js" "b/D:\\cat-mouse-miniprogram\\pages\\venue\\venue.js"
index 795f650..3a7ae77 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\venue\\venue.js"
+++ "b/D:\\cat-mouse-miniprogram\\pages\\venue\\venue.js"
@@ -2,6 +2,7 @@ const presentation = require('../../utils/presentation');
 const catalog=require('../../utils/venue-catalog');
 const foreground=require('../../utils/foreground-location'),osm=require('../../utils/osm-art-registration'),mapMarkers=require('../../utils/map-markers');
 const scenarios=require('../../utils/location-scenarios');
+const modelResources=require('../../utils/model-resources'),modelMap=require('../../utils/model-map');
 
 function layoutKey(metrics) {
   return [metrics.viewportWidth, metrics.viewportHeight, metrics.fontScale, metrics.navHeight, metrics.safeBottom].join(':');
@@ -10,13 +11,13 @@ function layoutKey(metrics) {
 Page({
   data: {
     navHeight:64, viewportWidth:390, viewportHeight:844, fontScale:1, safeBottom:0,
-    mapId:catalog.DEFAULT_ID,venueOptions:catalog.options,venueMapIndex:0,venueName:catalog.get().label,layoutKey:'', venueSource:'/assets/maps/xuanwu-lake-v4.jpg',locationOn:false,locationText:'点定位图标，查看真实本人位置',locationError:'',coordinateText:'',geoData:{points:[],regions:[]},artMode:true,markers:[],latitude:32.0584,longitude:118.7968,hasPosition:false,followSelf:true
+    mapId:catalog.DEFAULT_ID,venueOptions:catalog.options,venueMapIndex:0,venueName:catalog.get().label,layoutKey:'', venueSource:'/assets/maps/xuanwu-lake-v4.jpg',locationOn:false,locationText:'点定位图标，查看真实本人位置',locationError:'',coordinateText:'',geoData:{points:[],regions:[]},artMode:true,modelMode:false,layerLoading:false,markers:[],latitude:32.0584,longitude:118.7968,hasPosition:false,followSelf:true
   },
   onLoad(options={}) { this.selectMap(options.mapId||catalog.DEFAULT_ID);this.refreshLayout();this.simulation=scenarios.get(options.simPosition,this.data.mapId);if(options.simPosition&&!this.simulation)this.setData({locationError:'模拟定位仅限电脑开发工具；真机请点准星获取实际位置'}); },
-  selectMap(id){const image=catalog.get(id);if(!image){this.setData({venueError:'未知场地地图'});return;}if(this.simulation&&id!=='seu-jiulonghu-v1'){this.simulation=null;this.simulationStopped=true;this.stopGps();}this.setData({mapId:image.id,venueSource:image.src,venueName:image.label,venueMapIndex:catalog.options.findIndex(x=>x.id===image.id),venueError:''});if(this.position)this.displayPosition(this.position);},
+  selectMap(id){const image=catalog.get(id);if(!image){this.setData({venueError:'未知场地地图'});return;}if(this.simulation&&id!=='seu-jiulonghu-v1'){this.simulation=null;this.simulationStopped=true;this.stopGps();}this.setData({...(id!=='seu-jiulonghu-v1'&&this.data.modelMode?{modelMode:false,artMode:true}:{}),mapId:image.id,venueSource:image.src,venueName:image.label,venueMapIndex:catalog.options.findIndex(x=>x.id===image.id),venueError:''});if(this.position)this.displayPosition(this.position);},
   selectVenueMap(e){const item=catalog.options[Number(e.detail.value)];if(item)this.selectMap(item.id);},
-  onShow() { this.active=true;this.refreshLayout();if(this.simulation&&!this.simulationStopped)this.startSimulation(); },
-  onHide(){this.stopGps();this.active=false;},onUnload(){this.stopGps();this.active=false;},
+  onShow() { this.active=true;this.refreshLayout();if(this.simulation&&!this.simulationStopped)this.startSimulation();else if(this.resumeLocationAfterResource){this.resumeLocationAfterResource=false;this.locate();} },
+  onHide(){this.stopGps();this.active=false;},onUnload(){this.unloaded=true;this.stopGps();this.active=false;},
   locate(){
     if(this.simulation){this.simulationStopped=false;this.startSimulation();this.focusPosition();return;}
     if(this.data.locationOn&&this.position){this.focusPosition();return;}
@@ -26,15 +27,19 @@ Page({
     this.gps.start();
   },
   displayPosition(p){
-    this.position=p;const projected=osm.project(p,'gcj02',this.data.mapId),first=!this.data.hasPosition,simulated=!!p.simulated;
-    const notice=!osm.available(this.data.mapId)?'此地图的定位参考尚未启用，可切换实时地图':catalog.contains(this.data.mapId,p)?'你在校区范围内，但这一片尚未完成图片配准；可切换实时地图':'当前位置超出所选校区，请核对场地或切换实时地图';
-    this.setData({hasPosition:true,simulated,...(first||this.data.followSelf?{latitude:p.lat,longitude:p.lng}:{}),locationText:simulated?'模拟定位 · '+p.label:'本人 · 精度约'+Math.round(p.accuracy)+'米',coordinateText:(simulated?'模拟 ':'')+'GCJ-02 '+p.lat.toFixed(6)+', '+p.lng.toFixed(6),locationError:!this.data.artMode?'':projected?'OSM参考位置，实地精度待核验':notice,geoData:{points:[{...p,tone:'self',label:simulated?'模拟本人':'本人'}],regions:[]},markers:[{id:1,latitude:p.lat,longitude:p.lng,...mapMarkers.sprite('self')} ]});
-    if(first&&projected)wx.nextTick(()=>{if(this.active&&this.position===p)this.selectComponent('.venueArt')?.focusSelf();});
+    this.position=p;const projected=this.data.modelMode?modelMap.project(p,this.data.mapId):osm.project(p,'gcj02',this.data.mapId),first=!this.data.hasPosition,simulated=!!p.simulated;
+    const notice=!osm.available(this.data.mapId)?'此地图的定位参考尚未启用，可切换实时地图':catalog.contains(this.data.mapId,p)?'当前位置超出图片参考范围；可切换实时地图':'当前位置远离所选场地，请核对场地或切换实时地图';
+    this.setData({hasPosition:true,simulated,...(first||this.data.followSelf?{latitude:p.lat,longitude:p.lng}:{}),locationText:simulated?'模拟定位 · '+p.label:'本人 · 精度约'+Math.round(p.accuracy)+'米',coordinateText:(simulated?'模拟 ':'')+'GCJ-02 '+p.lat.toFixed(6)+', '+p.lng.toFixed(6),locationError:this.data.modelMode?(projected?'3D近似参考，实地精度待核验':'位置超出模型参考，请切实时地图'):!this.data.artMode?'':projected?'OSM参考位置，实地精度待核验':notice,geoData:{points:[{...p,tone:'self',label:simulated?'模拟本人':'本人'}],regions:[]},markers:[{id:1,latitude:p.lat,longitude:p.lng,...mapMarkers.sprite('self')} ]});
+    if(first&&projected){this.needsInitialFocus=true;wx.nextTick(()=>{if(this.position===p)this.onArtReady();});}
   },
-  focusPosition(){if(this.data.artMode&&!this.selectComponent('.venueArt')?.focusSelf())this.setData({locationError:'本人位置超出图片覆盖或地图未就绪，请切换实时地图'});else if(!this.data.artMode&&this.position)this.setData({latitude:this.position.lat,longitude:this.position.lng,followSelf:true});},
+  onArtReady(){if(this.active&&this.position&&this.needsInitialFocus&&this.data.artMode&&this.selectComponent('.venueArt')?.focusSelf())this.needsInitialFocus=false;},
+  focusPosition(){if((this.data.artMode||this.data.modelMode)&&!this.selectComponent(this.data.modelMode?'.campusModel':'.venueArt')?.focusSelf())this.setData({locationError:'本人位置超出此图参考或地图未就绪，请切换实时地图'});else if(!this.data.artMode&&!this.data.modelMode&&this.position)this.setData({latitude:this.position.lat,longitude:this.position.lng,followSelf:true});},
   startSimulation(){if(this.gps)this.gps.stop();this.setData({locationOn:true});this.displayPosition(this.simulation);},
-  stopGps(e){if(e?.currentTarget)this.simulationStopped=true;if(this.gps)this.gps.stop();this.position=null;this.setData({locationOn:false,hasPosition:false,simulated:false,locationText:'点定位图标，查看真实本人位置',locationError:'',coordinateText:'',geoData:{points:[],regions:[]},markers:[]});},
-  toggleLayer(){this.setData({artMode:!this.data.artMode});if(this.position)this.displayPosition(this.position);},
+  stopGps(e){if(e?.currentTarget)this.simulationStopped=true;if(this.gps)this.gps.stop();this.position=null;this.needsInitialFocus=false;this.setData({locationOn:false,hasPosition:false,simulated:false,locationText:'点定位图标，查看真实本人位置',locationError:'',coordinateText:'',geoData:{points:[],regions:[]},markers:[]});},
+  toggleLayer(){if(this.data.layerLoading)return;if(this.data.mapId!=='seu-jiulonghu-v1'){this.selectMapLayer(this.data.artMode?'native':'art');return;}wx.showActionSheet({itemList:['像素地图','实时地图','3D校园 · 体量示意'],success:r=>this.selectMapLayer(['art','native','model'][r.tapIndex])});},
+  async selectMapLayer(layer){if(!['art','native','model'].includes(layer)||this.data.layerLoading)return;const id=this.data.mapId;if(layer==='model'&&!modelMap.available(id))return;this.setData({layerLoading:true});try{if(layer==='model'){this.resumeLocationAfterResource=this.data.locationOn&&!this.simulation;await modelResources.ensure();}if(this.unloaded||id!==this.data.mapId)return;this.setData({artMode:layer==='art',modelMode:layer==='model'});if(this.position)this.displayPosition(this.position);}catch(e){if(this.active)this.setData({locationError:e.message});}finally{this.resumeLocationAfterResource=false;if(!this.unloaded)this.setData({layerLoading:false});}},
+  useArtMap(){this.selectMapLayer('art');},
+  modelZoomIn(){this.selectComponent('.campusModel')?.zoomIn();},modelZoomOut(){this.selectComponent('.campusModel')?.zoomOut();},modelReset(){this.selectComponent('.campusModel')?.reset();},tiltModel(){this.selectComponent('.campusModel')?.tilt();},
   onNativeRegion(e){if((e.causedBy||e.detail?.causedBy)==='gesture')this.setData({followSelf:false});},
   onResize(event) { this.refreshLayout(event); },
   refreshLayout(event) {

```

## pages/venue/venue.wxml

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\venue\\venue.wxml" "b/D:\\cat-mouse-miniprogram\\pages\\venue\\venue.wxml"
index 5185dc9..c2140e7 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\venue\\venue.wxml"
+++ "b/D:\\cat-mouse-miniprogram\\pages\\venue\\venue.wxml"
@@ -6,8 +6,9 @@
   </view>
   <view class="gpsInfo" role="status"><text>{{locationText}}</text><text wx:if="{{coordinateText}}" class="gpsCoordinates">{{coordinateText}}</text><text wx:if="{{locationError}}" class="gpsMessage">{{locationError}}</text></view>
   <view class="venueFrame">
-    <venue-art wx:if="{{artMode}}" class="venueArt" image-id="{{mapId}}" src="{{venueSource}}" geo-data="{{geoData}}" osm-reference="{{locationOn}}" auto-tour="{{!locationOn}}" layout-key="{{layoutKey+'-'+locationOn+'-'+hasPosition+'-'+locationError}}" />
+    <campus-model wx:if="{{modelMode}}" class="campusModel" image-id="{{mapId}}" geo-data="{{geoData}}" layout-key="{{layoutKey}}" bindfallback="useArtMap" />
+    <venue-art wx:elif="{{artMode}}" class="venueArt" image-id="{{mapId}}" src="{{venueSource}}" geo-data="{{geoData}}" osm-reference="{{locationOn}}" auto-tour="{{!locationOn}}" layout-key="{{layoutKey+'-'+locationOn+'-'+hasPosition+'-'+locationError}}" bind:ready="onArtReady" />
     <map wx:else class="guideNativeMap" latitude="{{latitude}}" longitude="{{longitude}}" scale="17" markers="{{markers}}" show-location="{{false}}" enable-rotate="{{false}}" bindregionchange="onNativeRegion" />
-    <view class="guideTools"><button class="guideIcon {{locationOn?'active':''}}" bindtap="locate" aria-label="开启定位或回到本人"><map-icon kind="locate" size="26" /></button><button class="guideIcon" bindtap="toggleLayer" aria-label="切换艺术图与实时地图"><map-icon kind="layers" size="26" /></button><button wx:if="{{locationOn}}" class="guideIcon" bindtap="stopGps" aria-label="停止本人定位"><map-icon kind="close" size="22" /></button></view>
+    <view class="guideTools"><button class="guideIcon {{locationOn?'active':''}}" bindtap="locate" aria-label="开启定位或回到本人"><map-icon kind="locate" size="26" /></button><button class="guideIcon" bindtap="toggleLayer" disabled="{{layerLoading}}" aria-label="选择地图图层"><map-icon kind="layers" size="26" /></button><button wx:if="{{modelMode}}" class="guideIcon modelZoomIn" bindtap="modelZoomIn" aria-label="放大3D地图"><map-icon kind="plus" size="23" /></button><button wx:if="{{modelMode}}" class="guideIcon modelZoomOut" bindtap="modelZoomOut" aria-label="缩小3D地图"><map-icon kind="minus" size="23" /></button><button wx:if="{{modelMode}}" class="guideIcon" bindtap="tiltModel" aria-label="切换3D俯视与斜视">3D</button><button wx:if="{{modelMode}}" class="guideIcon" bindtap="modelReset" aria-label="查看整个3D校园">全</button><button wx:if="{{locationOn}}" class="guideIcon" bindtap="stopGps" aria-label="停止本人定位"><map-icon kind="close" size="22" /></button></view>
   </view>
 </view>

```

## pages/venue/venue.wxss

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\venue\\venue.wxss" "b/D:\\cat-mouse-miniprogram\\pages\\venue\\venue.wxss"
index bb4e9dd..4ac876e 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\venue\\venue.wxss"
+++ "b/D:\\cat-mouse-miniprogram\\pages\\venue\\venue.wxss"
@@ -13,3 +13,5 @@
 .gpsInfo{flex:none;min-height:22px;padding:0 16px 6px;color:#3e5949;font-size:11px;line-height:1.5;overflow-wrap:anywhere}.gpsInfo text{display:block}.gpsCoordinates{font-family:monospace;font-size:11px}.gpsMessage{color:#776037}.guideNativeMap{width:100%;height:100%}.guideTools{position:absolute;right:8px;top:8px;display:flex;flex-direction:column;gap:6px;z-index:5}.guideIcon{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:44px!important;min-width:44px;height:44px;margin:0;padding:0;border:2px solid #24342d;border-radius:3px;background:#fcf8ed}.guideIcon.active{background:#ddecbe}.guideIcon::after{border:0}
 
 .venuePickerValue{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:4px 8px;border:1px solid #829575;background:#fcf8ed;box-sizing:border-box;color:#24342d}.venueReference{display:block;margin-top:5px;font-size:11px;line-height:1.45;color:#61705a}
+
+.venueFrame campus-model{display:block;width:100%;height:100%}

```

## pages/venue/venue.json

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\venue\\venue.json" "b/D:\\cat-mouse-miniprogram\\pages\\venue\\venue.json"
index 3a65238..670fa13 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\pages\\venue\\venue.json"
+++ "b/D:\\cat-mouse-miniprogram\\pages\\venue\\venue.json"
@@ -2,6 +2,7 @@
   "navigationStyle": "custom",
   "disableScroll": true,
   "usingComponents": {
+    "campus-model": "/components/campus-model/campus-model",
     "nav-bar": "/components/nav-bar/nav-bar",
     "venue-art": "/components/venue-art/venue-art",
     "map-icon": "/components/map-icon/map-icon"

```

## components/map-icon/map-icon.js

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\components\\map-icon\\map-icon.js" "b/D:\\cat-mouse-miniprogram\\components\\map-icon\\map-icon.js"
index 99f27e0..bb37f44 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\components\\map-icon\\map-icon.js"
+++ "b/D:\\cat-mouse-miniprogram\\components\\map-icon\\map-icon.js"
@@ -1,5 +1,6 @@
 // Small native pixel glyphs, drawn as horizontal runs; no bitmap scaling or font symbols.
 const grids={
+ cube:['000001100000','000110011000','011000000110','110001100011','101101101101','100111111001','100001100001','100001100001','110001100011','011001100110','000111111000','000001100000'],
  plus:['000001100000','000001100000','000001100000','000001100000','000001100000','111111111111','111111111111','000001100000','000001100000','000001100000','000001100000','000001100000'],
  minus:['000000000000','000000000000','000000000000','000000000000','000000000000','111111111111','111111111111','000000000000','000000000000','000000000000','000000000000','000000000000'],
  code:['111110011111','100010010001','101010010101','100010010001','111110011111','000000000000','111110011000','100010011011','101010000110','100010011001','111110010110','000000001001'],

```

## project.config.json

```diff
diff --git "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\project.config.json" "b/D:\\cat-mouse-miniprogram\\project.config.json"
index e780007..a0ff9c5 100644
--- "a/D:\\cat-mouse-miniprogram\\reports\\2026-10-18\\jiulonghu-location-fix-v1\\MODIFIED_FILE\\project.config.json"
+++ "b/D:\\cat-mouse-miniprogram\\project.config.json"
@@ -2,6 +2,8 @@
   "description": "猫鼠游戏小程序 - 线下实景追逐游戏",
   "packOptions": {
     "ignore": [
+      {"type":"folder","value":".local-tools"},
+      {"type":"folder","value":"output"},
       {
         "type": "folder",
         "value": "cat-mouse-server"

```
