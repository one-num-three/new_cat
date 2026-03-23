// utils/api.js - 服务器 API 调用封装（支持微信云托管）

// 云托管配置
const CLOUD_ENV = 'prod-2g2i6z425323d612';
const CLOUD_SERVICE = 'mousecat';

// 基础请求封装（支持云托管）
function request(options) {
  const app = getApp();
  const env = app?.globalData?.env || 'cloud';
  const isCloud = env === 'cloud';
  
  console.log('[API 调试] ========================================');
  console.log('[API 调试] 环境:', isCloud ? '微信云托管' : '本地开发');
  console.log('[API 调试] 请求路径:', options.url);
  console.log('[API 调试] 请求方法:', options.method || 'GET');
  console.log('[API 调试] 请求数据:', options.data);
  console.log('[API 调试] ========================================');
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    if (isCloud) {
      // 云托管模式：使用 wx.cloud.callContainer
      // 注意：云托管服务冷启动可能需要较长时间，设置 30 秒超时
      wx.cloud.callContainer({
        config: {
          env: CLOUD_ENV
        },
        path: options.url,
        header: {
          'X-WX-SERVICE': CLOUD_SERVICE,
          'Content-Type': 'application/json',
          'Authorization': wx.getStorageSync('token') || ''
        },
        method: options.method || 'GET',
        data: options.data || {},
        timeout: 30000,  // 30 秒超时，适应冷启动
        success: (res) => {
          handleSuccess(res, startTime, resolve, reject);
        },
        fail: (err) => {
          // 如果是超时错误，尝试重试一次
          if (err.errMsg && err.errMsg.includes('102002')) {
            console.log('[API 调试] 云托管超时，正在重试...');
            wx.showToast({ title: '服务冷启动中，请稍候...', icon: 'loading', duration: 2000 });
            
            // 延迟 2 秒后重试
            setTimeout(() => {
              wx.cloud.callContainer({
                config: { env: CLOUD_ENV },
                path: options.url,
                header: {
                  'X-WX-SERVICE': CLOUD_SERVICE,
                  'Content-Type': 'application/json'
                },
                method: options.method || 'GET',
                data: options.data || {},
                timeout: 30000,
                success: (res) => {
                  handleSuccess(res, startTime, resolve, reject);
                },
                fail: (err2) => {
                  handleFail(err2, startTime, reject);
                }
              });
            }, 2000);
          } else {
            handleFail(err, startTime, reject);
          }
        }
      });
    } else {
      // 开发模式：使用普通 wx.request
      const fullUrl = app.globalData.serverUrl + options.url;
      
      wx.request({
        url: fullUrl,
        method: options.method || 'GET',
        data: options.data || {},
        header: {
          'Content-Type': 'application/json',
          'Authorization': wx.getStorageSync('token') || ''
        },
        success: (res) => {
          handleSuccess(res, startTime, resolve, reject);
        },
        fail: (err) => {
          handleFail(err, startTime, reject);
        }
      });
    }
  });
}

// 处理成功响应
function handleSuccess(res, startTime, resolve, reject) {
  const duration = Date.now() - startTime;
  console.log('[API 调试] 响应成功 ========================================');
  console.log('[API 调试] 状态码:', res.statusCode);
  console.log('[API 调试] 耗时:', duration + 'ms');
  console.log('[API 调试] 响应数据:', res.data);
  console.log('[API 调试] ========================================');
  
  if (res.statusCode === 200) {
    const data = res.data;
    if (data.success === false) {
      console.error('[API 调试] 业务错误:', data.message);
      wx.showToast({ title: data.message || '请求失败', icon: 'none' });
      reject(new Error(data.message));
    } else {
      resolve(data);
    }
  } else if (res.statusCode === 401) {
    console.error('[API 调试] 未授权');
    wx.showToast({ title: '请先登录', icon: 'none' });
    wx.navigateTo({ url: '/pages/profile/profile' });
    reject(new Error('未登录'));
  } else {
    console.error('[API 调试] HTTP 错误:', res.statusCode);
    reject(new Error(res.data?.message || '请求失败'));
  }
}

// 处理失败响应
function handleFail(err, startTime, reject) {
  const duration = Date.now() - startTime;
  console.error('[API 调试] 请求失败 ========================================');
  console.error('[API 调试] 错误信息:', err);
  console.error('[API 调试] 耗时:', duration + 'ms');
  console.error('[API 调试] ========================================');
  
  let errorMsg = '网络错误';
  if (err.errMsg && err.errMsg.includes('timeout')) {
    errorMsg = '请求超时，请检查网络';
  } else if (err.errMsg && err.errMsg.includes('fail')) {
    errorMsg = '连接失败：' + err.errMsg;
  }
  wx.showToast({ title: errorMsg, icon: 'none', duration: 3000 });
  reject(err);
}

// 游戏相关 API
export const gameAPI = {
  // 创建房间
  createRoom(data) {
    return request({ url: '/api/game/room', method: 'POST', data });
  },
  
  // 加入房间
  joinRoom(roomId, playerId, nickname, role, isOwner) {
    return request({ 
      url: `/api/game/room/${roomId}`, 
      method: 'POST',
      data: { playerId, nickname, role, isOwner }
    });
  },
  
  // 获取房间信息
  getRoomInfo(roomId) {
    return request({ url: `/api/game/room/${roomId}` });
  },
  
  // 更新房间设置
  updateRoomSettings(roomId, settings) {
    const playerId = getApp().globalData.playerId;
    return request({ 
      url: `/api/game/room/${roomId}/settings`, 
      method: 'PUT',
      data: { playerId, settings }
    });
  },
  
  // 开始游戏
  startGame(roomId, playerId) {
    return request({ 
      url: `/api/game/room/${roomId}/start`, 
      method: 'POST',
      data: { playerId }
    });
  },
  
  // 获取游戏状态
  getGameStatus(gameId) {
    return request({ url: `/api/game/${gameId}/status` });
  },
  
  // 更新位置
  updateLocation(gameId, playerId, latitude, longitude) {
    return request({ 
      url: `/api/game/${gameId}/location`, 
      method: 'POST', 
      data: { playerId, latitude, longitude }
    });
  },
  
  // 使用道具
  useItem(gameId, playerId, itemId, targetId) {
    return request({ 
      url: `/api/game/${gameId}/item`, 
      method: 'POST', 
      data: { playerId, itemId, targetId }
    });
  },
  
  // 结束游戏
  endGame(gameId, winner) {
    return request({ 
      url: `/api/game/${gameId}/end`, 
      method: 'POST',
      data: { winner }
    });
  },
  
  // 扫码抓住老鼠（传递位置避免多实例数据不同步）
  catchPlayer(gameId, catcherId, caughtId, catcherLat, catcherLng, caughtLat, caughtLng) {
    return request({ 
      url: `/api/game/${gameId}/catch`, 
      method: 'POST',
      data: { 
        catcherId, 
        caughtId,
        catcherLat,
        catcherLng,
        caughtLat,
        caughtLng
      }
    });
  },
  
  // 离开游戏（掉线）
  leaveGame(gameId, playerId) {
    return request({ 
      url: `/api/game/${gameId}/leave`, 
      method: 'POST',
      data: { playerId }
    });
  }
};

// 用户相关 API
export const userAPI = {
  // 微信登录
  login(code) {
    return request({ url: '/api/user/login', method: 'POST', data: { code } });
  },
  
  // 获取用户信息
  getUserInfo() {
    return request({ url: '/api/user/profile' });
  },
  
  // 更新用户信息
  updateUserInfo(data) {
    return request({ url: '/api/user/profile', method: 'PUT', data });
  }
};

// 系统相关 API
export const systemAPI = {
  // 获取服务器版本
  getVersion() {
    return request({ url: '/api/version' });
  }
};

// 游戏历史 API
export const historyAPI = {
  // 获取游戏历史
  getHistory(userId) {
    return request({ url: `/api/game/history/${userId}` });
  }
};

export default request;