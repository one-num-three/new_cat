const presentation=require('../../utils/presentation');
const api=require('../../utils/v2'); const loc=require('../../utils/location-v2'); const preview=require('../../utils/dev-preview');
Page({
  onResize(e) { this.setData(presentation.resize(e)); },
  data:{roomId:'',image:'',seconds:0,error:'',devPreview:false},
  onLoad(o){this.setData(presentation.metrics());this.devPreview=preview.accepts(o.devPreview);if(o.devPreview && !this.devPreview){this.previewDenied=true;wx.reLaunch({url:'/pages/index/index'});return;}this.setData({roomId:this.devPreview?'dev-preview-room':o.roomId,devPreview:this.devPreview});},
  onShow(){if(this.previewDenied)return;this.active=true;this.lifecycle=(this.lifecycle||0)+1;if(this.devPreview){this.setData({image:'',seconds:15,error:''});return;}this.expiresAt=0;this.nextRetryAt=0;this.setData({image:'',seconds:0,error:''});loc.start(this.data.roomId,()=>{if(this.active)this.setData({error:'定位中断，请返回地图检查权限'});});this.refresh();clearInterval(this.timer);clearInterval(this.statusTimer);this.timer=setInterval(()=>{if(!this.active)return;if(!this.expiresAt){if(!this.refreshing && Date.now()>=this.nextRetryAt)this.refresh();return;}const seconds=Math.max(0,Math.ceil((this.expiresAt-Date.now())/1000));this.setData({seconds});if(seconds<=2 && !this.refreshing)this.refresh();},1000);this.statusTimer=setInterval(()=>this.checkStatus(),3000);},
  onHide(){this.stop();},onUnload(){this.stop();},
  removeImage(path){if(path)try{wx.getFileSystemManager().unlinkSync(path);}catch{}},
  stop(){this.active=false;this.lifecycle=(this.lifecycle||0)+1;clearInterval(this.timer);clearInterval(this.statusTimer);this.timer=null;this.statusTimer=null;this.expiresAt=0;if(!this.devPreview)loc.stop();this.removeImage(this.imagePath);this.imagePath=null;},
  async checkStatus(){
    if(!this.active || this.checking)return;
    this.checking=true;const lifecycle=this.lifecycle;
    try{
      const s=await api.room(this.data.roomId);
      if(!this.active || lifecycle!==this.lifecycle)return;
      const match=s.match;
      if(match?.phase==='CHASING' && match.myStatus==='active' && match.myRole==='mouse')return;
      const message=match?.myStatus==='captured'?'你已被捕，请返回地图查看本局状态':match?.phase==='PAUSED'?'本局已暂停，请返回地图等待恢复':'本局状态已变化，请返回地图查看';
      this.stop();this.setData({image:'',seconds:0,error:message});
    }catch(e){if(this.active && lifecycle===this.lifecycle && (e.code==='UNAUTHENTICATED' || e.code==='NOT_MEMBER')){this.stop();this.setData({image:'',seconds:0,error:'房间身份已失效，请返回首页重新进入'});}}
    finally{this.checking=false;}
  },
  async refresh(){
    if(this.refreshing || !this.active)return;
    this.refreshing=true;const lifecycle=this.lifecycle;
    try{
      const r=await api.token(this.data.roomId);
      if(!this.active || lifecycle!==this.lifecycle)return;
      if(!r.qrPngBase64 || !Number.isFinite(r.expiresAt) || r.expiresAt<=Date.now())throw Error('抓捕码已过期，请重试');
      this.fileSeq=(this.fileSeq||0)+1;
      const path=wx.env.USER_DATA_PATH+'/capture-'+r.expiresAt+'-'+this.fileSeq+'.png',previous=this.imagePath;
      wx.getFileSystemManager().writeFileSync(path,r.qrPngBase64,'base64');
      if(!this.active || lifecycle!==this.lifecycle){this.removeImage(path);return;}
      this.imagePath=path;this.expiresAt=r.expiresAt;this.nextRetryAt=0;
      this.setData({image:path,seconds:Math.ceil((r.expiresAt-Date.now())/1000),error:''});
      this.removeImage(previous);
    }catch(e){
      if(!this.active || lifecycle!==this.lifecycle)return;
      if(e.code==='TOKEN_UNAVAILABLE'){this.stop();this.setData({error:'无法生成抓捕码：'+e.message,image:'',seconds:0});return;}
      this.removeImage(this.imagePath);this.imagePath=null;this.expiresAt=0;this.nextRetryAt=Date.now()+3000;
      this.setData({error:'无法生成抓捕码：'+e.message,image:'',seconds:0});
    }finally{this.refreshing=false;}
  },
  backToDev(){if(this.devPreview)wx.reLaunch({url:'/pages/dev/dev'});},
  back(){if(this.devPreview)wx.redirectTo({url:'/pages/map/map?devPreview=mouse'});else wx.navigateBack();}
});
