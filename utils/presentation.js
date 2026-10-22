const venueCatalog=require('./venue-catalog');
// Display-only projection: authority stays in authenticated server snapshots.
function metrics() {
  let w={}, capsule={}, base={};
  try { w=wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); capsule=wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : {}; base=wx.getAppBaseInfo ? wx.getAppBaseInfo() : {}; } catch {}
  const statusHeight=w.statusBarHeight || 20;
  const navHeight=capsule.bottom ? capsule.bottom+Math.max(4,capsule.top-statusHeight) : statusHeight+44;
  return {navHeight,statusHeight,viewportHeight:w.windowHeight||844,viewportWidth:w.windowWidth||390,safeBottom:w.safeArea?Math.max(0,w.screenHeight-w.safeArea.bottom):0,fontScale:Math.min(1.3,Math.max(1,(base.fontSizeSetting||16)/16))};
}
function project(s,offline=false) {
  const m=s.match || {}, terminal=['FINISHED','CANCELLED'].includes(m.phase);
  const live=!offline && !terminal && m.myStatus==='active' && m.phase==='CHASING';
  const roster=s.roster || [];
  const mice=s.rules?.mice ?? roster.filter(p=>p.role==='mouse').length;
  const state=terminal?(m.outcome==='cat_win'?'catWin':m.outcome==='mouse_win'?'mouseWin':'cancelled'):offline?'offline':m.myStatus==='joining'?'joining':m.myStatus==='left'?'left':m.phase==='PAUSED'?'paused':m.myStatus==='captured'?'captured':m.phase==='HIDING'?'hiding':m.myRole==='cat'?'cat':'mouse';
  const scenes={hiding:'hiding-scene',paused:'paused-scene',offline:'offline-hero',catWin:'catwin-hero',mouseWin:'mousewin-hero',cancelled:'cancelled-hero'};
  const venueMapId=s.venue?.mapId||venueCatalog.DEFAULT_ID,image=venueCatalog.get(venueMapId);
  const art=scenes[state]?'/assets/pixel-v1/'+scenes[state]+'.png':'';
  // The uncalibrated v3 artwork is a public guide, never a geographic overlay.
  return {uiState:state,venueMapId,venueName:image?.label||'场地地图',parkArt:image?.src||'',stateArt:art,roleArt:'/assets/pixel-v1/role-'+(m.myRole==='cat'?'cat':'mouse')+'.png',terminal,canScan:live&&m.myRole==='cat',canShowCode:live&&m.myRole==='mouse',canResume:!offline&&m.phase==='PAUSED'&&!!s.owner,canReplay:!offline&&terminal,initialMice:mice,resultSummary:terminal&&m.phase!=='CANCELLED'?'捕获 '+m.captured+' / '+mice+' 人'+(m.outcome==='mouse_win'?'，未达目标':''):'这局记录保留，下一轮使用新的对局',cats:roster.filter(p=>p.role==='cat'),mice:roster.filter(p=>p.role==='mouse')};
}
function eventTime(at) {
  if(!Number.isFinite(at))return '—';
  const d=new Date(at);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}
function resize(e={}) {
  const m=metrics(),s=e.size||{};
  if(Number.isFinite(s.windowWidth)&&s.windowWidth>0)m.viewportWidth=s.windowWidth;
  if(Number.isFinite(s.windowHeight)&&s.windowHeight>0)m.viewportHeight=s.windowHeight;
  return m;
}
// A UI scale derived from the platform's accuracy estimate, not satellite RSSI.
// It never grants preparation/capture rights; the server still validates them.
function locationSignal(sample,options={}){
  const now=options.now??Date.now(),accuracy=sample?.accuracy,valid=Number.isFinite(accuracy)&&accuracy>0,age=Number.isFinite(sample?.at)?Math.max(0,now-sample.at):Infinity;
  const precision=valid?(accuracy>999?'>999m':'±'+Math.ceil(accuracy)+'m'):'',base={level:0,tone:'muted',text:'定位中',detail:'正在等待定位，请保持微信前台。',precision,ageSeconds:Number.isFinite(age)?Math.floor(age/1000):null};
  const state=(text,detail)=>({...base,text,detail});
  if(options.stopped)return state('已停止','本轮定位已停止；出局、退出或结算后不会继续采集。');
  if(options.offline)return state('未同步','连接中断，地图旧位置已隐藏。恢复连接后重新同步。');
  const issue=String(sample?.issue||'');
  if(/auth|deny|denied|permission|authorize|privacy/i.test(issue))return state('未授权','请在小程序及系统设置中检查定位权限。');
  if(!valid)return state(issue?'无定位':'定位中',issue?'尚未获取有效定位，请到开阔处检查定位权限和网络。':base.detail);
  if(age>5000||sample.at>now+1000)return state('已过期','最近一次精度估计为'+precision+'，已超过5秒未更新；不能用旧位置判断当前状态。');
  if(issue==='OUTSIDE_VENUE')return state('范围外','定位精度估计为'+precision+'，服务端判定在活动范围外，请核对边界并返回场内。');
  if(issue==='LOCATION_JUMP')return state('待稳定','定位精度估计为'+precision+'，发生位置跳变，请停下等待稳定。');
  if(issue==='STALE_LOCATION')return state('待更新','服务器已有更新的位置，本次旧样本不重复采用，请等待下一次定位。');
  if(issue==='INVALID_LOCATION'&&accuracy<=25)return state('待校验','定位精度估计为'+precision+'，但样本未通过服务端校验，请等待下一次定位。');
  if(issue&&issue!=='INVALID_LOCATION')return state('未同步','定位精度估计为'+precision+'，上报未确认，请检查网络并等待同步。');
  const level=accuracy<=5?4:accuracy<=10?3:accuracy<=25?2:1,tone=level>=3?'good':level===2?'fair':'weak';
  return {...base,level,tone,text:precision,detail:level+' / 4格，定位精度估计为'+precision+'，'+base.ageSeconds+'秒前更新。'+(accuracy>25?'超过25米，本次不用于准备和抓捕，请到开阔处等待稳定。':(sample.accepted===null?'本次正在同步。':'')+'数值越小越好；实际误差可能更大，准备和抓捕仍由服务端校验。')};
}
module.exports={metrics,project,eventTime,resize,locationSignal};

