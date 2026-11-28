const presentation=require('../../../utils/presentation');
const tapHaptic=(type='light')=>{try{if(typeof wx!=='undefined'&&'vibrateShort' in wx)wx.vibrateShort({type});}catch{}};
const TTL_MS=7*24*3600*1000;
function formatDate(ts){
  const n=Number(ts);
  if(!Number.isFinite(n))return '—';
  const d=new Date(n);
  const pad=v=>String(v).padStart(2,'0');
  return `${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function enrich(list,viewerId){
  const now=Date.now();
  return (Array.isArray(list)?list:[]).filter(item=>item&&typeof item==='object'&&(!item.viewerId||!viewerId||item.viewerId===viewerId)).map(item=>{
    const outcome=item.outcome==='cat_win'?'猫队胜':item.outcome==='mouse_win'?'鼠队胜':'已取消';
    const outcomeTone=item.outcome==='cat_win'?'sdvBadgeAmber':item.outcome==='mouse_win'?'sdvBadgeGreen':'sdvBadgeGray';
    const validEnd=Number.isFinite(item.endedAt);
    const fresh=validEnd?(now-item.endedAt<=TTL_MS):false;
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
  data:{fontScale:1,navHeight:64,viewportWidth:390,viewportHeight:844,safeBottom:0,themeMode:'day',nightMode:false,records:[],totalCount:0,winCount:0,captureSum:0,clearModalOpen:false},
  onLoad(){this.setData(presentation.metrics());},
  onShow(){
    let themeMode='day',nightMode=false,raw=[],viewerId='';
    try{
      if(typeof wx!=='undefined'&&'getStorageSync' in wx){
        const t=wx.getStorageSync('sdvTheme');
        themeMode=t==='night'||t==='dusk'?t:'day';
        nightMode=themeMode!=='day';
        viewerId=wx.getStorageSync('v2UserId')||'';
        raw=wx.getStorageSync('v2MatchHistory');
      }
    }catch{}
    let records=[];
    try{records=enrich(raw,viewerId);}catch{records=[];}
    const winCount=records.filter(r=>(r.myRole==='cat'&&r.outcome==='cat_win')||(r.myRole==='mouse'&&r.outcome==='mouse_win')).length;
    const captureSum=records.reduce((acc,r)=>{
      const v=Number.isFinite(Number(r.myTeamCaptured))?Number(r.myTeamCaptured):(r.myRole==='cat'?(Number(r.captured)||0):0);
      return acc+v;
    },0);
    this.setData({themeMode,nightMode,records,totalCount:records.length,winCount,captureSum});
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
    try{
      if(typeof wx!=='undefined'&&'getStorageSync' in wx){
        const viewerId=wx.getStorageSync('v2UserId')||'';
        const raw=wx.getStorageSync('v2MatchHistory');
        const kept=viewerId&&Array.isArray(raw)?raw.filter(item=>item&&typeof item==='object'&&item.viewerId&&item.viewerId!==viewerId):[];
        if(kept.length&&'setStorageSync' in wx)wx.setStorageSync('v2MatchHistory',kept);
        else if('removeStorageSync' in wx)wx.removeStorageSync('v2MatchHistory');
      }
    }catch{}
    this.setData({records:[],totalCount:0,winCount:0,captureSum:0,clearModalOpen:false});
  },
  goHome(){tapHaptic();wx.navigateBack({delta:1,fail:()=>wx.reLaunch({url:'/pages/index/index'})});}
});
