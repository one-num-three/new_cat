const presentation=require('../../utils/presentation');
const {shouldApplyRoom}=require('../../utils/snapshot-v2');
const liveRoom=require('../../utils/room-live').create(require('../../utils/v2'),wx,{setInterval:(f,t)=>setInterval(f,t),clearInterval:id=>clearInterval(id),setTimeout:(f,t)=>setTimeout(f,t),clearTimeout:id=>clearTimeout(id)});
const teams=require('../../utils/team-config');
const venueGeometry=require('../../utils/venue-boundary');
const catalog=require('../../utils/venue-catalog'),resources=require('../../utils/venue-resources');
const api = require('../../utils/v2'); const location = require('../../utils/location-v2'); const preview = require('../../utils/dev-preview');
const tapHaptic=(type='light')=>{try{if(typeof wx!=='undefined'&&'vibrateShort' in wx)wx.vibrateShort({type});}catch{}};
const VENUE_THUMBS={'xuanwu-v4':'/assets/sdv-v1/thumb-xuanwu.jpg','seu-jiulonghu-v1':'/assets/sdv-v1/thumb-jiulonghu.jpg','seu-sipailou-v1':'/assets/sdv-v1/thumb-sipailou.jpg'};
Page({
  onResize(e) { this.setData(presentation.resize(e)); },
  data:{ fontScale:1, themeMode:'day', nightMode:false, mouseTeamVision:false, needSetting:false, mapId:catalog.DEFAULT_ID,nativeOnly:false,venueOptions:catalog.options,venueMapIndex:0,venueName:catalog.get().label,venueSource:catalog.get().src,venueThumb:VENUE_THUMBS[catalog.DEFAULT_ID]||'',venueResource:'ready',roomId:'', code:'', roster:[], rules:null, owner:false, total:8, totals:[6,7,8,9,10,11,12], presets:[4,6,8,12], venue:null, catsCount:2, miceCount:6, teamError:'', editingField:'', targetCount:4, ready:false, readyCount:0, canStart:false, startHint:'等待成员加入', error:'', loading:false, match:null, devPreview:false, configSheetOpen:false, configSheetItems:[], rulesModalOpen:false, visionModalOpen:false, signalModalOpen:false, signalModalContent:'', signalModalNeedSetting:false, customTeamOpen:false, venueSheetOpen:false, venueSheetItems:[], inviteSheetOpen:false, copyTip:'' },
  onLoad(options) { this.setData({...presentation.metrics(),catsCount:2,targetCount:4}); this.devPreview=preview.accepts(options.devPreview);if(options.devPreview && !this.devPreview){this.previewDenied=true;wx.reLaunch({url:'/pages/index/index'});return;}this.creating=options.mode==='create' || options.devPreview==='create' && this.devPreview;const patch={roomId:options.roomId || '',devPreview:this.devPreview};if(this.creating&&!this.devPreview&&!options.mapId){const nativeImg=catalog.get('native-gcj02-v1');if(nativeImg){Object.assign(patch,{mapId:nativeImg.id,nativeOnly:true,venueName:nativeImg.label,venueSource:nativeImg.src,venueThumb:'',venueMapIndex:catalog.options.findIndex(x=>x.id===nativeImg.id),venueResource:'ready'});}}this.setData(patch); if (this.creating && api.config.localTestIdentities && !this.devPreview) this.setData({totals:[2,6,7,8,9,10,11,12]}); },
  async onShow() { if(this.previewDenied)return;this.active=true;this.lifecycle=(this.lifecycle||0)+1;try{if(typeof wx!=='undefined'&&'getStorageSync' in wx){const raw=wx.getStorageSync('sdvTheme'),mode=raw==='night'||raw==='dusk'?raw:'day',n=mode!=='day';if(mode!==this.data.themeMode||n!==!!this.data.nightMode)this.setData({themeMode:mode,nightMode:n});}}catch{}if(this.devPreview){this.applyRoom(this.previewRoom || preview.roomData(this.creating?'create':'ready'));return;}this.updateTitle();const run=this.lifecycle;if(this.data.roomId) { try { await api.session();if(!this.active || run!==this.lifecycle)return; if(/^[0-9A-F]{10}$/.test(this.data.roomId)) { const r=await api.join(this.data.roomId,wx.getStorageSync('nickname') || '成员');if(!this.active || run!==this.lifecycle)return;this.setData({roomId:r.roomId}); wx.setStorageSync('v2RoomId',r.roomId); } this.retryAttempt=0;this.begin(); } catch(e) { if(this.active && run===this.lifecycle){this.setData({error:'连接房间失败：'+e.message});this.scheduleRetry(e);} } } },
  updateTitle(){wx.setNavigationBarTitle?.({title:this.data.roomId?'活动准备':'创建活动'});},
  applyRoom(changes){const image=catalog.get(changes.venue?.mapId||this.data.mapId);if(image){changes={...changes,mapId:image.id,nativeOnly:!!image.nativeOnly,venueName:image.label,venueSource:image.src,venueThumb:VENUE_THUMBS[image.id]||'',venueResource:'ready',venueMapIndex:catalog.options.findIndex(x=>x.id===image.id)};}if(this.devPreview)this.previewRoom={...this.previewRoom,...changes};const roster=changes.roster || this.data.roster,total=changes.rules?.total || this.data.rules?.total || this.data.total,readyCount=roster.filter(p=>p.ready).length;const catsCount=changes.rules?.cats ?? this.data.catsCount;this.setData({...changes,...(Object.prototype.hasOwnProperty.call(changes,'venue')?{venueSummaryText:this.venueSummary(changes.venue)}:{}),total,catsCount,miceCount:changes.rules?.mice ?? this.data.miceCount,targetCount:Math.ceil((total-catsCount)*.6),readyCount,canStart:roster.length===total && readyCount===total,startHint:roster.length<total?'差 '+(total-roster.length)+' 人':readyCount<total?(total-readyCount)+' 人未就绪':'可以开始'});this.updateTitle();},
  onHide() { this.stop(); }, onUnload() { this.unloaded=true;this.stop(); },
  stop() { this.active=false;const socket=this.socket;this.socket=null;this.socketOpen=false;clearInterval(this.heartbeatTimer);clearTimeout(this.reconnectTimer);this.heartbeatTimer=null;this.reconnectTimer=null;try{clearTimeout(this.copyResetTimer);}catch{}this.copyResetTimer=null;if(socket)socket.close();this.fetchSerial=(this.fetchSerial||0)+1;this.fetching=false;this.venueResourceSerial=(this.venueResourceSerial||0)+1;this.lifecycle=(this.lifecycle||0)+1;clearInterval(this.pollTimer);clearInterval(this.locTimer);clearTimeout(this.retryTimer);this.pollTimer=null;this.locTimer=null;this.retryTimer=null;this.locationPromise=null; },
  clearError(){this.setData({error:'',needSetting:false});},
  openPermSettings(){tapHaptic();try{if(typeof wx!=='undefined'&&'openSetting' in wx)wx.openSetting({success:()=>{if(this.active)this.setData({error:'',needSetting:false});}});}catch{}},
  scheduleRetry(error) { if(!this.active || this.retryTimer || error.code && !/^HTTP_5/.test(error.code))return;const delay=Math.min(15000,3000*2**Math.min(this.retryAttempt||0,3));this.retryAttempt=(this.retryAttempt||0)+1;this.retryTimer=setTimeout(()=>{this.retryTimer=null;if(this.active)this.onShow();},delay); },
  selectTotal(e) { const total=this.data.totals[Number(e.detail.value)],catsCount=total===2?1:total<=8?2:3;this.setData({total,catsCount,targetCount:Math.ceil((total-catsCount)*.6)}); },
  applyPreset(e) { const total=Number(e.currentTarget.dataset.total);if(!Number.isInteger(total)||total<2||total>60)return;tapHaptic();const catsCount=total<=4?1:total<=9?2:3,miceCount=total-catsCount;this.setData({total,catsCount,miceCount,error:'',teamError:teams.validate(total,catsCount,miceCount),targetCount:Math.ceil(miceCount*.6)}); },
  toggleCustomTeam(){tapHaptic();this.setData({customTeamOpen:!this.data.customTeamOpen});},
  toggleCreateVision(){tapHaptic();this.setData({mouseTeamVision:!this.data.mouseTeamVision});},
  openVisionInfo(){tapHaptic();this.setData({visionModalOpen:true});},
  closeVisionInfo(){this.setData({visionModalOpen:false});},
  openSignalModal(){
    tapHaptic();
    const sig=this.data.locationSignal;
    const text=sig?.text || '等待定位';
    const detail=sig?.detail ? `\n定位说明：${sig.detail}` : '';
    const need=!this.devPreview && (!sig || sig.level===0);
    this.setData({
      signalModalOpen:true,
      signalModalNeedSetting:need,
      signalModalContent:`当前定位状态：${text}${detail}\n后台定位需在设置中选「使用时和离开后」；若未开启，对局中请保持亮屏在前台运行。`
    });
  },
  closeSignalModal(){this.setData({signalModalOpen:false});},
  confirmSignalModal(){
    const need=!!this.data.signalModalNeedSetting;
    this.setData({signalModalOpen:false});
    if(need)this.openPermSettings();
  },
  openVenueActionSheet(){
    if(this.data.nativeOnly){this.openVenueEditor();return;}
    this.setData({
      venueSheetOpen:true,
      venueSheetItems:[
        {id:'editor',label:'地图框选范围',hint:'点选边界与集合点'},
        {id:'gps',label:'用当前定位',hint:'半径 200 米'}
      ]
    });
  },
  closeVenueActionSheet(){this.setData({venueSheetOpen:false});},
  onSelectVenueAction(e){const id=e.detail?.id;this.closeVenueActionSheet();if(id==='editor')this.openVenueEditor();else if(id==='gps')this.chooseVenue();},
  teamFocus(e){this.setData({editingField:e.currentTarget.dataset.field});},
  teamBlur(){this.setData({editingField:''});},
  teamInput(e){const field=e.currentTarget.dataset.field;if(!['total','catsCount','miceCount'].includes(field))return;const value=e.detail.value===''?'':Number(e.detail.value);const next={...this.data,[field]:value};this.setData({[field]:value,error:'',teamError:teams.validate(next.total,next.catsCount,next.miceCount),targetCount:Number.isInteger(next.miceCount)&&next.miceCount>0?Math.ceil(next.miceCount*.6):0});},
  useNativeMap(){const index=catalog.options.findIndex(x=>x.id==='native-gcj02-v1');if(this.data.mapId!=='native-gcj02-v1')this.selectVenueMap({detail:{value:index}});this.openVenueEditor();},
  selectVenuePill(e){this.selectVenueMap({detail:{value:Number(e.currentTarget.dataset.index)}});},
  selectVenueMap(e){if(this.data.roomId||this.data.loading)return;const item=catalog.options[Number(e.detail.value)];if(!item)return;const image=catalog.get(item.id);if(this.devPreview&&this.previewRoom)this.previewRoom.venue=null;this.setData({mapId:image.id,venueMapIndex:Number(e.detail.value),nativeOnly:!!image.nativeOnly,venueName:image.label,venueSource:image.src,venueThumb:VENUE_THUMBS[image.id]||'',venueResource:'ready',venue:null,error:''});},
  loadVenueArt(){const image=catalog.get(this.data.mapId),run=this.venueResourceSerial=(this.venueResourceSerial||0)+1;if(!image)return;if(resources.ready(image.id)){if(this.data.venueResource!=='ready')this.setData({venueResource:'ready'});return;}if(this.data.venueResource!=='loading')this.setData({venueResource:'loading'});resources.ensure(image.id).then(()=>{if(this.active&&run===this.venueResourceSerial)this.setData({venueResource:'ready'});},e=>{if(this.active&&run===this.venueResourceSerial)this.setData({venueResource:'error',error:e.message});});},
  chooseVenue(){if(catalog.get(this.data.mapId)?.nativeOnly){this.openVenueEditor();return;}if(this.data.venue?.boundary){this.openVenueEditor();return;}const id=this.data.mapId;if(this.devPreview){const image=catalog.get(id),p=image.demoPoints?.[0]||{lat:32.0584,lng:118.7968};this.setData({venue:{...p,mapId:id,radiusM:200,confirmed:true},venueSummaryText:'活动范围：半径 200 米',error:'',needSetting:false});return;}const run=this.lifecycle;wx.getLocation({type:'gcj02',isHighAccuracy:true,success:p=>{if(!this.active||run!==this.lifecycle||id!==this.data.mapId)return;const point={lat:p.latitude,lng:p.longitude};if(!catalog.contains(id,point)){this.setData({venue:null,needSetting:false,error:'当前位置不在所选场地范围，请切换场地或改用地图框选'});return;}this.setData({venue:{...point,mapId:id,radiusM:200,confirmed:true},venueSummaryText:'活动范围：半径 200 米',error:'',needSetting:false});},fail:()=>{if(this.active&&run===this.lifecycle&&id===this.data.mapId)this.setData({error:'无法获取位置，请先授权定位',needSetting:true});}});},
  async create() { const teamError=teams.validate(this.data.total,this.data.catsCount,this.data.miceCount);if(teamError){this.setData({teamError,error:teamError});return;}if(this.devPreview){if(!this.data.venue){this.setData({error:'请先确认演示场地'});return;}const sample=preview.roomData('ready');sample.venue={...this.data.venue,mapId:this.data.mapId};sample.rules={...sample.rules,total:this.data.total,cats:this.data.catsCount,mice:this.data.miceCount,version:'pilot-0.3'};sample.mouseTeamVision=!!this.data.mouseTeamVision;sample.roster=Array.from({length:this.data.total},(_,i)=>({id:i?'dev-player-'+i:'dev-me',nickname:i?'成员'+i:'我 · 演示',ready:true}));this.applyRoom(sample);this.creating=false;wx.pageScrollTo?.({scrollTop:0,duration:0});return;}if (this.data.loading) return; this.setData({loading:true,error:''}); try { if(!this.data.venue) throw Error('请先确认集合点与活动范围'); if(typeof api.session==='function') await api.session(); const createInput={ ...(this.data.mapId!==catalog.DEFAULT_ID?{mapId:this.data.mapId}:{}),total:this.data.total, cats:this.data.catsCount, mice:this.data.miceCount, venue:this.data.venue,mapRevision:catalog.get(this.data.mapId).sha256,...(this.data.venue.boundary?{venueFormat:'polygon-v1'}:{}), nickname:wx.getStorageSync('nickname') };const fingerprint=JSON.stringify(createInput);if(!this.createCommand||this.createCommand.fingerprint!==fingerprint)this.createCommand={fingerprint,commandId:'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==='x'?r:(r&3|8)).toString(16);})};const r=await api.create({...createInput,commandId:this.createCommand.commandId}); if(this.data.mouseTeamVision&&typeof api.room==='function'&&typeof api.settings==='function'){try{const snap=await api.room(r.roomId);if(snap?.version!==undefined)await api.settings(r.roomId,{commandId:'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const n=Math.floor(Math.random()*16);return(c==='x'?n:(n&3|8)).toString(16);}),expectedVersion:snap.version,mouseTeamVision:true});}catch{}} wx.setStorageSync('v2RoomId',r.roomId); this.setData({roomId:r.roomId,code:r.code});wx.pageScrollTo?.({scrollTop:0,duration:0});this.updateTitle(); this.begin(); } catch(e) { this.setData({error:e.code==='INVALID_CONFIG'&&this.data.venue?.boundary?'服务端尚未支持多边形范围，请更新服务后重试':e.code==='INVALID_CONFIG'&&this.data.mapId!==catalog.DEFAULT_ID?'服务端尚未支持校区地图，请更新服务后重试':e.message}); } finally { this.setData({loading:false}); } },
  updateLocationSignal(){if(!this.active)return;const key=wx.getStorageSync('v2UserId')+'/'+this.data.roomId;if(this.qualityKey!==key){this.qualityKey=key;this.locationQuality=null;}this.setData({locationSignal:presentation.locationSignal(this.locationQuality)});},
  requestLocation() { this.updateLocationSignal();if(this.locationPromise)return this.locationPromise;const run=this.lifecycle;const task=location.once(this.data.roomId,()=>this.active && run===this.lifecycle,sample=>{if(this.active&&run===this.lifecycle){this.locationQuality=sample;this.updateLocationSignal();}});this.locationPromise=task;task.then(()=>{if(this.locationPromise===task)this.locationPromise=null;},()=>{if(this.locationPromise===task)this.locationPromise=null;});return task; },
  begin() { if(!this.active||this.pollTimer||this.socket)return;this.refresh();this.startPolling();this.startSocket();if(!this.locTimer)this.locTimer=setInterval(()=>this.requestLocation().catch(()=>{}),4000);this.requestLocation().catch(()=>{if(this.active)this.setData({error:'定位不可用，暂时不能准备',needSetting:true});}); },
  startPolling(){if(this.active&&!this.pollTimer)this.pollTimer=setInterval(()=>this.refresh(),2000);},
  poll(){return this.refresh();},
  startSocket:liveRoom.startSocket,socketDropped:liveRoom.socketDropped,scheduleReconnect:liveRoom.scheduleReconnect,
  receiveSnapshot(s){this.acceptRoom(s);},
  acceptRoom(s){
    if(!this.active||s?.viewerId&&s.viewerId!==wx.getStorageSync('v2UserId')||!shouldApplyRoom(this.lastSnapshot,s))return;
    this.lastSnapshot={viewerId:s.viewerId,roomId:s.roomId,version:s.version,serverTime:s.serverTime};
    const own=s.roster.find(x=>x.id===wx.getStorageSync('v2UserId'));
    this.applyRoom({code:s.code,roster:s.roster,rules:s.rules,owner:s.owner,ready:!!own?.ready,match:s.match,matchVersion:s.version,venue:s.venue,mouseTeamVision:!!s.settings?.mouseTeamVision,trackRecordingSupported:!!s.settings,error:'',connection:this.socketOpen?'实时连接':'轮询同步'});
    this.updateLocationSignal();
    if(s.match&&!['FINISHED','CANCELLED'].includes(s.match.phase)){this.stop();wx.redirectTo({url:'/pages/map/map?roomId='+encodeURIComponent(this.data.roomId)});}
  },
  async refresh() { if(this.fetching||!this.active)return;this.fetching=true;const run=this.lifecycle,serial=this.fetchSerial=(this.fetchSerial||0)+1;try{const s=await api.room(this.data.roomId);if(!this.active||run!==this.lifecycle||serial!==this.fetchSerial)return;this.acceptRoom(s);}catch(e){if(this.active&&run===this.lifecycle&&serial===this.fetchSerial){this.setData({error:'连接中断，正在自动重试：'+e.message});if(e.code==='UNAUTHENTICATED'||e.code==='NOT_MEMBER'){this.stop();this.setData({connection:'身份失效',error:e.message});}}}finally{if(serial===this.fetchSerial)this.fetching=false;} },
  async toggleReady() { tapHaptic();if(this.devPreview){const ready=!this.data.ready;this.applyRoom({ready,roster:this.data.roster.map(p=>p.id==='dev-me'?{...p,ready}:p),error:'',needSetting:false});return;}try { await this.requestLocation();if(!this.active)return;await api.ready(this.data.roomId,!this.data.ready); await this.refresh(); } catch(e) { if(this.active)this.setData({error:'准备失败：'+e.message,needSetting:/auth|deny|denied|permission|location|定位/i.test(e?.code||e?.message||'')}); } },
  async start() { if(!this.data.owner || !this.data.canStart || this.data.loading)return;if(this.devPreview){wx.navigateTo({url:'/pages/map/map?devPreview=hiding&mapId='+encodeURIComponent(this.data.mapId)});return;}this.setData({loading:true,error:''}); try { await api.start(this.data.roomId); this.refresh(); } catch(e) { this.setData({error:'无法开始：'+e.message}); } finally { this.setData({loading:false}); } },
  openVenueEditor(){if(this.data.loading||this.data.roomId&&(!this.data.owner||this.data.match&&!['FINISHED','CANCELLED'].includes(this.data.match.phase)))return;const roomId=this.data.roomId,mapId=this.data.mapId;wx.navigateTo({url:'/field-editor/pages/edit/edit?mapId='+encodeURIComponent(mapId)+(roomId&&!this.devPreview?'&roomId='+encodeURIComponent(roomId):'')+(this.devPreview?'&devPreview=venueEditor':''),events:{venueSaved:r=>{if(this.unloaded||roomId!==this.data.roomId||mapId!==this.data.mapId)return;this.applyRoom({venue:r.venue,error:roomId?'场地已更新，请全员重新定位准备':''});if(roomId){if(this.devPreview)this.applyRoom({ready:false,roster:this.data.roster.map(p=>({...p,ready:false}))});else this.refresh();}}},success:r=>r.eventChannel?.emit('init',{mapId,venue:this.data.venue})});},
  venueSummary(v){return v?.boundary?v.boundary.length+'点范围 · '+Math.round(venueGeometry.area(v.boundary))+'㎡':v?'半径 '+v.radiusM+'m':'未设范围';},
  openConfigSheet(){
    tapHaptic();
    const canEditVenue=this.data.owner&&(!this.data.match||['FINISHED','CANCELLED'].includes(this.data.match.phase));
    const items=[{id:'rules',label:'规则说明',hint:'计时、补入与隐私'}];
    if(canEditVenue)items.push({id:'venue',label:'修改场地范围',hint:'重选边界或集合点'});
    if(!this.data.nativeOnly&&canEditVenue)items.push({id:'calibrate',label:'地图标定',hint:'控制点地理配准'});
    items.push({id:'settings',label:'视野与轨迹',hint:'鼠队视野'+(this.data.mouseTeamVision?'共享':'独立')});
    this.setData({configSheetOpen:true,configSheetItems:items});
  },
  closeConfigSheet(){this.setData({configSheetOpen:false});},
  onSelectConfig(e){const id=e.detail?.id;this.closeConfigSheet();if(id==='rules')this.openRulesModal();else if(id==='venue')this.openVenueEditor();else if(id==='calibrate')this.openCalibration();else if(id==='settings')this.openSettings();},
  openRulesModal(){this.setData({rulesModalOpen:true});},
  closeRulesModal(){this.setData({rulesModalOpen:false});},
  openInviteSheet(){if(this.data.code)this.setData({inviteSheetOpen:true});},
  closeInviteSheet(){this.setData({inviteSheetOpen:false});},
  openCalibration(){if(!this.data.owner||catalog.get(this.data.mapId)?.nativeOnly)return;wx.navigateTo({url:this.devPreview?'/pages/calibrate/calibrate?devPreview=calibrate&mapId='+encodeURIComponent(this.data.mapId):'/pages/calibrate/calibrate?roomId='+encodeURIComponent(this.data.roomId)});},
  invite(){this.closeInviteSheet();if(this.devPreview){this.setData({error:'真实房间创建后可生成邀请二维码'});return;}if(this.data.roomId&&this.data.code)wx.navigateTo({url:'/room-tools/pages/invite/invite?roomId='+encodeURIComponent(this.data.roomId)});},
  copy() { if(!this.data.code)return;tapHaptic();this.closeInviteSheet();if(this.devPreview){this.setData({copyTip:'预览模式'});return;}wx.setClipboardData({data:this.data.code});this.setData({copyTip:'已复制'});try{clearTimeout(this.copyResetTimer);}catch{}this.copyResetTimer=typeof setTimeout==='function'?setTimeout(()=>{if(this.active)this.setData({copyTip:''});},2000):null; },
  openSettings(){if(this.devPreview){this.setData({error:'活动配置仅对真实房间保存；请创建房间后查看'});return;}if(this.data.roomId)wx.navigateTo({url:'/room-tools/pages/settings/settings?roomId='+encodeURIComponent(this.data.roomId)});},
  backToDev(){if(this.devPreview)wx.reLaunch({url:'/pages/dev/dev'});},
  onShareAppMessage() { if(this.devPreview)return {title:'猫鼠行动 · 界面预览',path:'/pages/index/index'};return {title:'加入猫鼠行动户外活动',path:'/pages/index/index?roomCode='+encodeURIComponent(this.data.code)}; }
});
