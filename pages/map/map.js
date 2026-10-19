const presentation=require('../../utils/presentation');
const mapMarkers=require('../../utils/map-markers');
const venueCatalog=require('../../utils/venue-catalog');
const modelResources=require('../../utils/model-resources');
const api = require('../../utils/v2'); const loc = require('../../utils/location-v2'); const {shouldApply}=require('../../utils/snapshot-v2'); const preview=require('../../utils/dev-preview');
const proof=require('../../utils/capture-proof').create(api,wx);
const done = m => m && (m.phase==='FINISHED' || m.phase==='CANCELLED');
Page({
  remeasureVenue() { if(this.active)this.selectComponent('.venueArt')?.remeasure(); },
  onArtProjection(e){const n=e.detail.omittedRegions||0,s=e.detail.source;if(this.active&&(n!==this.data.omittedArtRegions||s!==this.data.artReferenceState))this.setData({omittedArtRegions:n,artReferenceState:s});},
  onArtCamera(e){if(this.active)this.setData({artCanZoomIn:e.detail.canZoomIn,artCanZoomOut:e.detail.canZoomOut});},
  zoomMapIn(){this.zoomMap(1);},zoomMapOut(){this.zoomMap(-1);},
  zoomMap(direction){if(this.data.artMode||this.data.modelMode){const c=this.selectComponent(this.data.modelMode?'.campusModel':'.venueArt');if(direction>0)c?.zoomIn();else c?.zoomOut();}else this.setData({mapScale:Math.max(3,Math.min(20,(this.data.mapScale||17)+direction))});},
  onMapReady(){const key=this.data.match?.id+'/'+this.data.venueMapId;if(!this.active||!this.data.hasSelf||this.initialMapFocus===key)return;const c=this.selectComponent(this.data.modelMode?'.campusModel':'.venueArt');if((this.data.artMode||this.data.modelMode)&&c?.focusSelf())this.initialMapFocus=key;},
  tiltModel(){this.selectComponent('.campusModel')?.tilt();},
  useArtMap(){this.selectMapLayer('art');},
  onResize(e) { this.setData(presentation.resize(e)); },
  data:{ fontScale:1, roomId:'', match:null, roster:[], events:[], markers:[], circles:[], nearbyCat:false, offline:false, latitude:32.0584,longitude:118.7968, clock:'--:--', roleText:'', phaseText:'', pauseReasonText:'', connection:'正在连接', error:'', drawer:false, owner:false, loading:false, devPreview:false, artMode:true,modelMode:false,layerLoading:false,trayExpanded:true,trayDragging:false,trayDragY:0, drawerTab:'team', drawerClosing:false, codeOpen:false, image:'',seconds:0,codeError:'',hasSelf:false,locationText:'等待定位',mapScale:17,followSelf:true },
  onLoad(o) { this.setData(presentation.metrics()); this.devPreview=preview.accepts(o.devPreview);if(o.devPreview && !this.devPreview){this.previewDenied=true;wx.reLaunch({url:'/pages/index/index'});return;}this.previewCase=o.devPreview;this.previewMapId=this.devPreview&&venueCatalog.get(o.mapId)?o.mapId:venueCatalog.DEFAULT_ID;this.setData({roomId:this.devPreview?'dev-preview-room':o.roomId || wx.getStorageSync('v2RoomId'),devPreview:this.devPreview,artMode:true}); },
  onShow() { if(this.previewDenied)return;this.active=true;this.lifecycle=(this.lifecycle||0)+1;if(this.devPreview){this.lastSnapshot=null;this.apply(preview.mapSnapshot(this.previewCase,'dev-preview-me',this.previewMapId));if(this.previewCase==='offline')this.setOffline('', '重连中');else this.setData({connection:'界面预览'});return;}this.reconnectAttempt=0; this.poll(); this.startPolling(); this.startSocket(); clearInterval(this.clockTimer); this.clockTimer=setInterval(()=>this.updateClock(),1000); },
  onHide() { this.cleanup(); }, onUnload() { this.unloaded=true;this.cleanup(); },
  cleanup() { this.closeCode();if(this.drawerExitTimer){clearTimeout(this.drawerExitTimer);this.drawerExitTimer=null;}if(this.data.drawer)this.setData({drawer:false,drawerClosing:false});this._sheetStart=null;this._trayGesture=null;if(this.data.trayDragging)this.setData({trayDragging:false,trayDragY:0});this.active=false;this.pollSerial=(this.pollSerial||0)+1;this.fetching=false;this.setOffline('', '正在连接'); clearInterval(this.pollTimer); clearInterval(this.clockTimer); clearInterval(this.heartbeatTimer); clearTimeout(this.reconnectTimer); this.pollTimer=null; this.clockTimer=null; this.heartbeatTimer=null; this.reconnectTimer=null; const socket=this.socket;this.socket=null;this.socketOpen=false;if(socket)socket.close();if(!this.devPreview)loc.stop();this.locationRunning=false; },
  startLocation() { if(!this.data.match || done(this.data.match) || this.data.match.myStatus==='captured' || this.locationRunning)return; this.locationRunning=true; loc.start(this.data.roomId,()=>this.setData({error:'定位中断：请保持页面在前台并检查权限'})); },
  startPolling() { if(this.pollTimer) return; this.pollTimer=setInterval(()=>this.poll(),2000); },
  startSocket() {
    if(!this.active || this.socket)return;
    const base=api.config.wsUrl || (api.config.mode==='local'?api.config.baseUrl.replace(/^http/,'ws'):'');
    if(!base) return;
    const url=base+'/api/v2/live?room='+encodeURIComponent(this.data.roomId);
    try {
      const task=wx.connectSocket({url,header:{Authorization:'Bearer '+wx.getStorageSync('v2Token')}});
      this.socket=task;this.socketOpen=false;
      task.onOpen(()=>{
        if(!this.active || this.socket!==task)return;
        this.socketOpen=true;this.reconnectAttempt=0;clearTimeout(this.reconnectTimer);this.reconnectTimer=null;
        clearInterval(this.pollTimer);this.pollTimer=null;clearInterval(this.heartbeatTimer);
        this.lastFrameAt=Date.now();
        this.heartbeatTimer=setInterval(()=>{if(!this.active || this.socket!==task)return;if(Date.now()-this.lastFrameAt>7000){try{task.close();}catch{}this.socketDropped(task);return;}try{task.send({data:'PING',fail:()=>{try{task.close();}catch{}this.socketDropped(task);}});}catch{this.socketDropped(task);}},5000);
        this.setData({connection:'实时连接'});
      });
      task.onMessage(e=>{if(!this.active || this.socket!==task)return;try{const msg=JSON.parse(e.data);if(msg.type==='SNAPSHOT'){this.lastFrameAt=Date.now();this.apply(msg.payload);}}catch{}});
      task.onClose(()=>this.socketDropped(task));
      task.onError(()=>{if(this.socket===task){try{task.close();}catch{}this.socketDropped(task);}});
    } catch { this.startPolling();this.scheduleReconnect(); }
  },
  socketDropped(task) {
    if(this.socket!==task)return;
    this.socket=null;this.socketOpen=false;clearInterval(this.heartbeatTimer);this.heartbeatTimer=null;
    if(!this.active)return;
    this.setData({connection:'轮询恢复中'});this.startPolling();this.poll();this.scheduleReconnect();
  },
  scheduleReconnect() {
    if(!this.active || this.socket || this.reconnectTimer)return;
    const delay=Math.min(30000,1000*2**Math.min(this.reconnectAttempt||0,5))+Math.floor(Math.random()*300);
    this.reconnectAttempt=(this.reconnectAttempt||0)+1;
    this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null;this.startSocket();},delay);
  },
  async poll() { if(!this.active || this.fetching) return;const run=this.pollSerial=(this.pollSerial||0)+1; this.fetching=true; try { const s=await api.room(this.data.roomId);if(this.active&&run===this.pollSerial)this.apply(s); } catch(e) {if(run!==this.pollSerial)return; if(this.active && (e.code==='UNAUTHENTICATED' || e.code==='NOT_MEMBER')){this.cleanup();this.setOffline(e.message,'身份失效');}else if(this.active && !this.socketOpen){if(this.locationRunning){loc.stop();this.locationRunning=false;}if(!this.data.offline)this.setOffline('状态暂不可用：'+e.message,'重连中');} } finally {if(run===this.pollSerial)this.fetching=false; } },
  setOffline(error,connection='重连中'){this.closeCode();this.setData({...presentation.project({match:this.data.match,roster:this.data.roster,owner:this.data.owner,venue:{mapId:this.data.venueMapId||venueCatalog.DEFAULT_ID}},true),offline:true,connection,error,clock:'--:--',markers:[],circles:[],geoData:{points:[],regions:[]},nearbyCat:false,hasSelf:false,locationText:'等待重连 · 位置已隐藏'});},
  apply(s) {
    if(!this.active || !shouldApply(this.lastSnapshot,s)) return;
    if(!s.match){this.closeCode();this.setData({mapCalibration:null,geoData:{points:[],regions:[]},match:null,error:'本局尚未开始，请返回准备房间',canScan:false,canShowCode:false,canResume:false,canReplay:false});return;}
    if(this.data.match?.id && this.data.match.id!==s.match.id)this.closeCode();
    this.lastSnapshot={version:s.version,serverTime:s.serverTime,match:{id:s.match.id}};
    const m=s.match,myId=this.devPreview?'dev-preview-me':wx.getStorageSync('v2UserId'),mine=s.visiblePositions.find(p=>p.id===myId);
    const markers=s.visiblePositions.map((p,i)=>({id:i+1,latitude:p.lat,longitude:p.lng,title:s.roster.find(x=>x.id===p.id)?.nickname || '玩家',...mapMarkers.sprite(p.id===myId?'self':'ally'),callout:{content:p.id===myId?'本人':'队友',display:'BYCLICK',padding:4,borderRadius:2,bgColor:'#FCF8ED',color:'#213638'}}));
    markers.push({id:1000,latitude:s.venue.lat,longitude:s.venue.lng,...mapMarkers.sprite('venue'),callout:{content:'集合点',display:'BYCLICK',padding:4,bgColor:'#FCF8ED',color:'#526863'}});
    const circles=(s.intel||[]).map(p=>({latitude:p.cellLat,longitude:p.cellLng,radius:p.radiusM,color:'#F36A3488',fillColor:'#F36A3422',strokeWidth:2}));
    if(Number.isFinite(s.venue.radiusM))circles.unshift({latitude:s.venue.lat,longitude:s.venue.lng,radius:s.venue.radiusM,color:'#477F60AA',fillColor:'#91CE6B0A',strokeWidth:2});
    const hasSelf=!!mine && m.myStatus==='active' && !done(m);
    const locationText=hasSelf?'本人 · '+(Number.isFinite(mine.accuracy)?'精度约'+Math.round(mine.accuracy)+'米':'已定位'):m.myStatus==='captured'?'已出局 · 仅公开位置':m.phase==='PAUSED'?'已暂停 · 等待重新定位':'等待本人定位';
    const follow=!this.hasCenter||this.data.followSelf;const latitude=follow&&Number.isFinite(mine?.lat)?mine.lat:(this.hasCenter?this.data.latitude:s.venue.lat),longitude=follow&&Number.isFinite(mine?.lng)?mine.lng:(this.hasCenter?this.data.longitude:s.venue.lng);this.hasCenter=true;
    const pauseReasonText={host:'组织者暂停',emergency:'玩家紧急暂停',lost_position:'定位或连接失联',outside_venue:'超出活动范围',server_restart:'服务重启，等待重新定位',leave:'有玩家退出'}[m.pauseReason] || '等待组织者确认';
    const projected=presentation.project(s);if(!projected.canShowCode)this.closeCode();
    this.setData({...projected,hasSelf,locationText,match:m,roster:s.roster,events:(s.events||[]).map(e=>({...e,timeText:presentation.eventTime(e.at)})),owner:s.owner,version:s.version,mapCalibration:s.mapCalibration||null,geoData:{points:s.visiblePositions.map(p=>({lat:p.lat,lng:p.lng,label:p.id===myId?'本人':'队友',tone:p.id===myId?'self':'ally'})).concat([{...s.venue,label:'集合点',tone:'venue'}]),regions:(s.intel||[]).map(p=>({lat:p.cellLat,lng:p.cellLng,radiusM:p.radiusM}))},markers,circles,nearbyCat:!!s.nearbyCat,offline:false,latitude,longitude,roleText:m.myRole==='cat'?'猫队':'鼠队',phaseText:m.myStatus==='captured' && !done(m)?'本轮出局':{HIDING:'躲藏阶段',CHASING:'追逐中',PAUSED:'已暂停',FINISHED:'本局结束',CANCELLED:'本局取消'}[m.phase],pauseReasonText,connection:this.socketOpen?'实时连接':'轮询同步',error:''},()=>this.onMapReady());
    this.serverRemaining=m.remainingMs; this.syncedAt=Date.now(); this.updateClock();
    if(this.devPreview)return;
    if(done(m) || m.myStatus==='captured') { loc.stop(); this.locationRunning=false; } else this.startLocation();
  },
  updateClock() { if(!this.data.match || this.data.offline) return; const ms=this.data.match.phase==='PAUSED'?this.serverRemaining:Math.max(0,this.serverRemaining-(Date.now()-this.syncedAt)); const sec=Math.ceil(ms/1000); this.setData({clock:String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}); },
  toggleDrawer(e) { if(this.data.drawer){this.closeDrawer();return;}this.openDrawer(e); },
  openDrawer(e) { this.closeCode();if(this.drawerExitTimer){clearTimeout(this.drawerExitTimer);this.drawerExitTimer=null;}this.setData({drawer:true,drawerClosing:false,drawerTab:e?.currentTarget?.dataset?.tab || 'team'}); },
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
  toggleMapMode() {if(this.data.layerLoading)return;if(this.data.venueMapId!=='seu-jiulonghu-v1'){this.selectMapLayer(this.data.artMode?'native':'art');return;}wx.showActionSheet({itemList:['像素地图','实时地图','3D校园 · 体量示意'],success:r=>this.selectMapLayer(['art','native','model'][r.tapIndex])});},
  async selectMapLayer(layer){if(!['art','native','model'].includes(layer)||this.data.layerLoading)return;const id=this.data.venueMapId;if(layer==='model'&&id!=='seu-jiulonghu-v1')return;if(layer!=='model'){this.initialMapFocus=null;this.setData({artMode:layer==='art',modelMode:false,error:''});return;}this.setData({layerLoading:true,error:''});try{if(layer==='model')await modelResources.ensure();if(this.unloaded||this.data.venueMapId!==id)return;this.initialMapFocus=null;this.setData({artMode:layer==='art',modelMode:layer==='model'});}catch(e){if(this.active)this.setData({error:e.message});}finally{if(!this.unloaded)this.setData({layerLoading:false});}},
  openVenue() { if(this.data.devPreview)wx.navigateTo({url:'/pages/venue/venue?mapId='+encodeURIComponent(this.data.venueMapId||venueCatalog.DEFAULT_ID)}); },
  locateSelf(){if(!this.data.hasSelf){this.setData({error:this.data.offline?'连接恢复后可重新定位':'尚无可用的本人位置，请检查定位权限并等待同步'});return;}if(this.data.artMode||this.data.modelMode){if(!this.selectComponent(this.data.modelMode?'.campusModel':'.venueArt')?.focusSelf())this.setData({error:'本人位置超出此图参考或地图尚未就绪，请切换实时地图。'});else this.setData({error:''});return;}const p=this.data.geoData.points.find(p=>p.tone==='self');if(p)this.setData({latitude:p.lat,longitude:p.lng,mapScale:17,followSelf:true});},
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
  scan() { if(!this.data.canScan || this.data.loading)return;if(this.devPreview){this.setData({error:'界面预览不使用相机；请返回调试台查看结算状态。'});return;}if(this.data.offline)return;wx.scanCode({onlyFromCamera:true,success:async r=>{try{const proof=JSON.parse(r.result);if(!proof.matchId || !proof.token) throw Error('无效抓捕码');this.setData({loading:true});await loc.once(this.data.roomId);await api.capture(this.data.roomId,{matchId:proof.matchId,token:proof.token,commandId:uuid()});await this.poll();wx.showToast({title:'抓捕已记录',icon:'success'});}catch(e){this.setData({error:'抓捕未完成：'+e.message});}finally{this.setData({loading:false});}},fail:()=>this.setData({error:'扫码已取消或相机不可用'})}); },
  async pause() { if(this.devPreview || !this.data.owner || this.data.offline)return;try { await api.pause(this.data.roomId,'host'); await this.poll(); } catch(e) {this.setData({error:e.message});} },
  async emergency() { if(this.devPreview)return;try { await api.pause(this.data.roomId,'emergency'); await this.poll(); } catch(e) {this.setData({error:e.message});} },
  async resume() { if(this.devPreview || !this.data.canResume || this.data.loading)return;try { await loc.once(this.data.roomId); await api.resume(this.data.roomId); await this.poll(); } catch(e) {this.setData({error:'恢复失败：'+e.message});} },
  async cancel() { if(this.devPreview || !this.data.owner || this.data.offline || this.data.match?.phase!=='PAUSED')return;wx.showModal({title:'取消本局？',content:'取消不计胜负，结果会保留。',success:async r=>{if(r.confirm)try{await api.cancel(this.data.roomId);await this.poll();}catch(e){this.setData({error:e.message});}}}); },
  async leave() { if(done(this.data.match) && !this.devPreview){this.goHome();return;}if(this.devPreview){this.backToDev();return;}wx.showModal({title:'退出本局？',content:'退出会暂停本局，请告知组织者。',success:async r=>{if(r.confirm)try{await api.leave(this.data.roomId);this.cleanup();wx.reLaunch({url:'/pages/index/index'});}catch(e){this.setData({error:e.message});}}}); },
  backToDev(){if(this.devPreview)wx.reLaunch({url:'/pages/dev/dev'});},
  goHome() { this.cleanup(); if(this.devPreview)this.backToDev();else wx.reLaunch({url:'/pages/index/index'}); },
  replay() { if(!this.data.canReplay)return;wx.redirectTo({url:this.devPreview?'/pages/room/room?devPreview=ready':'/pages/room/room?roomId='+encodeURIComponent(this.data.roomId)}); }
});
function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==='x'?r:(r&3|8)).toString(16);}); }
