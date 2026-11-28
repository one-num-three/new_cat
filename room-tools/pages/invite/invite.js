const api=require('../../../utils/v2'),presentation=require('../../../utils/presentation');
const tapHaptic=(type='light')=>{try{if(typeof wx!=='undefined'&&'vibrateShort' in wx)wx.vibrateShort({type});}catch{}};
function boostBrightness(ctx){return presentation.boostBrightness?.(ctx);}
function restoreBrightness(ctx){return presentation.restoreBrightness?.(ctx);}
Page({
 data:{fontScale:1,navHeight:64,themeMode:'day',nightMode:false,roomId:'',code:'',image:'',path:'/pages/index/index',error:'',loading:false,joinHint:'',copied:false},
 onLoad(o){this.serial=0;this.setData({...presentation.metrics(),roomId:o.roomId||''});},
 onShow(){this.active=true;this.serial++;try{if(typeof wx!=='undefined'&&'getStorageSync' in wx){const raw=wx.getStorageSync('sdvTheme'),mode=raw==='night'||raw==='dusk'?raw:'day',n=mode!=='day';if(mode!==this.data.themeMode||n!==!!this.data.nightMode)this.setData({themeMode:mode,nightMode:n});}}catch{}boostBrightness(this);this.load();},onHide(){this.stop();},onUnload(){this.stop();},
 onResize(e){this.setData(presentation.resize(e));},
 removeImage(){if(this.imagePath)try{wx.getFileSystemManager().unlinkSync(this.imagePath);}catch{}this.imagePath=null;},
 stop(){restoreBrightness(this);this.active=false;this.serial++;try{clearTimeout(this.copyTimer);}catch{}this.copyTimer=null;this.removeImage();this.setData({image:'',loading:false,copied:false});},
 async load(){if(this.data.loading||!this.active)return;if(!this.data.roomId){this.setData({error:'缺少房间参数，请返回重进'});return;}this.setData({loading:true,error:''});const run=this.serial;try{await api.session();const r=await api.invite(this.data.roomId);if(!this.active||run!==this.serial)return;if(!r.qrPngBase64||!/^[0-9A-F]{10}$/.test(r.code))throw Error('邀请数据无效，请重试');const safePath='/pages/index/index?roomCode='+r.code;let image='data:image/png;base64,'+r.qrPngBase64,written=null;try{if(typeof wx!=='undefined'&&wx.env?.USER_DATA_PATH&&'getFileSystemManager' in wx){const file=wx.env.USER_DATA_PATH+'/room-invite-'+Date.now()+'-'+run+'.png';wx.getFileSystemManager().writeFileSync(file,r.qrPngBase64,'base64');image=file;written=file;}}catch{}this.removeImage();this.imagePath=written;this.setData({image,code:r.code,path:safePath,joinHint:!r.canNewPlayerJoin?'房间已满，原成员仍可重连':r.lateJoin?'活动进行中；加入后自动分配分组，完成定位即可参与':'扫码或输入房间码加入当前活动'});}catch(e){if(this.active&&run===this.serial){this.removeImage();this.setData({image:'',code:'',error:'邀请暂不可用：'+e.message});}}finally{if(this.active&&run===this.serial)this.setData({loading:false});}},
 copy(){if(!this.data.code)return;tapHaptic();wx.setClipboardData({data:this.data.code});this.setData({copied:true});try{clearTimeout(this.copyTimer);}catch{}this.copyTimer=typeof setTimeout==='function'?setTimeout(()=>{if(this.active)this.setData({copied:false});},2000):null;},
 onShareAppMessage(){return {title:'邀请你加入猫鼠行动',path:this.data.code?this.data.path:'/pages/index/index'};}
});
