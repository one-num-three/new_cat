const catalog=require('./venue-catalog');
function enabled() {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion === 'develop';
  } catch { return false; }
}

const cases = [
  { id:'home', title:'首页与加入', path:'/pages/index/index?devPreview=home' },
  { id:'create', title:'创建活动', path:'/pages/room/room?devPreview=create' },
  { id:'ready', title:'房间准备', path:'/pages/room/room?devPreview=ready' },
  { id:'cat', title:'猫队追逐地图', path:'/pages/map/map?devPreview=cat' },
  { id:'mouse', title:'鼠队追逐地图', path:'/pages/map/map?devPreview=mouse' },
  { id:'alert', title:'鼠队近距预警', path:'/pages/map/map?devPreview=alert' },
  { id:'hiding', title:'躲藏阶段', path:'/pages/map/map?devPreview=hiding' },
  { id:'code', title:'动态码', path:'/pages/qrcode/qrcode?devPreview=code' },
  { id:'captured', title:'被捕状态', path:'/pages/map/map?devPreview=captured' },
  { id:'paused', title:'暂停状态', path:'/pages/map/map?devPreview=paused' },
  { id:'offline', title:'断线重连', path:'/pages/map/map?devPreview=offline' },
  { id:'catWin', title:'猫队胜利', path:'/pages/map/map?devPreview=catWin' },
  { id:'mouseWin', title:'鼠队胜利', path:'/pages/map/map?devPreview=mouseWin' },
  { id:'cancelled', title:'取消结算', path:'/pages/map/map?devPreview=cancelled' }
];

function accepts(id) { return enabled() && cases.some(item => item.id === id); }

function mapSnapshot(id, me, mapId=catalog.DEFAULT_ID) {
  const image=catalog.get(mapId)||catalog.get();
  const now = Date.now(), isMouse = ['mouse','alert','captured','mouseWin'].includes(id);
  const phase = id === 'hiding' ? 'HIDING' : id === 'paused' ? 'PAUSED' : id === 'catWin' || id === 'mouseWin' ? 'FINISHED' : id === 'cancelled' ? 'CANCELLED' : 'CHASING';
  const role = isMouse ? 'mouse' : 'cat';
  const roster = [{id:me,nickname:'我 · 演示',role,status:id==='captured'?'captured':'active',presence:id==='offline'?'reconnecting':'online'}];
  const names=['小橘','小米','阿青','可可','小林','圆圆','阿川'];
  for(let i=0;i<7;i++)roster.push({id:'dev-player-'+i,nickname:names[i],role:i<(isMouse?2:1)?'cat':'mouse',status:'active',presence:'online'});
  const captured=phase==='HIDING'?0:id==='catWin'?4:id==='mouseWin'?3:1;
  let left=captured-(id==='captured'?1:0);
  for(const player of roster)if(player.id!==me && player.role==='mouse' && left>0){player.status='captured';left--;}
  const live = !['captured','paused','offline','catWin','mouseWin','cancelled'].includes(id);
  const ally=roster.find(p=>p.id!==me && p.role===role && p.status==='active');
  // Synthetic demo positions converted from v5 art pixels; NOT collected GPS.
  let visiblePositions = live ? [{id:me,lat:32.07189947570167,lng:118.79328555598251,accuracy:6,receivedAt:now},{id:ally.id,lat:32.071253703521435,lng:118.79377318547276,accuracy:8,receivedAt:now}] : [];
  if(image.demoPoints)visiblePositions=visiblePositions.map((p,i)=>({...p,...image.demoPoints[(i+1)%image.demoPoints.length]}));
  const venue={...(image.demoPoints?.[0]||{lat:32.07224684915245,lng:118.79229703521882}),radiusM:200,mapId:image.id};
  const clue=image.demoPoints?.[2]||{lat:32.07109902484551,lng:118.79329199312038};
  const eventAt=new Date(2026,9,12,9,0).getTime();
  const events=[{seq:1,kind:'START',at:eventAt}];
  if(phase!=='HIDING')events.push({seq:2,kind:'CHASING',at:eventAt+30000});
  for(let i=0;i<captured;i++)events.push({seq:events.length+1,kind:'CAPTURE',at:eventAt+120000+i*20000});
  if(phase==='PAUSED')events.push({seq:events.length+1,kind:'PAUSE',at:eventAt+150000});
  if(phase==='FINISHED'||phase==='CANCELLED')events.push({seq:events.length+1,kind:'RESULT',at:eventAt+390000});
  return {version:1,serverTime:now,venue,owner:true,roster,visiblePositions,
    intel:id==='cat'?[{cellLat:clue.lat,cellLng:clue.lng,radiusM:50}]:[],nearbyCat:id==='alert',
    events,
    match:{id:'dev-preview-match',phase,myRole:role,myStatus:id==='captured'?'captured':'active',remainingMs:phase==='HIDING'?18000:phase==='CHASING'||phase==='PAUSED'?285000:0,captured,target:4,pauseReason:id==='paused'?'host':null,outcome:id==='catWin'?'cat_win':id==='mouseWin'?'mouse_win':null,reason:id==='catWin'?'capture_target':id==='mouseWin'?'deadline':id==='cancelled'?'cancelled':null}};
}

function roomData(id) {
  if(id==='create')return {roomId:'',total:8,venue:{lat:32.0584,lng:118.7968,radiusM:200,confirmed:true}};
  return {roomId:'dev-preview-room',code:'A1B2C3D4E5',owner:true,ready:true,rules:{total:8,cats:2,mice:6,hidingMs:30000,chasingMs:360000},
    roster:['我 · 演示','小橘','小米','阿青','可可','小林','圆圆','阿川'].map((nickname,i)=>({id:i?'dev-player-'+i:'dev-me',nickname,ready:true})),match:null};
}

const groups=[{"title": "活动准备", "items": [{"id": "home", "label": "首页与加入", "icon": "home", "tone": "green", "symbol": "⌂"}, {"id": "create", "label": "创建活动", "icon": "round", "tone": "green", "symbol": "+"}, {"id": "ready", "label": "房间准备", "icon": "friends", "tone": "orange", "symbol": "●"}]}, {"title": "游戏进行", "items": [{"id": "cat", "label": "猫队地图", "icon": "roleCat", "tone": "orange", "symbol": ""}, {"id": "mouse", "label": "鼠队地图", "icon": "roleMouse", "tone": "green", "symbol": ""}, {"id": "alert", "label": "近距预警", "icon": "round", "tone": "orange", "symbol": "!"}, {"id": "hiding", "label": "躲藏阶段", "icon": "bush", "tone": "green", "symbol": "●"}, {"id": "code", "label": "动态码", "icon": "code", "tone": "blue", "symbol": "▦"}]}, {"title": "异常状态", "items": [{"id": "captured", "label": "本轮出局", "icon": "roleMouse", "tone": "gray", "symbol": ""}, {"id": "paused", "label": "暂停", "icon": "round", "tone": "orange", "symbol": "Ⅱ"}, {"id": "offline", "label": "断线重连", "icon": "network", "tone": "green", "symbol": "⌁"}]}, {"title": "本局结果", "items": [{"id": "catWin", "label": "猫队胜利", "icon": "roleCat", "tone": "orange", "symbol": ""}, {"id": "mouseWin", "label": "鼠队胜利", "icon": "roleMouse", "tone": "green", "symbol": ""}, {"id": "cancelled", "label": "取消结算", "icon": "cancel", "tone": "gray", "symbol": "⊘"}]}];
module.exports = {enabled,accepts,cases,groups,mapSnapshot,roomData};
