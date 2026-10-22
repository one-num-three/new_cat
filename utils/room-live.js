// One native WebSocket lifecycle for the lobby and game. Snapshots remain role-authorized.
function create(api,wx,timers){const {setInterval,clearInterval,setTimeout,clearTimeout}=timers||globalThis;return {
 startSocket(){
  if(!(this.active||this.backgroundTracking)||this.socket||typeof wx.connectSocket!=='function')return;
  const base=api.config.wsUrl||(api.config.mode==='local'?api.config.baseUrl.replace(/^http/,'ws'):'');
  if(!base)return;
  try{
   const viewer=wx.getStorageSync('v2UserId'),connection=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
   const task=wx.connectSocket({url:base+'/api/v2/live?room='+encodeURIComponent(this.data.roomId)+'&connection='+connection,header:{Authorization:'Bearer '+wx.getStorageSync('v2Token')},success(){},fail(){}});
   this.socket=task;this.socketOpen=false;
   task.onOpen(()=>{
    if(!(this.active||this.backgroundTracking)||this.socket!==task)return;
    this.socketOpen=true;this.reconnectAttempt=0;clearTimeout(this.reconnectTimer);this.reconnectTimer=null;
    clearInterval(this.pollTimer);this.pollTimer=null;clearInterval(this.heartbeatTimer);this.lastFrameAt=Date.now();
    this.heartbeatTimer=setInterval(()=>{if(!(this.active||this.backgroundTracking)||this.socket!==task)return;if(Date.now()-this.lastFrameAt>7000){this.socketDropped(task);try{task.close();}catch{}return;}try{task.send({data:'PING',fail:()=>this.socketDropped(task)});}catch{this.socketDropped(task);}},5000);
    this.setData({connection:'实时连接'});
   });
   task.onMessage(e=>{if(!(this.active||this.backgroundTracking)||this.socket!==task)return;try{const msg=JSON.parse(e.data);if(msg.type==='SNAPSHOT'&&msg.payload){const current=wx.getStorageSync('v2UserId'),own=msg.payload.roster?.find(p=>p.id===current),m=msg.payload.match;if(viewer!==current||msg.payload.viewerId&&msg.payload.viewerId!==current||!own||m&&((own.role??null)!==(m.myRole??null)||(own.status??null)!==(m.myStatus??null))){this.socketDropped(task);return;}this.lastFrameAt=Date.now();this.receiveSnapshot(msg.payload);}}catch{}});
   task.onClose(()=>this.socketDropped(task));
   task.onError(()=>{this.socketDropped(task);try{task.close();}catch{}});
  }catch{if(this.active)this.startPolling();this.scheduleReconnect();}
 },
 socketDropped(task){
  if(this.socket!==task)return;this.socket=null;this.socketOpen=false;clearInterval(this.heartbeatTimer);this.heartbeatTimer=null;try{task.close();}catch{}
  if(!(this.active||this.backgroundTracking))return;this.setData({connection:'轮询恢复中'});if(this.active){this.startPolling();this.poll();}this.scheduleReconnect();
 },
 scheduleReconnect(){
  if(!(this.active||this.backgroundTracking)||this.socket||this.reconnectTimer)return;
  const delay=Math.min(30000,1000*2**Math.min(this.reconnectAttempt||0,5))+Math.floor(Math.random()*300);
  this.reconnectAttempt=(this.reconnectAttempt||0)+1;this.reconnectTimer=setTimeout(()=>{this.reconnectTimer=null;this.startSocket();},delay);
 }
};}
module.exports={create};
