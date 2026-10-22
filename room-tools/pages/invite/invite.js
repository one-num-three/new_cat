const api=require('../../../utils/v2'),presentation=require('../../../utils/presentation');
Page({
 data:{fontScale:1,navHeight:64,roomId:'',code:'',image:'',path:'/pages/index/index',error:'',loading:false,joinHint:''},
 onLoad(o){this.serial=0;this.setData({...presentation.metrics(),roomId:o.roomId||''});},
 onShow(){this.active=true;this.serial++;this.load();},onHide(){this.stop();},onUnload(){this.stop();},
 onResize(e){this.setData(presentation.resize(e));},
 removeImage(){if(this.imagePath)try{wx.getFileSystemManager().unlinkSync(this.imagePath);}catch{}this.imagePath=null;},
 stop(){this.active=false;this.serial++;this.removeImage();this.setData({image:'',loading:false});},
 async load(){if(this.data.loading||!this.active)return;this.setData({loading:true,error:''});const run=this.serial;try{await api.session();const r=await api.invite(this.data.roomId);if(!this.active||run!==this.serial)return;if(!r.qrPngBase64||!/^[0-9A-F]{10}$/.test(r.code))throw Error('邀请数据无效，请重试');const file=wx.env.USER_DATA_PATH+'/room-invite-'+Date.now()+'-'+run+'.png';wx.getFileSystemManager().writeFileSync(file,r.qrPngBase64,'base64');this.removeImage();this.imagePath=file;this.setData({image:file,code:r.code,path:r.path,joinHint:!r.canNewPlayerJoin?'房间已满，原成员仍可重连':r.lateJoin?'本局进行中；加入后自动补入阵营，先定位再行动':'让伙伴扫码加入，一起准备'});}catch(e){if(this.active&&run===this.serial){this.removeImage();this.setData({image:'',code:'',error:'邀请暂不可用：'+e.message});}}finally{if(this.active&&run===this.serial)this.setData({loading:false});}},
 copy(){if(this.data.code)wx.setClipboardData({data:this.data.code});},
 onShareAppMessage(){return {title:'来加入猫鼠行动',path:this.data.code?this.data.path:'/pages/index/index'};}
});
