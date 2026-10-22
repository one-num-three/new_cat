const qr=require('./qr-protocol');
const uuid=()=> 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==='x'?r:(r&3|8)).toString(16);});
function create(api,location,wx){return {
 scan(){if(!this.data.canScan||this.data.loading||this.scanning||this.data.offline)return;if(this.devPreview){this.setData({error:'界面预览不使用相机；请返回调试台查看结算状态。'});return;}if(this.pendingCapture){this.retryCapture();return;}this.captureFeedback=null;this.setData({error:''});this.scanning=true;const roomId=this.data.roomId,matchId=this.data.match?.id;
  wx.scanCode({onlyFromCamera:true,scanType:['qrCode'],success:r=>{if(this.unloaded||!this.active||this.data.roomId!==roomId||this.data.match?.id!==matchId)return;try{const proof=qr.readCapture(r,roomId,matchId);this.pendingCapture={...proof,commandId:uuid(),roomId};this.submitCapture();}catch(e){this.captureFeedback={matchId,message:e.message};this.setData({error:e.message});}},fail:e=>{if(this.active&&!this.unloaded)this.setData({error:/cancel/.test(e.errMsg||'')?'已取消扫码':'相机不可用，请检查权限'});},complete:()=>{this.scanning=false;}});
 },
 retryCapture(){if(this.pendingCapture)return this.submitCapture();},
 async submitCapture(){const pending=this.pendingCapture;if(!pending||this.data.loading||this.data.offline||!this.active||this.unloaded)return;if(pending.roomId!==this.data.roomId||pending.matchId!==this.data.match?.id){this.pendingCapture=null;this.setData({captureRetry:false,error:'对局已变化，请重新扫码'});return;}this.captureFeedback=null;this.setData({loading:true,captureRetry:false,error:''});
  const current=()=>this.active&&!this.unloaded&&this.data.roomId===pending.roomId&&this.data.match?.id===pending.matchId;
  try{await location.once(pending.roomId,current);if(!current())return;const result=await api.capture(pending.roomId,{matchId:pending.matchId,token:pending.token,commandId:pending.commandId});if(!current())return;this.pendingCapture=null;this.setData({captureRetry:false});await this.poll();if(current())wx.showToast({title:result.accepted?'抓捕已记录':'状态已更新',icon:'success'});
  }catch(e){if(!current())return;const uncertain=!e.code||/^HTTP_5/.test(e.code)||e.code==='INTERNAL';if(!uncertain)this.pendingCapture=null;const message=uncertain?'确认结果暂未收到，请点重试确认；不要重复抓捕同一人':'抓捕未完成：'+e.message;this.captureFeedback={matchId:pending.matchId,message};this.setData({captureRetry:uncertain,error:message});if(!uncertain)await this.poll();}finally{if(current())this.setData({loading:false});}
 }
};}
module.exports={create};
