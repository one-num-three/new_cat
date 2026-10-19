const presentation=require('../../utils/presentation');
const api = require('../../utils/v2'); const loc = require('../../utils/location-v2'); const {shouldApply}=require('../../utils/snapshot-v2'); const preview=require('../../utils/dev-preview');
const done = m => m && (m.phase==='FINISHED' || m.phase==='CANCELLED');
Page({
  onResize(e) { this.setData(presentation.resize(e)); },
  data:{ roomId:'', match:null, roster:[], events:[], markers:[], circles:[], nearbyCat:false, offline:false, latitude:32.0584,longitude:118.7968, clock:'--:--', roleText:'', phaseText:'', pauseReasonText:'', connection:'正在连接', error:'', drawer:false, owner:false, loading:false, devPreview:false, artMode:false },
  onLoad(o) { this.setData(presentation.metrics()); this.devPreview=preview.accepts(o.devPreview);if(o.devPreview && !this.devPreview){this.previewDenied=true;wx.reLaunch({url:'/pages/index/index'});return;}this.previewCase=o.devPreview;this.setData({roomId:this.devPreview?'dev-preview-room':o.roomId || wx.getStorageSync('v2RoomId'),devPreview:this.devPreview,artMode:this.devPreview}); },
  onShow() { if(this.previewDenied)return;this.active=true;if(this.devPreview){this.lastSnapshot=null;this.apply(preview.mapSnapshot(this.previewCase,'dev-preview-me'));if(this.previewCase==='offline')this.setOffline('', '重连中');else this.setData({connection:'界面预览'});return;}this.reconnectAttempt=0; this.poll(); this.startPolling(); this.startSocket(); clearInterval(this.clockTimer); this.clockTimer=setInterval(()=>this.updateClock(),1000); },
  onHide() { this.cleanup(); }, onUnload() { this.cleanup(); },
  cleanup() { this.active=false; clearInterval(this.pollTimer); clearInterval(this.clockTimer); clearInterval(this.heartbeatTimer); clearTimeout(this.reconnectTimer); this.pollTimer=null; this.clockTimer=null; this.heartbeatTimer=null; this.reconnectTimer=null; const socket=this.socket;this.socket=null;this.socketOpen=false;if(socket)socket.close();if(!this.devPreview)loc.stop();this.locationRunning=false; },
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
  async poll() { if(!this.active || this.fetching) return; this.fetching=true; try { const s=await api.room(this.data.roomId); this.apply(s); } catch(e) { if(this.active && (e.code==='UNAUTHENTICATED' || e.code==='NOT_MEMBER')){this.cleanup();this.setOffline(e.message,'身份失效');}else if(this.active && !this.socketOpen){if(this.locationRunning){loc.stop();this.locationRunning=false;}if(!this.data.offline)this.setOffline('状态暂不可用：'+e.message,'重连中');} } finally { this.fetching=false; } },
  setOffline(error,connection='重连中'){this.setData({...presentation.project({match:this.data.match,roster:this.data.roster,owner:this.data.owner},true),offline:true,connection,error,clock:'--:--',markers:[],circles:[],nearbyCat:false});},
  apply(s) {
    if(!this.active || !shouldApply(this.lastSnapshot,s)) return;
    if(!s.match){this.setData({match:null,error:'本局尚未开始，请返回准备房间',canScan:false,canShowCode:false,canResume:false,canReplay:false});return;}
    this.lastSnapshot={version:s.version,serverTime:s.serverTime,match:{id:s.match.id}};
    const m=s.match,myId=this.devPreview?'dev-preview-me':wx.getStorageSync('v2UserId'),mine=s.visiblePositions.find(p=>p.id===myId);
    const markers=s.visiblePositions.map((p,i)=>({id:i+1,latitude:p.lat,longitude:p.lng,title:s.roster.find(x=>x.id===p.id)?.nickname || '玩家',iconPath:'/assets/markers-v1/'+(p.id===myId?'self':s.roster.find(x=>x.id===p.id)?.role==='cat'?'cat':'mouse')+'.png',width:30,height:30,callout:{content:p.id===myId?'本人':'队友',display:p.id===myId?'ALWAYS':'BYCLICK',padding:6,borderRadius:8,bgColor:'#FFFFFF',color:'#213638'}}));
    markers.push({id:1000,latitude:s.venue.lat,longitude:s.venue.lng,iconPath:'/assets/markers-v1/venue.png',width:27,height:27,callout:{content:'集合点',display:'ALWAYS',padding:5,bgColor:'#FFFFFF',color:'#526863'}});
    const circles=(s.intel||[]).map(p=>({latitude:p.cellLat,longitude:p.cellLng,radius:p.radiusM,color:'#F36A3488',fillColor:'#F36A3422',strokeWidth:2}));
    if(Number.isFinite(s.venue.radiusM))circles.unshift({latitude:s.venue.lat,longitude:s.venue.lng,radius:s.venue.radiusM,color:'#477F60AA',fillColor:'#91CE6B0A',strokeWidth:2});
    const latitude=Number.isFinite(mine?.lat)?mine.lat:(this.hasCenter?this.data.latitude:s.venue.lat),longitude=Number.isFinite(mine?.lng)?mine.lng:(this.hasCenter?this.data.longitude:s.venue.lng);this.hasCenter=true;
    const pauseReasonText={host:'组织者暂停',emergency:'玩家紧急暂停',lost_position:'定位或连接失联',outside_venue:'超出活动范围',server_restart:'服务重启，等待重新定位',leave:'有玩家退出'}[m.pauseReason] || '等待组织者确认';
    this.setData({...presentation.project(s),match:m,roster:s.roster,events:(s.events||[]).map(e=>({...e,timeText:presentation.eventTime(e.at)})),owner:s.owner,version:s.version,markers,circles,nearbyCat:!!s.nearbyCat,offline:false,latitude,longitude,roleText:m.myRole==='cat'?'猫队':'鼠队',phaseText:m.myStatus==='captured' && !done(m)?'本轮出局':{HIDING:'躲藏阶段',CHASING:'追逐中',PAUSED:'已暂停',FINISHED:'本局结束',CANCELLED:'本局取消'}[m.phase],pauseReasonText,connection:this.socketOpen?'实时连接':'轮询同步',error:''});
    this.serverRemaining=m.remainingMs; this.syncedAt=Date.now(); this.updateClock();
    if(this.devPreview)return;
    if(done(m) || m.myStatus==='captured') { loc.stop(); this.locationRunning=false; } else this.startLocation();
  },
  updateClock() { if(!this.data.match || this.data.offline) return; const ms=this.data.match.phase==='PAUSED'?this.serverRemaining:Math.max(0,this.serverRemaining-(Date.now()-this.syncedAt)); const sec=Math.ceil(ms/1000); this.setData({clock:String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}); },
  toggleDrawer() { this.setData({drawer:!this.data.drawer}); },
  toggleMapMode() { if(this.data.devPreview)return;this.setData({artMode:!this.data.artMode}); },
  openVenue() { if(this.data.devPreview)wx.navigateTo({url:'/pages/venue/venue'}); },
  closeDrawer() { this.setData({drawer:false}); },
  ignoreTouch() {},
  showCode() { if(!this.data.canShowCode)return;wx.navigateTo({url:this.devPreview?'/pages/qrcode/qrcode?devPreview=code':'/pages/qrcode/qrcode?roomId='+encodeURIComponent(this.data.roomId)}); },
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
