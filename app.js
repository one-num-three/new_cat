// app.js
App({
  onLaunch() {
    console.log('[App 调试] ========================================');
    console.log('[App 调试] 猫鼠游戏小程序启动');
    console.log('[App 调试] 启动时间:', new Date().toISOString());
    
    // 初始化云开发（云托管模式需要）
    if (wx.cloud) {
      wx.cloud.init({
        env: 'prod-2g2i6z425323d612',  // 云环境 ID
        traceUser: true
      });
      console.log('[App 调试] 云开发初始化成功');
    } else {
      console.warn('[App 调试] 当前环境不支持云开发');
    }
    
    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync();
    console.log('[App 调试] 系统信息:', systemInfo);
    
    // 获取网络状态
    wx.getNetworkType({
      success: (res) => {
        console.log('[App 调试] 网络类型:', res.networkType);
      }
    });
    
    // 检查登录状态
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.isLoggedIn = true;
      console.log('[App 调试] 已登录用户:', userInfo);
    } else {
      console.log('[App 调试] 未登录');
    }
    
    console.log('[App 调试] 服务器地址:', this.globalData.serverUrl);
    console.log('[App 调试] ========================================');
  },

  globalData: {
    userInfo: null,
    isLoggedIn: false,
    gameId: null,
    gameStatus: null, // waiting, playing, ended
    playerRole: null, // cat or mouse
    playerId: null,
    roomId: null,
    qrCodePath: null,  // 二维码预缓存路径
    qrCodeData: null,  // 二维码数据
    pendingTaskReward: null, // 待领取的任务奖励
    qrCodeExpireTime: 0,  // 二维码过期时间
    
    // ========== 环境配置 ==========
    // 开发环境：使用 HTTP IP（真机调试时关闭域名校验）
    // 云托管环境：使用微信云托管（无需配置域名白名单）
    // 注意：云托管服务冷启动可能超时，开发测试建议使用 'dev' 模式
    env: 'cloud', // 'dev' | 'cloud'  <- 使用微信云托管
    
    // 云托管配置
    cloudEnv: 'prod-2g2i6z425323d612',
    cloudService: 'mousecat',
    
    // 服务器地址
    // dev 模式：阿里云 HTTP（真机调试需关闭域名校验）
    // cloud 模式：微信云托管（无需域名白名单）
    serverUrl: 'http://118.178.85.214:4001',
    
    mapConfig: {
      latitude: 32.0584, // 默认东南大学坐标
      longitude: 118.7968,
      scale: 16
    }
  }
})
