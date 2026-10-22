const presentation=require('../../utils/presentation');
const api = require('../../utils/v2');
const invitation=require('../../utils/qr-protocol');
const preview = require('../../utils/dev-preview');
Page({
  onResize(e) { this.setData(presentation.resize(e)); },
  data: { fontScale:1, nickname:'', code:'', loading:false, error:'', resumeKind:'', devAvailable:false, devPreview:false },
  onLoad(options={}) { this.unloaded=false;this.setData({...presentation.metrics(),code:invitation.launch(options),inviteHint:invitation.launch(options)?'已收到邀请，填写昵称后加入':''}); this.devPreview=preview.accepts(options.devPreview);this.setData({devPreview:this.devPreview,devAvailable:preview.enabled()}); },
  async onShow() {
    if(this.devPreview){this.setData({nickname:'',code:'',resumeKind:''});return;}
    this.setData({ nickname: wx.getStorageSync('nickname') || '' });
    const roomId = wx.getStorageSync('v2RoomId');
    if (!roomId) { this.setData({resumeKind:''}); return; }
    const requestId=this.resumeRequestId=(this.resumeRequestId||0)+1;
    this.setData({resumeKind:'checking'});
    try {
      await api.session(); const s=await api.room(roomId);
      if(requestId!==this.resumeRequestId)return;
      this.setData({resumeKind:!s.match?'room':['FINISHED','CANCELLED'].includes(s.match.phase)?'result':'match'});
    } catch(e) { if(requestId===this.resumeRequestId)this.setData({resumeKind:'unavailable'}); }
  },
  onUnload(){this.unloaded=true;this.resumeRequestId=(this.resumeRequestId||0)+1;},
  scanInvite(){if(this.data.loading||this.scanning)return;if(this.devPreview){this.setData({error:'演示不使用相机，请在真实首页扫码'});return;}this.scanning=true;wx.scanCode({scanType:['qrCode'],success:r=>{if(this.unloaded)return;try{this.setData({code:invitation.readInvite(r),inviteHint:'已识别邀请，填写昵称后加入',error:''});}catch(e){this.setData({error:e.message});}},fail:e=>{if(!this.unloaded&&!/cancel/.test(e.errMsg||''))this.setData({error:'扫码未完成，请检查相机权限'});},complete:()=>{this.scanning=false;}});},
  nameInput(e) { this.setData({ nickname:e.detail.value }); }, codeInput(e) { this.setData({ code:e.detail.value.toUpperCase() }); },
  async prepare() { if(this.devPreview)return this.data.nickname.trim() || '演示玩家';const nickname=this.data.nickname.trim(); if (!nickname) throw Error('请输入昵称'); wx.setStorageSync('nickname',nickname); await api.session(); return nickname; },
  async create() {
    if(this.devPreview){wx.navigateTo({url:'/pages/room/room?devPreview=create'});return;}
    if (this.data.loading) return; this.setData({loading:true,error:''});
    try { await this.prepare(); wx.navigateTo({url:'/pages/room/room?mode=create'}); }
    catch(e) { this.setData({error:e.message || '连接失败'}); } finally { this.setData({loading:false}); }
  },
  async join() {
    if(this.devPreview){wx.navigateTo({url:'/pages/room/room?devPreview=ready'});return;}
    if (this.data.loading) return; this.setData({loading:true,error:''});
    try { const nickname=await this.prepare(); const code=this.data.code.trim(); if (!/^[0-9A-F]{10}$/.test(code)) throw Error('请输入10位房间码'); const joined=await api.join(code,nickname);const id=joined?.roomId||code;wx.setStorageSync('v2RoomId',id);if(!this.unloaded)wx.navigateTo({url:'/pages/room/room?roomId='+encodeURIComponent(id)}); }
    catch(e) { this.setData({error:e.message || '加入失败'}); } finally { this.setData({loading:false}); }
  },
  restore() {
    if(this.devPreview)return;
    const id=wx.getStorageSync('v2RoomId'); if(!id || this.data.resumeKind==='checking')return;
    if(this.data.resumeKind==='unavailable'){this.onShow();return;}
    wx.navigateTo({url:(this.data.resumeKind==='room'?'/pages/room/room?roomId=':'/pages/map/map?roomId=')+encodeURIComponent(id)});
  },
  openDev(){if(preview.enabled())wx.navigateTo({url:'/pages/dev/dev'});},
  openVenue(){wx.navigateTo({url:'/pages/venue/venue'});},
  backToDev(){if(this.devPreview)wx.reLaunch({url:'/pages/dev/dev'});}
});
