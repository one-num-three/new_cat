// pages/room/room.js - 房间等待页面
const { gameAPI } = require('../../utils/api');

Page({
  data: {
    roomId: '',
    roomInfo: null,
    players: [],
    isOwner: false,
    playerId: '',
    showSettingsModal: false,
    devMode: true, // 开发模式：允许选择身份，上线后改为 false
    selectedRole: '', // 用户选择的角色：'cat' 或 'mouse'
    tempSettings: {
      catCount: 1,
      mouseCount: 5,
      gameDuration: 10, // 分钟
      mapRange: 1000, // 米
      revealTime: 3, // 分钟
      visionRange: 200 // 米（默认 200）
    },
    gameSettings: {
      catCount: 1,
      mouseCount: 5,
      gameDuration: 600, // 10 分钟 = 600 秒
      mapRange: 1000, // 1000 米范围
      revealTime: 180, // 3 分钟 = 180 秒
      visionRange: 200 // 默认 200 米视野
    }
  },

  // 轮询定时器
  pollTimer: null,

  onLoad(options) {
    if (options.action === 'create') {
      this.setData({ isOwner: true });
    }
    else if (options.action === 'join' && options.roomId) {
      this.setData({
        roomId: options.roomId,
        playerId: options.playerId || ''
      });
      this.loadRoomInfo(options.roomId);
      this.startPolling();
    }
    else if (options.roomId) {
      this.setData({ roomId: options.roomId });
      this.loadRoomInfo(options.roomId);
      this.startPolling();
    }
  },

  onShow() {
    if (this.data.roomId) {
      this.loadRoomInfo(this.data.roomId);
      if (!this.pollTimer) {
        this.startPolling();
      }
    }
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  // ==================== 轮询机制 ====================

  startPolling() {
    if (this.pollTimer) return;
    console.log('[房间] 开始轮询房间状态');
    this.pollTimer = setInterval(() => {
      this.pollRoomStatus();
    }, 2000);
  },

  stopPolling() {
    if (this.pollTimer) {
      console.log('[房间] 停止轮询');
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  async pollRoomStatus() {
    if (!this.data.roomId) return;
    
    try {
      const res = await gameAPI.getRoomInfo(this.data.roomId);
      const prevPlayerCount = this.data.players.length;
      const newPlayerCount = (res.players || []).length;
      
      this.setData({
        players: res.players || [],
        roomInfo: res
      });
      
      if (prevPlayerCount !== newPlayerCount) {
        console.log(`[房间] 玩家数量变化: ${prevPlayerCount} -> ${newPlayerCount}`);
      }
      
      if (res.status === 'playing') {
        console.log('[房间] 检测到游戏已开始，准备跳转');
        this.stopPolling();
        this.navigateToGame(res);
      }
    } catch (err) {
      console.error('[房间] 轮询失败', err);
    }
  },

  navigateToGame(roomInfo) {
    const myPlayer = roomInfo.players.find(p => p.id === this.data.playerId);
    const playerRole = myPlayer?.role || 'mouse';
    
    wx.showModal({
      title: '🎮 游戏开始！',
      content: `你的身份是：${playerRole === 'cat' ? '🐱 猫' : '🐭 老鼠'}`,
      showCancel: false,
      success: () => {
        wx.redirectTo({
          url: `/pages/map/map?gameId=${this.data.roomId}&playerId=${this.data.playerId}&role=${playerRole}`
        });
      }
    });
  },

  async loadRoomInfo(roomId) {
    try {
      const res = await gameAPI.getRoomInfo(roomId);
      const currentPlayer = this.data.playerId ? res.players.find(p => p.id === this.data.playerId) : null;
      
      const durationText = res.settings && res.settings.gameDuration 
        ? (res.settings.gameDuration / 60) + '分钟' 
        : '10 分钟';
      const rangeText = res.settings && res.settings.mapRange 
        ? (res.settings.mapRange / 1000) + 'km' 
        : '1km';
      const revealTimeText = res.settings && res.settings.revealTime
        ? (res.settings.revealTime / 60) + '分钟'
        : '3 分钟';
      const visionRangeText = res.settings && res.settings.visionRange
        ? res.settings.visionRange + '米'
        : '800米';
      
      this.setData({ 
        roomInfo: res, 
        players: res.players || [],
        isOwner: this.data.isOwner || (currentPlayer && currentPlayer.isOwner),
        durationText: durationText,
        rangeText: rangeText,
        revealTimeText: revealTimeText,
        visionRangeText: visionRangeText
      });
    } catch (err) {
      console.error('加载房间失败', err);
      if (err.message && err.message.includes('房间不存在')) {
        wx.showModal({
          title: '房间不存在',
          content: '房间号错误或房间已过期，请检查后重试',
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
      }
    }
  },

  onEditSettings() {
    const settings = this.data.roomInfo.settings;
    this.setData({
      tempSettings: {
        catCount: settings.catCount || 1,
        mouseCount: settings.mouseCount || 5,
        gameDuration: (settings.gameDuration || 600) / 60,
        mapRange: settings.mapRange || 1000,
        revealTime: (settings.revealTime || 180) / 60,
        visionRange: settings.visionRange || 200
      },
      showSettingsModal: true
    });
  },

  onCloseSettingsModal() {
    this.setData({ showSettingsModal: false });
  },

  onIncrease(e) {
    const { field, min, max, step = 1 } = e.currentTarget.dataset;
    const value = this.data.tempSettings[field];
    const newValue = Math.min(max, value + step);
    this.setData({ [`tempSettings.${field}`]: newValue });
  },

  onDecrease(e) {
    const { field, min, max, step = 1 } = e.currentTarget.dataset;
    const value = this.data.tempSettings[field];
    const newValue = Math.max(min, value - step);
    this.setData({ [`tempSettings.${field}`]: newValue });
  },

  async onSaveSettings() {
    wx.showLoading({ title: '保存中...' });
    try {
      const settings = {
        catCount: this.data.tempSettings.catCount,
        mouseCount: this.data.tempSettings.mouseCount,
        gameDuration: this.data.tempSettings.gameDuration * 60,
        mapRange: this.data.tempSettings.mapRange,
        revealTime: this.data.tempSettings.revealTime * 60,
        visionRange: this.data.tempSettings.visionRange
      };
      
      await gameAPI.updateRoomSettings(this.data.roomId, settings);
      
      wx.hideLoading();
      wx.showToast({ title: '设置已保存', icon: 'success' });
      this.setData({ showSettingsModal: false });
      this.loadRoomInfo(this.data.roomId);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    }
  },

  async onCreateRoom() {
    if (this.data.devMode && !this.data.selectedRole) {
      console.log('[开发模式] 未选择身份，将由系统随机分配');
    }
    
    wx.showLoading({ title: '创建中...' });
    try {
      const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const nickname = wx.getStorageSync('nickname') || '玩家' + Math.floor(Math.random() * 10000);
      const res = await gameAPI.createRoom(this.data.gameSettings);
      await gameAPI.joinRoom(res.roomId, playerId, nickname, this.data.selectedRole, true);
      
      this.pregenerateQRCode(res.roomId, playerId);
      
      wx.hideLoading();
      wx.showToast({ title: '创建成功', icon: 'success' });
      
      this.setData({
        roomId: res.roomId,
        playerId: playerId
      });
      
      // 更新 globalData
      try {
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.playerId = playerId;
          app.globalData.roomId = res.roomId;
        }
      } catch (e) {
        console.log('[房间] 更新 globalData 失败', e);
      }
      
      await this.loadRoomInfo(res.roomId);
      this.startPolling();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '创建失败', icon: 'none' });
    }
  },

  async onJoinRoom() {
    if (!this.data.roomId) {
      wx.showToast({ title: '房间号无效', icon: 'none' });
      return;
    }
    
    if (this.data.playerId) {
      wx.showToast({ title: '你已在房间中', icon: 'none' });
      return;
    }
    
    if (this.data.devMode && !this.data.selectedRole) {
      console.log('[开发模式] 未选择身份，将由系统随机分配');
    }
    
    wx.showLoading({ title: '验证中...' });
    try {
      await gameAPI.getRoomInfo(this.data.roomId);
    } catch (err) {
      wx.hideLoading();
      wx.showModal({
        title: '房间不存在',
        content: '房间号错误或房间已过期，请检查后重试',
        showCancel: false
      });
      return;
    }
    
    wx.showLoading({ title: '加入中...' });
    try {
      const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const nickname = wx.getStorageSync('nickname') || '玩家' + Math.floor(Math.random() * 10000);
      const res = await gameAPI.joinRoom(this.data.roomId, playerId, nickname, this.data.selectedRole);
      
      this.pregenerateQRCode(this.data.roomId, playerId);
      
      wx.hideLoading();
      wx.showToast({ title: '加入成功', icon: 'success' });
      
      this.setData({ 
        playerId: playerId,
        players: res.players || []
      });
      
      // 更新 globalData
      try {
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.playerId = playerId;
        }
      } catch (e) {
        console.log('[房间] 更新 globalData 失败', e);
      }
      
      await this.loadRoomInfo(this.data.roomId);
      this.startPolling();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '加入失败', icon: 'none' });
    }
  },

  pregenerateQRCode(roomId, playerId) {
    const qrData = {
      gameId: roomId,
      playerId: playerId,
      role: 'mouse',
      nickname: '我'
    };
    
    const qrText = JSON.stringify(qrData);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&color=000000&data=${encodeURIComponent(qrText)}`;
    
    // 预加载二维码图片
    wx.downloadFile({
      url: qrCodeUrl,
      success: (res) => {
        console.log('[二维码] 预加载成功:', res.tempFilePath);
        try {
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.qrCodePath = res.tempFilePath;
            app.globalData.qrCodeData = qrData;
          }
        } catch (e) {
          console.log('[二维码] 保存到 globalData 失败', e);
        }
      },
      fail: (err) => {
        console.log('[二维码] 预加载失败，将在游戏时重新生成', err);
      }
    });
    
    console.log('[二维码] 预生成完成');
  },

  async onStartGame() {
    if (this.data.players.length < 1) {
      wx.showToast({ title: '至少需要 1 名玩家', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '游戏开始中...' });
    try {
      const res = await gameAPI.startGame(this.data.roomId, this.data.playerId);
      wx.hideLoading();
      
      this.stopPolling();
      
      const player = res.players.find(p => p.id === this.data.playerId);
      const playerRole = player?.role || 'mouse';
      
      wx.showModal({
        title: '🎮 游戏开始！',
        content: `你的身份是：${playerRole === 'cat' ? '🐱 猫' : '🐭 老鼠'}`,
        showCancel: false,
        success: () => {
          wx.redirectTo({
            url: `/pages/map/map?gameId=${this.data.roomId}&playerId=${this.data.playerId}&role=${playerRole}`
          });
        }
      });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '开始失败', icon: 'none' });
    }
  },

  onShareAppMessage() {
    return {
      title: '来玩猫鼠游戏！快加入我',
      path: `/pages/room/room?action=join&roomId=${this.data.roomId}`
    };
  },

  onCopyRoomId() {
    wx.setClipboardData({
      data: this.data.roomId,
      success: () => {
        wx.showToast({ title: '房间号已复制', icon: 'success' });
      }
    });
  },

  onSelectRole(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({ selectedRole: role });
    wx.showToast({ 
      title: role === 'cat' ? '选择了猫 🐱' : '选择了鼠 🐭', 
      icon: 'none' 
    });
  }
});