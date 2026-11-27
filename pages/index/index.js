const presentation=require('../../utils/presentation');
const api = require('../../utils/v2');
const invitation=require('../../utils/qr-protocol');
const preview = require('../../utils/dev-preview');
const tapHaptic=(type='light')=>{try{if(typeof wx!=='undefined'&&'vibrateShort' in wx)wx.vibrateShort({type});}catch{}};
const FUN_NAMES=['小橘','田鼠','松果','青苔','风铃','溪石','橡果','星露','草帽','露珠','树莓','薄荷','山雀','麦穗','云朵','向日葵'];
Page({
  onResize(e) { this.setData(presentation.resize(e)); },
  data: { fontScale:1, nickname:'', editingName:false, code:'', clipCode:'', loading:false, error:'', resumeKind:'', devAvailable:false, devPreview:false, guideOpen:false, nightMode:false },
  onLoad(options={}) { this.unloaded=false;this.setData({...presentation.metrics(),code:invitation.launch(options),inviteHint:invitation.launch(options)?'已填邀请码，点下方加入':''}); this.devPreview=preview.accepts(options.devPreview);this.setData({devPreview:this.devPreview,devAvailable:preview.enabled()}); },
  async onShow() {
    if(this.devPreview){this.setData({nickname:'',editingName:false,code:'',clipCode:'',resumeKind:''});return;}
    try{if(typeof wx!=='undefined'&&'getStorageSync' in wx){const n=wx.getStorageSync('sdvTheme')==='night';if(n!==!!this.data.nightMode)this.setData({nightMode:n});}}catch{}
    this.setData({ nickname: wx.getStorageSync('nickname') || '', editingName:false });
    if(!this.data.code){try{if(typeof wx!=='undefined'&&'getClipboardData' in wx)wx.getClipboardData({success:r=>{if(this.unloaded)return;const m=String(r?.data||'').trim().toUpperCase().match(/\b([0-9A-F]{10})\b/);this.setData({clipCode:m&&m[1]!==this.data.code?m[1]:''});},fail:()=>{}});}catch{}}
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
  openGuide(){tapHaptic();this.setData({guideOpen:true});},
  closeGuide(){this.setData({guideOpen:false});},
  toggleNightMode(){tapHaptic();const next=!this.data.nightMode;this.setData({nightMode:next});try{if(typeof wx!=='undefined'&&'setStorageSync' in wx)wx.setStorageSync('sdvTheme',next?'night':'day');}catch{}},
  randomNickname(){tapHaptic();const cur=(this.data.nickname||'').trim();const pool=FUN_NAMES.filter(n=>n!==cur);const next=pool[Math.floor(Math.random()*pool.length)]||FUN_NAMES[0];this.setData({nickname:next,error:''});if(!this.devPreview){try{if(typeof wx!=='undefined'&&'setStorageSync' in wx)wx.setStorageSync('nickname',next);}catch{}}},
  pasteClipCode(){if(!this.data.clipCode)return;tapHaptic();this.setData({code:this.data.clipCode,clipCode:'',inviteHint:'已填入剪贴板房间码',error:''});},
  joinOrScan(){if(this.data.code.trim()||this.devPreview)this.join();else this.scanInvite();},
  scanInvite(){if(this.data.loading||this.scanning)return;tapHaptic();if(this.devPreview){this.setData({error:'演示模式不使用相机，请在真实首页扫码'});return;}this.scanning=true;wx.scanCode({scanType:['qrCode'],success:r=>{if(this.unloaded)return;try{this.setData({code:invitation.readInvite(r),clipCode:'',inviteHint:'已填邀请码，点下方加入',error:''});}catch(e){this.setData({error:e.message});}},fail:e=>{if(!this.unloaded&&!/cancel/.test(e.errMsg||''))this.setData({error:'扫码未完成，请检查相机权限'});},complete:()=>{this.scanning=false;}});},
  startEditName(){tapHaptic();this.setData({editingName:true});},
  finishEditName(){if((this.data.nickname||'').trim())this.setData({editingName:false});},
  nameInput(e) { this.setData({ nickname:e.detail.value }); }, codeInput(e) { const code=e.detail.value.toUpperCase();this.setData({ code, clipCode:code?'':this.data.clipCode }); },
  async prepare() { if(this.devPreview)return this.data.nickname.trim() || '演示成员';const nickname=this.data.nickname.trim(); if (!nickname) throw Error('请先填写你的称呼'); wx.setStorageSync('nickname',nickname); await api.session(); return nickname; },
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
    tapHaptic();
    if(this.data.resumeKind==='unavailable'){this.onShow();return;}
    wx.navigateTo({url:(this.data.resumeKind==='room'?'/pages/room/room?roomId=':'/pages/map/map?roomId=')+encodeURIComponent(id)});
  },
  openDev(){if(preview.enabled())wx.navigateTo({url:'/pages/dev/dev'});},
  openVenue(){tapHaptic();wx.navigateTo({url:'/pages/venue/venue'});},
  backToDev(){if(this.devPreview)wx.reLaunch({url:'/pages/dev/dev'});}
});
