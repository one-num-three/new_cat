const presentation=require('../../../utils/presentation');
const tapHaptic=(type='light')=>{try{if(typeof wx!=='undefined'&&'vibrateShort' in wx)wx.vibrateShort({type});}catch{}};
const TTL_MS=7*24*3600*1000;
function formatDate(ts){
  const d=new Date(Number(ts)||Date.now());
  const pad=n=>String(n).padStart(2,'0');
  return `${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function enrich(list){
  const now=Date.now();
  return (Array.isArray(list)?list:[]).map(item=>{
    const outcome=item.outcome==='cat_win'?'猫队胜':item.outcome==='mouse_win'?'鼠队胜':'已取消';
    const outcomeTone=item.outcome==='cat_win'?'sdvBadgeAmber':item.outcome==='mouse_win'?'sdvBadgeGreen':'sdvBadgeGray';
    const fresh=Number.isFinite(item.endedAt)?(now-item.endedAt<=TTL_MS):true;
    const trackValid=fresh&&item.trackVersion==='tracks-v1';
    const canPoster=trackValid&&!item.nativeOnly;
    return {
      ...item,
      dateText:formatDate(item.endedAt),
      roleText:item.myRole==='cat'?'猫队':'鼠队',
      outcomeLabel:outcome,
      outcomeTone,
      trackValid,
      canPoster
    };
  });
}
Page({
  data:{fontScale:1,navHeight:64,viewportWidth:390,viewportHeight:844,safeBottom:0,nightMode:false,records:[],totalCount:0,winCount:0,captureSum:0,clearModalOpen:false},
  onLoad(){this.setData(presentation.metrics());},
  onShow(){
    let nightMode=false,raw=[];
    try{
      if(typeof wx!=='undefined'&&'getStorageSync' in wx){
        nightMode=wx.getStorageSync('sdvTheme')==='night';
        raw=wx.getStorageSync('v2MatchHistory');
      }
    }catch{}
    const records=enrich(raw);
    const winCount=records.filter(r=>(r.myRole==='cat'&&r.outcome==='cat_win')||(r.myRole==='mouse'&&r.outcome==='mouse_win')).length;
    const captureSum=records.reduce((acc,r)=>acc+(Number(r.captured)||0),0);
    this.setData({nightMode,records,totalCount:records.length,winCount,captureSum});
  },
  onResize(e){this.setData(presentation.resize(e));},
  openTracks(e){
    tapHaptic();
    const id=e.currentTarget.dataset.id,owner=e.currentTarget.dataset.owner;
    if(!id)return;
    wx.navigateTo({url:'/room-tools/pages/tracks/tracks?matchId='+encodeURIComponent(id)+'&scope='+(owner?'all':'self')});
  },
  openPoster(e){
    tapHaptic();
    const id=e.currentTarget.dataset.id;
    if(!id)return;
    wx.navigateTo({url:'/room-tools/pages/share/share?matchId='+encodeURIComponent(id)});
  },
  promptClear(){tapHaptic();this.setData({clearModalOpen:true});},
  closeClear(){this.setData({clearModalOpen:false});},
  confirmClear(){
    tapHaptic();
    try{if(typeof wx!=='undefined'&&'removeStorageSync' in wx)wx.removeStorageSync('v2MatchHistory');}catch{}
    this.setData({records:[],totalCount:0,winCount:0,captureSum:0,clearModalOpen:false});
  },
  goHome(){tapHaptic();wx.navigateBack({delta:1,fail:()=>wx.reLaunch({url:'/pages/index/index'})});}
});
