const config = require('./config');
let sessionPromise = null;
const messages={UNAUTHENTICATED:'登录失效，请返回首页重新进入',NOT_MEMBER:'你不在这个房间，请重新加入',ROOM_FULL:'房间已满',ROOM_NOT_FOUND:'房间码无效或房间已关闭',INVALID_PRESET:'人数不在试点预设内',INVALID_VENUE:'请重新确认场地',INVALID_VENUE_MAP:'场地地图无效，请重新选择',VENUE_MAP_MISMATCH:'集合点不在所选校区范围，请到场后确认',CALIBRATION_IMAGE_OR_CRS:'图片或坐标系不匹配，请从当前房间重新进入标定',NOT_READY:'人数未满或有人尚未定位准备',LOCATION_REQUIRED:'定位不新鲜或精度不足，请停下刷新定位',INVALID_LOCATION:'定位质量不足，请到开阔处重试',STALE_LOCATION:'位置已更新，请稍后重试',LOCATION_JUMP:'定位跳变过大，请等待稳定',OUTSIDE_VENUE:'已离开活动区域，请返回集合范围',INVALID_TOKEN:'抓捕码失效，请对方刷新后重试',ALREADY_CAPTURED:'这名鼠已被捕',NOT_CHASING:'当前不能抓捕，请查看本局状态',TOKEN_UNAVAILABLE:'当前无法展示抓捕码，请返回地图',FORBIDDEN:'没有此操作权限',IN_PROGRESS:'本局正在进行',NO_ACTIVE_MATCH:'本局已结束或不存在',LOGIN_UNAVAILABLE:'微信登录尚未配置'};
function request(method, path, data) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('v2Token');
    const success = res => {
      if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
      else { if(res.statusCode===401){wx.removeStorageSync('v2Token');wx.removeStorageSync('v2UserId');} const code=res.data?.error || `HTTP_${res.statusCode}`; const error=new Error(messages[code] || code);error.code=code;reject(error); }
    };
    const header = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    if (config.mode === 'cloud') wx.cloud.callContainer({ config: { env: config.cloudEnv }, path, method, data: data || {}, header: { ...header, 'X-WX-SERVICE': config.cloudService }, success, fail: reject });
    else wx.request({ url: config.baseUrl + path, method, data: data || {}, header, success, fail: reject, timeout: 10000 });
  });
}
function session() {
  const token=wx.getStorageSync('v2Token'), id=wx.getStorageSync('v2UserId');
  if(token && id) return Promise.resolve();
  if(sessionPromise) return sessionPromise;
  if(token || id){wx.removeStorageSync('v2Token');wx.removeStorageSync('v2UserId');}
  sessionPromise=(async()=>{
    let s;
    if (config.localTestIdentities) s = await request('POST', '/api/v2/session/test', {});
    else { const login = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject })); if(!login.code)throw Error('微信登录未返回授权码'); s = await request('POST', '/api/v2/session/wechat', { code: login.code }); }
    if(!s?.token || !s?.id)throw Error('服务端会话无效');
    wx.setStorageSync('v2Token', s.token); wx.setStorageSync('v2UserId', s.id);
  })().finally(()=>{sessionPromise=null;});
  return sessionPromise;
}
const p = id => `/api/v2/rooms/${encodeURIComponent(id)}`;
module.exports = { config, session, request, calibration:(id,d)=>request('PUT',p(id)+'/calibration',d), room: id => request('GET', p(id)), create: d => request('POST','/api/v2/rooms',d), join: (id,nickname) => request('POST',p(id)+'/join',{nickname}), location: (id,d) => request('POST',p(id)+'/location',d), ready: (id,ready) => request('POST',p(id)+'/ready',{ready}), start: id => request('POST',p(id)+'/start',{}), token: id => request('POST',p(id)+'/token',{}), capture: (id,d) => request('POST',p(id)+'/capture',d), pause: (id,reason) => request('POST',p(id)+'/pause',{reason}), resume: id => request('POST',p(id)+'/resume',{}), cancel: id => request('POST',p(id)+'/cancel',{}), leave: id => request('POST',p(id)+'/leave',{}) };
