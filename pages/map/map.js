const presentation=require('../../utils/presentation');
const liveRoom=require('../../utils/room-live').create(require('../../utils/v2'),wx,{setInterval:(f,t)=>setInterval(f,t),clearInterval:id=>clearInterval(id),setTimeout:(f,t)=>setTimeout(f,t),clearTimeout:id=>clearTimeout(id)});
const mapMarkers=require('../../utils/map-markers');
const venueCatalog=require('../../utils/venue-catalog');
const venueGeometry=require('../../utils/venue-boundary');
const modelResources=require('../../utils/model-resources');
const api = require('../../utils/v2'); const loc = require('../../utils/location-v2'); const {shouldApply}=require('../../utils/snapshot-v2'); const preview=require('../../utils/dev-preview');
const proof=require('../../utils/capture-proof').create(api,wx);
const captureFlow=require('../../utils/capture-flow').create(api,loc,wx);
const done = m => m && (m.phase==='FINISHED' || m.phase==='CANCELLED');
const pointStyle=(p,myId)=>p.id===myId?{tone:'self',label:'本人'}:p.relation==='enemy'?{tone:'enemy',label:'猫 · 队伍视野'}:{tone:'ally',label:'队友'};
const tapHaptic=(type='light')=>{try{if(typeof wx!=='undefined'&&'vibrateShort' in wx)wx.vibrateShort({type});}catch{}};
function meetingGuide(a,b){if(!a||!b||!Number.isFinite(a.lat)||!Number.isFinite(a.lng)||!Number.isFinite(b.lat)||!Number.isFinite(b.lng))return '';const toRad=d=>d*Math.PI/180,dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng),la1=toRad(a.lat),la2=toRad(b.lat);const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;const dist=6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));const distText=dist<1000?Math.round(dist)+'m':(dist/1000).toFixed(1)+'km';if(dist<10)return '集合点 '+distText;const y=Math.sin(dLng)*Math.cos(la2),x=Math.cos(la1)*Math.sin(la2)-Math.sin(la1)*Math.cos(la2)*Math.cos(dLng);const deg=(Math.atan2(y,x)*180/Math.PI+360)%360;const dirs=['↑','↗','→','↘','↓','↙','←','↖'];return '集合点 '+distText+' '+dirs[Math.round(deg/45)%8];}
Page({
  remeasureVenue() { if(this.active)this.selectComponent('.venueArt')?.remeasure(); },
  onArtProjection(e){const n=e.detail.omittedRegions||0,s=e.detail.source,b=!!e.detail.omittedBoundary;if(this.active&&(n!==this.data.omittedArtRegions||s!==this.data.artReferenceState||b!==this.data.omittedArtBoundary))this.setData({omittedArtRegions:n,omittedArtBoundary:b,artReferenceState:s});},
  onArtCamera(e){if(this.active)this.setData({artCanZoomIn:e.detail.canZoomIn,artCanZoomOut:e.detail.canZoomOut});},
  zoomMapIn(){this.zoomMap(1);},zoomMapOut(){this.zoomMap(-1);},
  zoomMap(direction){if(this.data.artMode||this.data.modelMode){const c=this.selectComponent(this.data.modelMode?'.campusModel':'.venueArt');if(direction>0)c?.zoomIn();else c?.zoomOut();}else this.setData({mapScale:Math.max(3,Math.min(20,(this.data.mapScale||17)+direction))});},
  onMapReady(){const key=this.data.match?.id+'/'+this.data.venueMapId;if(!this.active||!this.data.hasSelf||this.initialMapFocus===key)return;const c=this.selectComponent(this.data.modelMode?'.campusModel':'.venueArt');if((this.data.artMode||this.data.modelMode)&&c?.focusSelf())this.initialMapFocus=key;},
  tiltModel(){this.selectComponent('.campusModel')?.tilt();},
  useArtMap(){this.selectMapLayer('art');},
  onResize(e) { this.setData(presentation.resize(e)); },
  data:{ trackingText:'',trackingNotice:'',backgroundReady:false,captureRetry:false,mapCompatible:true,fontScale:1, roomId:'', match:null, roster:[], events:[], unreadEvents:0, vibeOn:true, meetingGuideText:'', markers:[], circles:[],venuePolygons:[],omittedArtBoundary:false, nearbyCat:false, offline:false, latitude:32.0584,longitude:118.7968, clock:'--:--', roleText:'', phaseText:'', pauseReasonText:'', connection:'正在连接', error:'', drawer:false, owner:false, loading:false, devPreview:false, artMode:true,modelMode:false,layerLoading:false,trayExpanded:true,trayDragging:false,trayDragY:0, drawerTab:'team', drawerClosing:false, codeOpen:false, image:'',seconds:0,codeError:'',hasSelf:false,locationText:'等待定位',mapScale:17,followSelf:true, layerSheetOpen:false, layerOptions:[], confirmModal:{visible:false,action:'',title:'',content:'',confirmText:'确认',confirmTone:'amber'} },
  onLoad(o) { this.setData(presentation.metrics()); this.devPreview=preview.accepts(o.devPreview);if(o.devPreview && !this.devPreview){this.previewDenied=true;wx.reLaunch({url:'/pages/index/index'});return;}this.previewCase=o.devPreview;this.previewMapId=this.devPreview&&venueCatalog.get(o.mapId)?o.mapId:venueCatalog.DEFAULT_ID;let vibeOn=true;try{if(typeof wx!=='undefined'&&'getStorageSync' in wx&&wx.getStorageSync('vibeOn')===false)vibeOn=false;}catch{}this.setData({roomId:this.devPreview?'dev-preview-room':o.roomId || wx.getStorageSync('v2RoomId'),devPreview:this.devPreview,artMode:true,vibeOn}); },
  toggleVibe(){const next=!this.data.vibeOn;this.setData({vibeOn:next});if(!this.devPreview){try{if(typeof wx!=='undefined'&&'setStorageSync' in wx)wx.setStorageSync('vibeOn',next);}catch{}}if(next)tapHaptic('medium');},
  onShow() { if(this.previewDenied)return;this.active=true;this.backgroundTracking=false;this.lifecycle=(this.lifecycle||0)+1;if(this.devPreview){this.lastSnapshot=null;this.apply(preview.mapSnapshot(this.previewCase,'dev-preview-me',this.previewMapId));if(this.previewCase==='offline')this.setOffline('', '重连中');else this.setData({connection:'界面预览'});return;}if(loc.status){const state=loc.status();this.locationRunning=state.running&&state.roomId===this.data.roomId&&state.matchId===this.data.match?.id;this.onTrackingStatus(this.locationRunning?state:{running:false,mode:'off',backgroundReady:false,notice:state.notice||''});}this.reconnectAttempt=0; this.poll(); if(!this.socketOpen)this.startPolling(); this.startSocket(); clearInterval(this.clockTimer); this.clockTimer=setInterval(()=>this.updateClock(),1000); },
  onHide() { this.cleanup(!this.devPreview&&!!loc.canBackground?.(this.data.roomId,this.data.match?.id)); }, onUnload() { this.unloaded=true;this.cleanup(); },
  cleanup(keepTracking=false) { this.closeCode();if(this.data.layerSheetOpen||this.data.confirmModal?.visible)this.setData({layerSheetOpen:false,'confirmModal.visible':false});if(this.drawerExitTimer){clearTimeout(this.drawerExitTimer);this.drawerExitTimer=null;}if(this.data.drawer)this.setData({drawer:false,drawerClosing:false});this._sheetStart=null;this._trayGesture=null;if(this.data.trayDragging)this.setData({trayDragging:false,trayDragY:0});this.active=false;this.backgroundTracking=keepTracking;this.pollSerial=(this.pollSerial||0)+1;this.fetching=false;this.setOffline('', '正在连接');clearInterval(this.pollTimer);clearInterval(this.clockTimer);this.pollTimer=null;this.clockTimer=null;if(!keepTracking){clearInterval(this.heartbeatTimer);clearTimeout(this.reconnectTimer);this.heartbeatTimer=null;this.reconnectTimer=null;const socket=this.socket;this.socket=null;this.socketOpen=false;if(socket)socket.close();if(!this.devPreview)loc.stop();this.locationRunning=false;} },
  onTrackingStatus(s){this.locationRunning=s.running;if(this.active){this.setData({trackingText:s.mode==='background'?'后台定位已开启':s.mode==='requesting'?'正在申请后台定位':s.running?'仅前台定位':'定位已停止',trackingNotice:s.notice||'',backgroundReady:!!s.backgroundReady});if(s.quality)this.localQuality=s.quality;this.updateLocationSignal();}if(!s.running&&this.backgroundTracking)this.cleanup();},
  updateLocationSignal(){if(!this.active)return;const m=this.data.match,signal=presentation.locationSignal(this.localQuality||this.snapshotQuality,{offline:this.data.offline,stopped:!!m&&(done(m)||['captured','left'].includes(m.myStatus))});if(JSON.stringify(signal)!==JSON.stringify(this.data.locationSignal))this.setData({locationSignal:signal});},
  onLocationError(e){if(!this.active)return;this.localQuality={...this.localQuality,issue:e.code||e.errMsg||e.message||'LOCATION_UNAVAILABLE'};this.updateLocationSignal();},
  startLocation() { if(!this.data.match || done(this.data.match) || !['active','joining'].includes(this.data.match.myStatus) || this.locationRunning)return; this.locationRunning=true;const started=loc.start(this.data.roomId,e=>this.onLocationError(e),{matchId:this.data.match.id,match:this.data.match,background:true,onStatus:s=>this.onTrackingStatus(s),isLiveConnected:()=>this.socketOpen});if(started===false)this.locationRunning=false; },
  retryBackgroundLocation(){if(this.devPreview||!this.active)return;loc.stop();this.locationRunning=false;this.startLocation();},
  openLocationSettings(){if(this.devPreview)return;wx.openSetting({success:r=>{if(this.active&&r.authSetting?.['scope.userLocationBackground'])this.retryBackgroundLocation();}});},
  startPolling() { if(this.pollTimer) return; this.pollTimer=setInterval(()=>this.poll(),2000); },
  startSocket:liveRoom.startSocket,socketDropped:liveRoom.socketDropped,scheduleReconnect:liveRoom.scheduleReconnect,
  receiveSnapshot(s){if(this.active)this.apply(s);else if(this.backgroundTracking){loc.syncMatch?.(s);if(!loc.canBackground?.(this.data.roomId,this.data.match?.id))this.cleanup();}},
  async poll() { if(!this.active || this.fetching) return;const run=this.pollSerial=(this.pollSerial||0)+1; this.fetching=true; try { const s=await api.room(this.data.roomId);if(this.active&&run===this.pollSerial)this.apply(s); } catch(e) {if(run!==this.pollSerial)return; if(this.active && (e.code==='UNAUTHENTICATED' || e.code==='NOT_MEMBER')){this.cleanup();this.setOffline(e.message,'身份失效');}else if(this.active && !this.socketOpen){if(this.locationRunning){loc.stop();this.locationRunning=false;}if(!this.data.offline)this.setOffline('状态暂不可用：'+e.message,'重连中');} } finally {if(run===this.pollSerial)this.fetching=false; } },
  setOffline(error,connection='重连中'){this.captureFeedback=null;this.closeCode();this.setData({...presentation.project({match:this.data.match,roster:this.data.roster,owner:this.data.owner,venue:{mapId:this.data.venueMapId||venueCatalog.DEFAULT_ID}},true),offline:true,connection,error,clock:'--:--',markers:[],circles:[],venuePolygons:[],geoData:{points:[],regions:[]},nearbyCat:false,sharedCatCount:0,hasSelf:false,meetingGuideText:'',locationText:'等待重连 · 位置已隐藏',locationSignal:presentation.locationSignal(null,{offline:true})});},
  apply(s) {
    if(!this.active || s?.viewerId&&s.viewerId!==wx.getStorageSync('v2UserId') || !shouldApply(this.lastSnapshot,s)) return;
    if(!this.devPreview)loc.syncMatch?.(s);
    if(!s.match){this.closeCode();if(this.locationRunning&&!this.devPreview)loc.stop();this.locationRunning=false;this.setData({markers:[],circles:[],venuePolygons:[],hasSelf:false,meetingGuideText:'',mapCalibration:null,geoData:{points:[],regions:[]},match:null,error:'活动尚未开始，请返回准备房间',canScan:false,canShowCode:false,canResume:false,canReplay:false});return;}
    if(this.data.match?.id && this.data.match.id!==s.match.id)this.closeCode();
    if(this.data.match?.id!==s.match.id){this.localQuality=null;this.snapshotQuality=null;this.seenEventSeq=null;this.lastVibeAlert='';}
    this.lastSnapshot={viewerId:s.viewerId,version:s.version,serverTime:s.serverTime,match:{id:s.match.id}};
    const m=s.match,myId=this.devPreview?'dev-preview-me':wx.getStorageSync('v2UserId'),mine=s.visiblePositions.find(p=>p.id===myId);
    if(this.qualityViewer!==myId){this.qualityViewer=myId;this.localQuality=null;this.snapshotQuality=null;}
    if(mine&&Number.isFinite(mine.receivedAt)&&Number.isFinite(s.serverTime))this.snapshotQuality={accuracy:mine.accuracy,at:Date.now()-Math.max(0,s.serverTime-mine.receivedAt),issue:'',accepted:true};
    const markers=s.visiblePositions.map((p,i)=>({id:i+1,latitude:p.lat,longitude:p.lng,title:s.roster.find(x=>x.id===p.id)?.nickname || '成员',...mapMarkers.sprite(pointStyle(p,myId).tone),callout:{content:pointStyle(p,myId).label,display:'BYCLICK',padding:4,borderRadius:2,bgColor:'#FCF5E3',color:'#3B2213'}}));
    markers.push({id:1000,latitude:s.venue.lat,longitude:s.venue.lng,...mapMarkers.sprite('venue'),callout:{content:'集合点',display:'BYCLICK',padding:4,bgColor:'#FCF5E3',color:'#5D3B1E'}});
    const circles=(s.intel||[]).map(p=>({latitude:p.cellLat,longitude:p.cellLng,radius:p.radiusM,color:'#E27B2088',fillColor:'#E27B2022',strokeWidth:2}));
    if(!s.venue.boundary&&Number.isFinite(s.venue.radiusM))circles.unshift({latitude:s.venue.lat,longitude:s.venue.lng,radius:s.venue.radiusM,color:'#4E8B3CAA',fillColor:'#87C46610',strokeWidth:2});
    const venuePolygons=s.venue.boundary?[{points:s.venue.boundary.map(p=>({latitude:p.lat,longitude:p.lng})),strokeWidth:3,strokeColor:'#4E8B3C',fillColor:'#87C46622'}]:[];
    const hasSelf=!!mine && m.myStatus==='active' && !done(m);
    const locationText=hasSelf?'本人 · '+(Number.isFinite(mine.accuracy)?'精度约'+Math.round(mine.accuracy)+'米':'已定位'):m.myStatus==='joining'?'补入'+(m.myRole==='cat'?'猫队':'鼠队')+' · 正在定位':m.myStatus==='left'?'本场退出 · 仅公开状态':m.myStatus==='captured'?'已核验 · 仅公开位置':m.phase==='PAUSED'?'已暂停 · 等待重新定位':'等待本人定位';
    const follow=!this.hasCenter||this.data.followSelf;const latitude=follow&&Number.isFinite(mine?.lat)?mine.lat:(this.hasCenter?this.data.latitude:s.venue.lat),longitude=follow&&Number.isFinite(mine?.lng)?mine.lng:(this.hasCenter?this.data.longitude:s.venue.lng);this.hasCenter=true;
    const pauseReasonText={host:'组织者暂停',emergency:'成员紧急暂停',lost_position:'定位或连接失联',outside_venue:'超出活动范围',server_restart:'服务重启，等待重新定位',leave:'有成员退出'}[m.pauseReason] || '等待组织者确认';
    const image=venueCatalog.get(s.venue.mapId||venueCatalog.DEFAULT_ID),mapCompatible=!!image&&(!s.mapRevision||s.mapRevision===image.sha256);if(!mapCompatible||image?.nativeOnly)this.setData({artMode:false,modelMode:false});
    const projected=presentation.project(s);if(!projected.canScan||this.captureFeedback?.matchId!==m.id)this.captureFeedback=null;if(!projected.canShowCode)this.closeCode();
    const events=(s.events||[]).map(e=>({...e,timeText:presentation.eventTime(e.at)}));
    const maxSeq=events.reduce((acc,e)=>Math.max(acc,Number(e.seq)||0),0);
    let unreadEvents=0;
    if(this.seenEventSeq==null||this.data.drawer){this.seenEventSeq=maxSeq;}else{unreadEvents=events.filter(e=>(Number(e.seq)||0)>this.seenEventSeq).length;}
    const meetingGuideText=(!done(m)&&mine&&s.venue)?meetingGuide(mine,s.venue):'';
    this.setData({...projected,mouseTeamVision:!!m.settings?.mouseTeamVision,sharedCatCount:s.visiblePositions.filter(p=>p.relation==='enemy').length,mapCompatible,hasSelf,locationText,meetingGuideText,match:m,roster:s.roster,events,unreadEvents,owner:s.owner,version:s.version,mapCalibration:s.mapCalibration||null,geoData:{boundary:venueGeometry.outline(s.venue),points:s.visiblePositions.map(p=>({lat:p.lat,lng:p.lng,...pointStyle(p,myId)})).concat([{...s.venue,label:'集合点',tone:'venue'}]),regions:(s.intel||[]).map(p=>({lat:p.cellLat,lng:p.cellLng,radiusM:p.radiusM}))},markers,circles,venuePolygons,nearbyCat:!!s.nearbyCat,offline:false,latitude,longitude,roleText:m.myRole==='cat'?'猫队':'鼠队',phaseText:m.myStatus==='joining'?'正在入场':m.myStatus==='left'?'本场退出':m.myStatus==='captured' && !done(m)?'已核验':{HIDING:'准备阶段',CHASING:'进行中',PAUSED:'已暂停',FINISHED:'已结束',CANCELLED:'已取消'}[m.phase],pauseReasonText,connection:this.socketOpen?'实时连接':'轮询同步',error:this.captureFeedback?.message||''},()=>this.onMapReady());
    if(!this.devPreview&&this.data.vibeOn){const alertKey=(s.nearbyCat?'near:':'')+m.captured+':'+m.phase;if(this.lastVibeAlert&&this.lastVibeAlert!==alertKey&&((!this.lastVibeNear&&s.nearbyCat)||m.captured>(this.lastVibeCaptured||0)||(m.phase==='PAUSED'&&this.lastVibePhase!=='PAUSED'))){tapHaptic('heavy');}this.lastVibeAlert=alertKey;this.lastVibeNear=!!s.nearbyCat;this.lastVibeCaptured=m.captured;this.lastVibePhase=m.phase;}
    this.serverRemaining=m.remainingMs; this.syncedAt=Date.now(); this.updateClock();
    if(this.devPreview)return;
    if(loc.status){const state=loc.status();if(state.roomId!==this.data.roomId||state.matchId!==m.id)this.locationRunning=false;}
    if(done(m) || ['captured','left'].includes(m.myStatus)) { loc.stop(); this.locationRunning=false; } else this.startLocation();
  },
  updateClock() { this.updateLocationSignal();if(!this.data.match || this.data.offline) return; const ms=this.data.match.phase==='PAUSED'?this.serverRemaining:Math.max(0,this.serverRemaining-(Date.now()-this.syncedAt)); const sec=Math.ceil(ms/1000); this.setData({clock:String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}); },
  toggleDrawer(e) { if(this.data.drawer){this.closeDrawer();return;}this.openDrawer(e); },
  openDrawer(e) { tapHaptic();this.closeCode();if(this.drawerExitTimer){clearTimeout(this.drawerExitTimer);this.drawerExitTimer=null;}this.seenEventSeq=(this.data.events||[]).reduce((a,ev)=>Math.max(a,Number(ev.seq)||0),this.seenEventSeq||0);this.setData({drawer:true,drawerClosing:false,unreadEvents:0,drawerTab:e?.currentTarget?.dataset?.tab || 'team'}); },
  selectDrawerTab(e){this.setData({drawerTab:e.currentTarget.dataset.tab});},
  closeDrawer() { if(!this.data.drawer || this.data.drawerClosing)return;this._sheetStart=null;this.setData({drawerClosing:true});this.drawerExitTimer=setTimeout(()=>{this.drawerExitTimer=null;if(this.active&&this.data.drawerClosing)this.setData({drawer:false,drawerClosing:false});},220); },
  drawerAnimationEnd(e){if(e?.detail?.animationName && e.detail.animationName!=='sheetExit')return;if(this.data.drawerClosing){if(this.drawerExitTimer){clearTimeout(this.drawerExitTimer);this.drawerExitTimer=null;}this.setData({drawer:false,drawerClosing:false});}},
  sheetTouchStart(e){this._sheetStart=e.touches?.length===1?e.touches[0]:null;},
  sheetTouchEnd(e){const a=this._sheetStart,b=e.changedTouches?.[0];this._sheetStart=null;if(a&&b&&b.clientY-a.clientY>50&&Math.abs(b.clientX-a.clientX)<60)this.closeDrawer();},
  toggleTray(){if(Date.now()<(this._traySuppressUntil||0))return;this.setData({trayExpanded:!this.data.trayExpanded,trayDragging:false,trayDragY:0});},
  trayTouchStart(e){this._trayGesture=e.touches?.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY,dy:0,expanded:this.data.trayExpanded}:null;},
  trayTouchMove(e){const g=this._trayGesture;if(!g)return;if(e.touches?.length!==1){this.trayTouchCancel();return;}const t=e.touches[0],dy=t.clientY-g.y;if(Math.abs(t.clientX-g.x)>Math.max(24,Math.abs(dy))){this.trayTouchCancel();return;}g.dy=dy;if(g.expanded&&dy>6)this.setData({trayDragging:true,trayDragY:Math.min(220,dy)});},
  trayTouchEnd(){const g=this._trayGesture;this._trayGesture=null;if(!g)return;const moved=Math.abs(g.dy)>8;if(moved)this._traySuppressUntil=Date.now()+350;this.setData({trayExpanded:g.expanded?g.dy<36:g.dy< -28,trayDragging:false,trayDragY:0});},
  trayTouchCancel(){this._traySuppressUntil=Date.now()+350;this._trayGesture=null;this.setData({trayDragging:false,trayDragY:0});},
  toggleMapMode() {
    if(this.data.layerLoading)return;
    tapHaptic();
    if(this.data.venueMapId!=='seu-jiulonghu-v1'){this.selectMapLayer(this.data.artMode?'native':'art');return;}
    this.setData({
      layerSheetOpen:true,
      layerOptions:[
        {id:'art',label:'像素场地地图',hint:'星露谷风格导览底图',active:!!this.data.artMode},
        {id:'native',label:'微信实时地图',hint:'标准地理底图与精准范围',active:!this.data.artMode&&!this.data.modelMode},
        {id:'model',label:'3D 校园体量图',hint:'三维建筑参考视角',active:!!this.data.modelMode}
      ]
    });
  },
  closeLayerSheet(){this.setData({layerSheetOpen:false});},
  onSelectLayer(e){const id=e.detail?.id;this.closeLayerSheet();if(id)this.selectMapLayer(id);},
  async selectMapLayer(layer){if(venueCatalog.get(this.data.venueMapId)?.nativeOnly&&layer!=='native')return;if(!['art','native','model'].includes(layer)||this.data.layerLoading)return;const id=this.data.venueMapId;if(layer!=='native'&&this.data.mapCompatible===false){this.setData({error:'地图版本不一致，请更新小程序；当前使用实时地图'});return;}if(layer==='model'&&id!=='seu-jiulonghu-v1')return;if(layer!=='model'){this.initialMapFocus=null;this.setData({artMode:layer==='art',modelMode:false,error:''});return;}this.setData({layerLoading:true,error:''});try{if(layer==='model')await modelResources.ensure();if(this.unloaded||this.data.venueMapId!==id)return;this.initialMapFocus=null;this.setData({artMode:layer==='art',modelMode:layer==='model'});}catch(e){if(this.active)this.setData({error:e.message});}finally{if(!this.unloaded)this.setData({layerLoading:false});}},
  openVenue() { if(this.data.devPreview)wx.navigateTo({url:'/pages/venue/venue?mapId='+encodeURIComponent(this.data.venueMapId||venueCatalog.DEFAULT_ID)}); },
  locateSelf(){tapHaptic();if(!this.data.hasSelf){this.setData({error:this.data.offline?'连接恢复后可重新定位':'尚无可用的本人位置，请检查定位权限并等待同步'});return;}if(this.data.artMode||this.data.modelMode){if(!this.selectComponent(this.data.modelMode?'.campusModel':'.venueArt')?.focusSelf())this.setData({error:'本人位置超出此图参考或地图尚未就绪，请切换实时地图。'});else this.setData({error:''});return;}const p=this.data.geoData.points.find(p=>p.tone==='self');if(p)this.setData({latitude:p.lat,longitude:p.lng,mapScale:17,followSelf:true});},
  onMapRegion(e){if((e.causedBy||e.detail?.causedBy)==='gesture')this.setData({followSelf:false});if(e.type==='end' && Number.isFinite(e.detail?.scale))this.setData({mapScale:e.detail.scale});},
  ignoreTouch() {},
  showCode() {
    if(!this.data.canShowCode || this.data.offline || this.data.codeOpen)return;
    this.setData({drawer:false,drawerClosing:false,codeOpen:true,image:'',seconds:this.devPreview?15:0,codeError:''});
    this.lifecycle=(this.lifecycle||0)+1;this.expiresAt=0;this.nextRetryAt=0;
    if(this.devPreview)return;
    this.refresh();this.proofTimer=setInterval(()=>{if(!this.active || !this.data.codeOpen)return;const seconds=Math.max(0,Math.ceil(((this.expiresAt||0)-Date.now())/1000));this.setData({seconds});if(seconds<=2 && Date.now()>=(this.nextRetryAt||0))this.refresh();},1000);
  },
  refresh:proof.refresh, removeImage:proof.removeImage,
  stopProof(){this.closeCode();},
  closeCode(){if(this.proofTimer){clearInterval(this.proofTimer);this.proofTimer=null;}this.lifecycle=(this.lifecycle||0)+1;this.expiresAt=0;this.removeImage(this.imagePath);this.imagePath=null;if(this.data.codeOpen||this.data.image)this.setData({codeOpen:false,image:'',seconds:0,codeError:''});},
  scan:captureFlow.scan,retryCapture:captureFlow.retryCapture,submitCapture:captureFlow.submitCapture,
  async pause() { if(this.devPreview || !this.data.owner || this.data.offline)return;try { await api.pause(this.data.roomId,'host'); await this.poll(); } catch(e) {this.setData({error:e.message});} },
  async emergency() { if(this.devPreview)return;try { await api.pause(this.data.roomId,'emergency'); await this.poll(); } catch(e) {this.setData({error:e.message});} },
  promptEmergency() {
    if(this.devPreview)return;
    this.setData({confirmModal:{visible:true,action:'emergency',title:'触发紧急暂停？',content:'全体成员的活动计时将立即暂停，并收到原地等待提示。',confirmText:'立即暂停',confirmTone:'red'}});
  },
  async resume() { if(this.devPreview || !this.data.canResume || this.data.loading)return;try { if(this.data.match?.myStatus==='active')await loc.once(this.data.roomId); await api.resume(this.data.roomId); await this.poll(); } catch(e) {this.setData({error:'恢复失败：'+e.message});} },
  async cancel() {
    if(this.devPreview || !this.data.owner || this.data.offline || this.data.match?.phase!=='PAUSED')return;
    this.setData({confirmModal:{visible:true,action:'cancel',title:'取消本场活动？',content:'取消后不记完成状态，已有记录和轨迹将保留归档。',confirmText:'确认取消',confirmTone:'red'}});
  },
  async leave() {
    if(done(this.data.match) && !this.data.devPreview){this.goHome();return;}
    if(this.devPreview){this.backToDev();return;}
    this.setData({confirmModal:{visible:true,action:'leave',title:'退出本场活动？',content:'退出后会触发活动暂停，请提前告知组织者。',confirmText:'确认退出',confirmTone:'amber'}});
  },
  closeConfirmModal(){if(this.data.confirmModal?.visible)this.setData({'confirmModal.visible':false});},
  async onConfirmModal(){
    const action=this.data.confirmModal?.action;
    this.closeConfirmModal();
    if(action==='cancel'){try{await api.cancel(this.data.roomId);await this.poll();}catch(e){this.setData({error:e.message});}}
    else if(action==='leave'){try{await api.leave(this.data.roomId);this.cleanup();wx.reLaunch({url:'/pages/index/index'});}catch(e){this.setData({error:e.message});}}
    else if(action==='emergency'){await this.emergency();}
  },
  backToDev(){if(this.devPreview)wx.reLaunch({url:'/pages/dev/dev'});},
  goHome() { this.cleanup(); if(this.devPreview)this.backToDev();else wx.reLaunch({url:'/pages/index/index'}); },
  openTracks(e){if(this.devPreview||this.data.offline||!done(this.data.match)||this.data.match.trackVersion!=='tracks-v1')return;const scope=e?.currentTarget?.dataset?.scope==='all'?'all':'self';if(scope==='all'&&!this.data.owner)return;wx.navigateTo({url:'/room-tools/pages/tracks/tracks?matchId='+encodeURIComponent(this.data.match.id)+'&scope='+scope});},
  replay() { if(!this.data.canReplay)return;wx.redirectTo({url:this.devPreview?'/pages/room/room?devPreview=ready':'/pages/room/room?roomId='+encodeURIComponent(this.data.roomId)}); }
});
function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==='x'?r:(r&3|8)).toString(16);}); }
