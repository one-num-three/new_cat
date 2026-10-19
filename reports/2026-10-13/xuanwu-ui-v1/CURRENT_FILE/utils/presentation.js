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
  const state=terminal?(m.outcome==='cat_win'?'catWin':m.outcome==='mouse_win'?'mouseWin':'cancelled'):offline?'offline':m.phase==='PAUSED'?'paused':m.myStatus==='captured'?'captured':m.phase==='HIDING'?'hiding':m.myRole==='cat'?'cat':'mouse';
  const scenes={hiding:'hiding-scene',paused:'paused-scene',offline:'offline-hero',catWin:'catwin-hero',mouseWin:'mousewin-hero',cancelled:'cancelled-hero'};
  const art=scenes[state]?'/assets/pixel-v1/'+scenes[state]+'.png':'';
  // The uncalibrated v3 artwork is a public guide, never a geographic overlay.
  return {uiState:state,parkArt:'/assets/maps/xuanwu-lake-v3.png',stateArt:art,roleArt:'/assets/pixel-v1/role-'+(m.myRole==='cat'?'cat':'mouse')+'.png',terminal,canScan:live&&m.myRole==='cat',canShowCode:live&&m.myRole==='mouse',canResume:!offline&&m.phase==='PAUSED'&&!!s.owner,canReplay:!offline&&terminal&&!!s.owner,initialMice:mice,resultSummary:terminal&&m.phase!=='CANCELLED'?'捕获 '+m.captured+' / '+mice+' 人'+(m.outcome==='mouse_win'?'，未达目标':''):'这局记录保留，下一轮使用新的对局',cats:roster.filter(p=>p.role==='cat'),mice:roster.filter(p=>p.role==='mouse')};
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
module.exports={metrics,project,eventTime,resize};

