const presentation=require('../../utils/presentation');
const api = require('../../utils/v2');
const invitation=require('../../utils/qr-protocol');
const preview = require('../../utils/dev-preview');
const tapHaptic=(type='light')=>{try{if(typeof wx!=='undefined'&&'vibrateShort' in wx)wx.vibrateShort({type});}catch{}};
const FUN_NAMES=['小橘','田鼠','松果','青苔','风铃','溪石','橡果','星露','草帽','露珠','树莓','薄荷','山雀','麦穗','云朵','向日葵'];
Page({
  onResize(e) { this.setData(presentation.resize(e)); },
  data: { navHeight:64, statusHeight:20, viewportWidth:390, viewportHeight:844, safeBottom:0, fontScale:1, nickname:'', editingName:false, code:'', inviteHint:'', clipCode:'', loading:false, error:'', resumeKind:'', devAvailable:false, devPreview:false, guideOpen:false, themeMode:'day', nightMode:false, consentAccepted:false, consentOpen:false, needWxPrivacy:false, privacyContractName:'《猫鼠行动小程序隐私保护指引》' },
  onLoad(options={}) { this.unloaded=false;const launchCode=invitation.launch(options);this.devPreview=preview.accepts(options.devPreview);this.setData({...presentation.metrics(),code:launchCode,inviteHint:launchCode?'已填邀请码，点下方加入':'',devPreview:this.devPreview,devAvailable:preview.enabled()}); },
  async onShow() {
    this._navigating=false;
    if(this.devPreview){this.setData({nickname:'',editingName:false,code:'',clipCode:'',resumeKind:''});return;}
    try{if(typeof wx!=='undefined'&&'getStorageSync' in wx){const raw=wx.getStorageSync('sdvTheme'),mode=raw==='night'||raw==='dusk'?raw:'day',n=mode!=='day',agreed=wx.getStorageSync('sdvSafetyPrivacyV1')==='1';if(mode!==this.data.themeMode||n!==!!this.data.nightMode||agreed!==!!this.data.consentAccepted)this.setData({themeMode:mode,nightMode:n,consentAccepted:agreed});}}catch{}
    if(typeof wx!=='undefined'&&'getPrivacySetting' in wx){try{wx.getPrivacySetting({success:r=>{if(!this.unloaded&&r)this.setData({needWxPrivacy:!!r.needAuthorization,privacyContractName:r.privacyContractName||'《猫鼠行动小程序隐私保护指引》'});},fail:()=>{}});}catch{}}
    this.setData({ nickname: wx.getStorageSync('nickname') || '', editingName:false });
    const roomId = wx.getStorageSync('v2RoomId');
    if (!roomId) { this.setData({resumeKind:''}); return; }
    const requestId=this.resumeRequestId=(this.resumeRequestId||0)+1;
    this.setData({resumeKind:'checking'});
    try {
      await api.session(); const s=await api.room(roomId);
      if(requestId!==this.resumeRequestId)return;
      this.setData({resumeKind:!s.match?'room':['FINISHED','CANCELLED'].includes(s.match.phase)?'result':'match'});
    } catch(e) {
      if(requestId!==this.resumeRequestId)return;
      if(['ROOM_NOT_FOUND','NOT_MEMBER','HTTP_404','HTTP_410'].includes(e?.code)){
        if(typeof wx!=='undefined'&&'removeStorageSync' in wx){try{wx.removeStorageSync('v2RoomId');}catch{}}
        this.setData({resumeKind:''});
      }else{
        this.setData({resumeKind:'unavailable'});
      }
    }
  },
  onUnload(){this.unloaded=true;this.resumeRequestId=(this.resumeRequestId||0)+1;},
  dismissResume(){tapHaptic();if(typeof wx!=='undefined'&&'removeStorageSync' in wx){try{wx.removeStorageSync('v2RoomId');}catch{}}this.setData({resumeKind:''});},
  openGuide(){tapHaptic();this.setData({guideOpen:true});},
  closeGuide(){this.setData({guideOpen:false});},
  openConsent(){tapHaptic();this.pendingConsentAction=null;this.setData({guideOpen:false,consentOpen:true});},
  closeConsent(){this.pendingConsentAction=null;if(this._privacyResolve){try{this._privacyResolve({event:'disagree'});}catch{}this._privacyResolve=null;}this.setData({consentOpen:false});},
  openWxPrivacy(){if(typeof wx!=='undefined'&&'openPrivacyContract' in wx){try{wx.openPrivacyContract({fail:()=>{}});}catch{}}},
  ensureConsent(action){
    if(this.devPreview||(this.data.consentAccepted&&!this.data.needWxPrivacy))return true;
    this.pendingConsentAction=action;
    this.setData({consentOpen:true,error:''});
    return false;
  },
  confirmConsent(){
    tapHaptic();
    const finish=()=>{
      const next=this.pendingConsentAction;this.pendingConsentAction=null;
      if(this._privacyResolve){try{this._privacyResolve({buttonId:'agree-btn',event:'agree'});}catch{}this._privacyResolve=null;}
      if(typeof wx!=='undefined'&&'setStorageSync' in wx){try{wx.setStorageSync('sdvSafetyPrivacyV1','1');}catch{}}
      this.setData({consentAccepted:true,needWxPrivacy:false,consentOpen:false,error:''});
      if(next==='create')this.create();
      else if(next==='join')this.join();
      else if(next==='scan')this.scanInvite();
      else if(next==='paste')this.readClipboardCode();
    };
    if(this.data.needWxPrivacy&&typeof wx!=='undefined'&&'requirePrivacyAuthorize' in wx){
      try{wx.requirePrivacyAuthorize({success:finish,fail:()=>{this.pendingConsentAction=null;if(this._privacyResolve){try{this._privacyResolve({event:'disagree'});}catch{}this._privacyResolve=null;}this.setData({consentOpen:false,error:'需先同意微信隐私保护指引才可使用定位和房间功能'});}});return;}catch{}
    }
    finish();
  },
  readClipboardCode(){
    if(!this.ensureConsent('paste'))return;
    tapHaptic();
    if(this.devPreview){this.setData({code:'A1B2C3D4E5',clipCode:'',inviteHint:'已填入演示房间码',error:''});return;}
    if(typeof wx==='undefined'||!('getClipboardData' in wx)){this.setData({error:'当前环境不支持读取剪贴板'});return;}
    wx.getClipboardData({
      success:r=>{
        if(this.unloaded)return;
        const m=String(r?.data||'').trim().toUpperCase().match(/\b([0-9A-F]{10})\b/);
        if(m)this.setData({code:m[1],clipCode:'',inviteHint:'已填入剪贴板房间码',error:''});
        else this.setData({error:'剪贴板中未检测到 10 位房间码'});
      },
      fail:()=>{if(!this.unloaded)this.setData({error:'无法读取剪贴板，请直接输入或扫码'});}
    });
  },
  toggleNightMode(){tapHaptic();const cur=this.data.themeMode||(this.data.nightMode?'night':'day');const next=cur==='day'?'dusk':cur==='dusk'?'night':'day';this.setData({themeMode:next,nightMode:next!=='day'});try{if(typeof wx!=='undefined'&&'setStorageSync' in wx)wx.setStorageSync('sdvTheme',next);}catch{}},
  randomNickname(){tapHaptic();const cur=(this.data.nickname||'').trim();const pool=FUN_NAMES.filter(n=>n!==cur);const next=pool[Math.floor(Math.random()*pool.length)]||FUN_NAMES[0];this.setData({nickname:next,error:''});if(!this.devPreview){try{if(typeof wx!=='undefined'&&'setStorageSync' in wx)wx.setStorageSync('nickname',next);}catch{}}},
  pasteClipCode(){if(!this.data.clipCode)return;tapHaptic();this.setData({code:this.data.clipCode,clipCode:'',inviteHint:'已填入剪贴板房间码',error:''});},
  joinOrScan(){if(this.data.code.trim()||this.devPreview)this.join();else this.scanInvite();},
  scanInvite(){if(this.data.loading||this.scanning)return;if(!this.ensureConsent('scan'))return;tapHaptic();if(this.devPreview){this.setData({error:'演示模式不使用相机，请在真实首页扫码'});return;}this.scanning=true;wx.scanCode({scanType:['qrCode'],success:r=>{if(this.unloaded)return;try{this.setData({code:invitation.readInvite(r),clipCode:'',inviteHint:'已填邀请码，点下方加入',error:''});}catch(e){this.setData({error:e.message});}},fail:e=>{if(!this.unloaded&&!/cancel/.test(e.errMsg||''))this.setData({error:'扫码未完成，请检查相机权限'});},complete:()=>{this.scanning=false;}});},
  startEditName(){tapHaptic();this.setData({editingName:true});},
  finishEditName(){const clean=(this.data.nickname||'').trim();if(clean){this.setData({nickname:clean,editingName:false});if(!this.devPreview&&typeof wx!=='undefined'&&'setStorageSync' in wx){try{wx.setStorageSync('nickname',clean);}catch{}}}},
  clearCode(){tapHaptic();this.setData({code:'',inviteHint:'',error:''});},
  nameInput(e) { this.setData({ nickname:e.detail.value }); }, codeInput(e) { const code=e.detail.value.toUpperCase();this.setData({ code, clipCode:code?'':this.data.clipCode }); },
  async prepare() { if(this.devPreview)return this.data.nickname.trim() || '演示成员';let nickname=this.data.nickname.trim(); if (!nickname){nickname=FUN_NAMES[Math.floor(Math.random()*FUN_NAMES.length)]||FUN_NAMES[0];this.setData({nickname,editingName:false});} wx.setStorageSync('nickname',nickname); await api.session(); return nickname; },
  async create() {
    if(!this.ensureConsent('create'))return;
    if(this.devPreview){wx.navigateTo({url:'/pages/room/room?devPreview=create'});return;}
    if (this.data.loading || this._navigating) return;
    this._navigating=true;
    let nickname=this.data.nickname.trim();
    if (!nickname){nickname=FUN_NAMES[Math.floor(Math.random()*FUN_NAMES.length)]||FUN_NAMES[0];this.setData({nickname,editingName:false});}
    try{wx.setStorageSync('nickname',nickname);}catch{}
    if(typeof api.session==='function'){try{const p=api.session();if(p&&typeof p.catch==='function')p.catch(()=>{});}catch{}}
    wx.navigateTo({url:'/pages/room/room?mode=create',complete:()=>{this._navigating=false;}});
  },
  async join() {
    if(!this.ensureConsent('join'))return;
    if(this.devPreview){wx.navigateTo({url:'/pages/room/room?devPreview=ready'});return;}
    if (this.data.loading) return; this.setData({loading:true,error:''});
    try { const nickname=await this.prepare(); const code=this.data.code.trim(); if (!/^[0-9A-F]{10}$/.test(code)) throw Error('请输入10位房间码'); const joined=await api.join(code,nickname);const id=joined?.roomId||code;wx.setStorageSync('v2RoomId',id);const target=joined?.status?'/pages/map/map?roomId=':'/pages/room/room?roomId=';if(!this.unloaded)wx.navigateTo({url:target+encodeURIComponent(id)}); }
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
  openHistory(){tapHaptic();wx.navigateTo({url:'/room-tools/pages/history/history'});},
  openVenue(){tapHaptic();wx.navigateTo({url:'/pages/venue/venue'});},
  backToDev(){if(this.devPreview)wx.reLaunch({url:'/pages/dev/dev'});}
});
