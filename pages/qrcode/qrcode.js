const presentation=require('../../utils/presentation');
const api=require('../../utils/v2'); const loc=require('../../utils/location-v2'); const preview=require('../../utils/dev-preview');
const proof=require('../../utils/capture-proof').create(api,wx);
Page({
  onResize(e) { this.setData(presentation.resize(e)); },
  data:{fontScale:1,roomId:'',image:'',seconds:0,error:'',devPreview:false},
  onLoad(o){this.setData(presentation.metrics());this.devPreview=preview.accepts(o.devPreview);if(o.devPreview && !this.devPreview){this.previewDenied=true;wx.reLaunch({url:'/pages/index/index'});return;}this.setData({roomId:this.devPreview?'dev-preview-room':o.roomId,devPreview:this.devPreview});},
  onShow(){if(this.previewDenied)return;this.active=true;this.lifecycle=(this.lifecycle||0)+1;if(this.devPreview){this.setData({image:'',seconds:15,error:''});return;}this.expiresAt=0;this.nextRetryAt=0;this.setData({image:'',seconds:0,error:''});this.checkStatus();this.refresh();clearInterval(this.timer);clearInterval(this.statusTimer);this.timer=setInterval(()=>{if(!this.active)return;if(!this.expiresAt){if(!this.refreshing && Date.now()>=this.nextRetryAt)this.refresh();return;}const seconds=Math.max(0,Math.ceil((this.expiresAt-Date.now())/1000));this.setData({seconds});if(seconds<=2 && !this.refreshing)this.refresh();},1000);this.statusTimer=setInterval(()=>this.checkStatus(),3000);},
  onHide(){this.stop(!this.devPreview&&!!loc.canBackground?.(this.data.roomId,loc.status?.().matchId));},onUnload(){this.stop();},
  removeImage:proof.removeImage,
  stopProof(){this.stop();},
  stop(keepTracking=false){this.active=false;this.lifecycle=(this.lifecycle||0)+1;clearInterval(this.timer);clearInterval(this.statusTimer);this.timer=null;this.statusTimer=null;this.expiresAt=0;if(!this.devPreview&&!keepTracking)loc.stop();this.removeImage(this.imagePath);this.imagePath=null;},
  async checkStatus(){
    if(!this.active || this.checking)return;
    this.checking=true;const lifecycle=this.lifecycle;
    try{
      const s=await api.room(this.data.roomId);
      if(!this.active || lifecycle!==this.lifecycle)return;
      const match=s.match;loc.syncMatch?.(s);
      if(match?.phase==='CHASING' && match.myStatus==='active' && match.myRole==='mouse'){loc.start(this.data.roomId,()=>{if(this.active)this.setData({error:'定位中断，请返回地图检查权限'});},{matchId:match.id,match,background:true,onStatus:state=>{if(this.active&&state.notice)this.setData({error:state.notice});}});return;}
      const message=match?.myStatus==='captured'?'你已被捕，请返回地图查看本局状态':match?.phase==='PAUSED'?'本局已暂停，请返回地图等待恢复':'本局状态已变化，请返回地图查看';
      this.stop();this.setData({image:'',seconds:0,error:message});
    }catch(e){if(this.active && lifecycle===this.lifecycle && (e.code==='UNAUTHENTICATED' || e.code==='NOT_MEMBER')){this.stop();this.setData({image:'',seconds:0,error:'房间身份已失效，请返回首页重新进入'});}}
    finally{this.checking=false;}
  },
  refresh:proof.refresh,
  backToDev(){if(this.devPreview)wx.reLaunch({url:'/pages/dev/dev'});},
  back(){if(this.devPreview)wx.redirectTo({url:'/pages/map/map?devPreview=mouse'});else wx.navigateBack();}
});
