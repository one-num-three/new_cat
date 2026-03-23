// pages/map/map.js - 地图页面（核心游戏页面）
const { gameAPI } = require('../../utils/api');

Page({
  data: {
    latitude: 32.0584,
    longitude: 118.7968,
    scale: 16,
    markers: [],
    gameId: null,
    playerId: null,
    playerRole: null, // 游戏开始时分配
    gameStatus: 'waiting', // waiting, playing, ended
    countdown: 600,
    players: [],
    showRoleTip: true,
    showScoreBoard: true, // 记分板展开状态
    showShop: false, // 道具商店显示状态
    shopItems: [
      { id: 'speed', icon: '⚡', name: '加速', price: 15, desc: '30秒内移动速度提升' },
      { id: 'invisible', icon: '👻', name: '隐身', price: 15, desc: '15秒内对其他玩家隐藏' },
      { id: 'radar', icon: '📡', name: '雷达', price: 15, desc: '显示所有玩家位置' }
    ],
    isLocationReady: false,
    lastLocationTime: 0,
    isCaught: false // 是否被抓住（老鼠）
  },

  mapCtx: null,
  locationUpdateTimer: null,
  statusPollTimer: null,

  onLoad(options) {
    console.log('[地图页] onLoad', options);
    
    if (options.gameId) {
      this.setData({ 
        gameId: options.gameId,
        playerId: options.playerId
      });
      
      // 如果有角色信息，直接使用
      if (options.role) {
        this.setData({ playerRole: options.role });
      }
    }
  },

  onReady() {
    this.mapCtx = wx.createMapContext('gameMap');
    
    // show-location="true" 会显示系统的蓝色定位指示器
    // markers 只用于显示其他玩家，不添加自己
    
    this.setData({ 
      markers: [],
      showZoomControls: true 
    });
    
    // 初始化位置
    this.initLocation();
    
    // 启动游戏状态轮询
    this.startStatusPoll();
  },

  onShow() {
    // 页面显示时恢复位置更新
    if (this.data.isLocationReady) {
      this.startLocationUpdate();
    }
    // 确保状态轮询在运行
    if (!this.statusPollTimer) {
      this.startStatusPoll();
    }
  },

  onHide() {
    // 页面隐藏时暂停更新（但后台定位继续）
    this.stopLocationUpdate();
  },

  onUnload() {
    this.stopLocationUpdate();
    this.stopStatusPoll();
    // 通知服务器用户离开
    this.notifyLeave();
  },

  notifyLeave() {
    try {
      gameAPI.leaveGame(this.data.gameId, this.data.playerId);
    } catch (e) {
      console.error('[离开] 通知失败', e);
    }
  },

  // ==================== 位置相关 ====================

  // 初始化位置权限（优化版）
  initLocation() {
    // 先显示地图
    this.setData({ isLocationReady: true });
    
    // 获取一次初始位置
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        console.log('[位置] 初始位置获取成功', res.latitude, res.longitude);
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude
        });
        // 不再自动移动地图中心，让用户可以自由查看其他玩家
        // 立即更新自己的标记
        this.updateMyMarker(res.latitude, res.longitude);
      },
      fail: (err) => {
        console.error('[位置] 初始位置获取失败', err);
        wx.showToast({ title: '请授权位置权限', icon: 'none' });
      }
    });
    
    // 启动持续定位
    wx.startLocationUpdate({
      type: 'gcj02',
      success: () => {
        console.log('[位置] 持续定位启动成功');
        // 注册位置变化监听（只注册一次）
        wx.onLocationChange((res) => {
          this.onLocationUpdate(res);
        });
      },
      fail: (err) => {
        console.error('[位置] 持续定位启动失败', err);
        // 降级：定时获取位置
        this.startFallbackLocation();
      }
    });
  },
  
  // 更新自己的标记（不再需要，系统蓝色水滴已显示位置）
  updateMyMarker(latitude, longitude) {
    // 不再添加自己的标记到 markers
    // show-location="true" 已经显示了系统的蓝色定位指示器
    // 角色信息通过顶部的角色提示显示
    console.log('[标记] 自己的位置通过系统指示器显示');
  },
  
  // 降级定位方案
  startFallbackLocation() {
    console.log('[位置] 使用降级定位方案（定时获取）');
    this.locationUpdateTimer = setInterval(() => {
      wx.getLocation({
        type: 'gcj02',
        success: (res) => {
          this.onLocationUpdate(res);
        },
        fail: () => {}
      });
    }, 1000); // 改为 1 秒
  },

  // 位置更新回调
  onLocationUpdate(res) {
    const now = Date.now();
    // 限制上报频率（最多每 200 毫秒一次，让标记更快跟随）
    if (now - this.data.lastLocationTime < 200) {
      return;
    }

    const { latitude, longitude } = res;
    
    console.log('[位置] 更新', latitude, longitude);
    
    // 更新时间戳
    this.setData({
      lastLocationTime: now
    });
    
    // 快速更新自己的 marker 位置（不等服务器轮询）
    const myId = this.data.playerId;
    const myRole = this.data.playerRole || 'mouse';
    const markers = this.data.markers;
    const myMarkerIndex = markers.findIndex(m => m.id === myId);
    
    if (myMarkerIndex !== -1) {
      // 直接更新自己的 marker 位置
      const newMarkers = [...markers];
      newMarkers[myMarkerIndex] = {
        ...newMarkers[myMarkerIndex],
        latitude: latitude,
        longitude: longitude
      };
      this.setData({ markers: newMarkers });
    } else {
      // 还没有自己的 marker，需要创建
      this.updateMyMarkerFull(latitude, longitude);
    }
    
    // 同时更新 players 数组（用于后续服务器同步）
    let players = [...this.data.players];
    const myIndex = players.findIndex(p => p.id === myId);
    
    if (myIndex !== -1) {
      players[myIndex] = {
        ...players[myIndex],
        latitude: latitude,
        longitude: longitude
      };
    } else if (myId) {
      players.push({
        id: myId,
        nickname: '我',
        role: myRole,
        latitude: latitude,
        longitude: longitude,
        score: 0
      });
    }
    this.setData({ players });
    
    // 上报到服务器
    this.uploadLocation(latitude, longitude);
  },
  
  // 完整创建自己的 marker（首次）
  updateMyMarkerFull(latitude, longitude) {
    const myId = this.data.playerId;
    const myRole = this.data.playerRole || 'mouse';
    const myPlayer = this.data.players.find(p => p.id === myId);
    const score = myPlayer?.score || 0;
    const catchCount = myPlayer?.catchCount || 0;
    
    let content = '';
    let bgColor = '';
    
    if (myRole === 'cat') {
      content = `🐱 我`;
      bgColor = '#FF6B6B';
      if (catchCount > 0) content += ` x${catchCount}`;
    } else {
      content = `🐭 我`;
      bgColor = '#4ECDC4';
    }
    
    if (score > 0) content += ` · ${score}分`;
    
    const myMarker = {
      id: myId,
      latitude: latitude,
      longitude: longitude,
      width: 50,
      height: 50,
      title: '我',
      callout: {
        content: content,
        padding: 8,
        borderRadius: 5,
        bgColor: bgColor,
        color: '#fff',
        display: 'ALWAYS',
        fontSize: 14
      },
      alpha: 1
    };
    
    const markers = [...this.data.markers, myMarker];
    this.setData({ markers });
  },

  // 上报位置到服务器
  async uploadLocation(latitude, longitude) {
    try {
      await gameAPI.updateLocation(
        this.data.gameId,
        this.data.playerId,
        latitude,
        longitude
      );
    } catch (err) {
      console.error('[位置] 上报失败', err);
    }
  },

  stopLocationUpdate() {
    if (this.locationUpdateTimer) {
      clearInterval(this.locationUpdateTimer);
      this.locationUpdateTimer = null;
    }
    wx.stopLocationUpdate({
      success: () => console.log('[位置] 已停止更新')
    });
  },

  // ==================== 游戏状态 ====================

  // 开始轮询游戏状态
  startStatusPoll() {
    this.statusPollTimer = setInterval(async () => {
      try {
        const res = await gameAPI.getGameStatus(this.data.gameId);
        
        // 智能合并玩家数据
        const serverPlayers = res.players || [];
        
        // 获取自己当前的位置（从本地 players 获取）
        const localPlayers = this.data.players;
        const localMe = localPlayers.find(p => p.id === this.data.playerId);
        const myLatestLat = localMe?.latitude;
        const myLatestLng = localMe?.longitude;
        
        // 合并数据：用服务器数据更新积分、状态等，但保留自己的最新位置
        const mergedPlayers = serverPlayers.map(p => {
          if (p.id === this.data.playerId && myLatestLat && myLatestLng) {
            return { ...p, latitude: myLatestLat, longitude: myLatestLng };
          }
          return p;
        });
        
        // 检查角色变化（老鼠被抓后变成猫）
        const myPlayer = mergedPlayers.find(p => p.id === this.data.playerId);
        const previousRole = this.data.playerRole;

        // 角色从老鼠变成猫 = 被抓后变身
        if (previousRole === 'mouse' && myPlayer?.role === 'cat') {
          console.log('[角色转换] 你变成猫了！');
          this.setData({
            playerRole: 'cat',
            isCaught: false,
            myScore: myPlayer.score || 0
          });
          wx.showModal({
            title: '🐱 你变成猫了！',
            content: `你被抓住了，现在你是一只猫！\n获得 ${myPlayer.score || 0} 积分，去抓其他老鼠吧！`,
            showCancel: false
          });
          // 猫不需要预加载二维码，直接使用扫码功能即可
        }
        // 兼容旧的被抓逻辑（如果服务器还在用 isCaught 字段）
        else if (myPlayer?.isCaught && !this.data.isCaught && myPlayer?.role !== 'cat') {
          this.setData({ isCaught: true });
          wx.showModal({
            title: '😢 你被抓住了！',
            content: '可以继续观战，或等待游戏结束',
            showCancel: false
          });
        }

        // 更新状态
        this.setData({
          gameStatus: res.status,
          countdown: res.countdown,
          players: mergedPlayers
        });

        // 更新商店积分
        if (this.data.showShop && myPlayer) {
          this.setData({ myScore: myPlayer.score || 0 });
        }

        // 如果角色还未分配，从服务器获取
        if (!this.data.playerRole && myPlayer?.role) {
          this.setData({ playerRole: myPlayer.role });
          if (myPlayer.role === 'mouse') {
            this.preloadQRCode();
          }
          // 猫不需要预加载二维码，直接使用扫码功能即可
        }

        // 刷新地图标记
        this.updateMarkers();

        // 检查游戏是否结束
        if (res.status === 'ended') {
          this.onGameEnded(res);
        }
      } catch (err) {
        console.error('[状态] 轮询失败', err);
      }
    }, 1500); // 每 1.5 秒轮询一次（提高实时性）
  },

  // 游戏结束处理
  onGameEnded(res) {
    // 防止重复触发
    if (this.data.gameEnded) return;
    this.setData({ gameEnded: true });
    
    this.stopStatusPoll();
    
    const myRole = this.data.playerRole;
    const winner = res.winner;
    const isWin = winner === myRole;
    
    // 根据玩家角色和结果定制消息
    let title = '';
    let content = '';
    
    if (myRole === 'cat') {
      if (isWin) {
        title = '🎉 猫获胜！';
        const myPlayer = this.data.players.find(p => p.id === this.data.playerId);
        const catchCount = myPlayer?.catchCount || 0;
        const score = myPlayer?.score || 0;
        content = `你抓住了 ${catchCount} 只老鼠！\n最终积分：${score} 分`;
      } else {
        title = '😢 猫失败了';
        content = '老鼠成功存活到了最后...\n下次再努力吧！';
      }
    } else {
      // 老鼠
      if (isWin) {
        title = '🎉 老鼠获胜！';
        const myPlayer = this.data.players.find(p => p.id === this.data.playerId);
        const score = myPlayer?.score || 0;
        content = `你成功存活到了最后！\n最终积分：${score} 分`;
      } else {
        title = '😢 老鼠失败';
        const myPlayer = this.data.players.find(p => p.id === this.data.playerId);
        if (myPlayer?.isCaught) {
          content = '你被猫抓住了...\n下次躲得更好一点吧！';
        } else {
          content = '其他老鼠都被抓住了...\n下次再努力吧！';
        }
      }
    }
    
    wx.showModal({
      title: title,
      content: content,
      showCancel: false,
      confirmText: '返回大厅',
      success: () => {
        wx.navigateBack({ delta: 2 }); // 返回到首页
      }
    });
  },

  stopStatusPoll() {
    if (this.statusPollTimer) {
      clearInterval(this.statusPollTimer);
      this.statusPollTimer = null;
    }
  },

  // ==================== 地图标记 ====================

  updateMarkers() {
    const myId = this.data.playerId;
    
    const markers = this.data.players
      .filter(p => {
        // 必须有位置
        if (!p.latitude || !p.longitude) return false;
        // 隐身的玩家不显示（除了自己）
        if (p.items?.invisible > 0 && p.id !== myId) return false;
        return true;
      })
      .map((player) => {
        // 构建标记数据
        const isMe = player.id === myId;
        const isCaught = player.role === 'mouse' && player.isCaught;
        const isOffline = player.isOffline;
        const score = player.score || 0;
        
        // 构建显示内容
        let content = '';
        let bgColor = '';
        
        if (isOffline) {
          // 掉线玩家
          if (player.role === 'cat') {
            content = `🐱💤 ${player.nickname}`;
          } else {
            content = `🐭💤 ${player.nickname}`;
          }
          bgColor = '#999'; // 灰色表示掉线
        } else if (player.role === 'cat') {
          content = `🐱 ${player.nickname}`;
          bgColor = '#FF6B6B';
          if (player.catchCount > 0) {
            content += ` x${player.catchCount}`;
          }
        } else {
          if (isCaught) {
            content = `🐭❌ ${player.nickname}`;
            bgColor = '#999'; // 灰色表示被抓
          } else {
            content = `🐭 ${player.nickname}`;
            bgColor = '#4ECDC4';
          }
        }
        
        // 积分显示（可选）
        if (score > 0 && !isOffline) {
          content += ` · ${score}分`;
        }
        
        const marker = {
          id: player.id,
          latitude: player.latitude,
          longitude: player.longitude,
          width: isMe ? 50 : 40,
          height: isMe ? 50 : 40,
          title: player.nickname,
          callout: {
            content: content,
            padding: 8,
            borderRadius: 5,
            bgColor: bgColor,
            color: '#fff',
            display: 'ALWAYS',
            fontSize: isMe ? 14 : 12
          },
          // 自己的标记有特殊边框
          alpha: isCaught ? 0.5 : 1
        };
        
        return marker;
      });

    this.setData({ markers });
  },

  // ==================== 扫码相关 ====================

  // 预加载二维码（老鼠专用）
  preloadQRCode() {
    try {
      const app = getApp();
      if (!app || !app.globalData) {
        console.log('[二维码] globalData 未初始化');
        return;
      }
      
      // 检查是否已有预缓存的二维码
      if (app.globalData.qrCodePath) {
        console.log('[二维码] 已有预缓存:', app.globalData.qrCodePath);
        return;
      }
      
      // 生成二维码数据
      const qrData = {
        gameId: this.data.gameId,
        playerId: this.data.playerId,
        role: 'mouse',
        nickname: '我'
      };
      
      const qrText = JSON.stringify(qrData);
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&color=000000&data=${encodeURIComponent(qrText)}`;
      
      // 后台下载缓存
      wx.downloadFile({
        url: qrCodeUrl,
        success: (res) => {
          console.log('[二维码] 预加载成功:', res.tempFilePath);
          if (app.globalData) {
            app.globalData.qrCodePath = res.tempFilePath;
            app.globalData.qrCodeData = qrData;
          }
        },
        fail: (err) => {
          console.log('[二维码] 预加载失败:', err);
        }
      });
    } catch (e) {
      console.log('[二维码] 预加载异常:', e);
    }
  },

  // 显示我的二维码（老鼠专用）
  onShowQRCode() {
    if (this.data.playerRole !== 'mouse') {
      wx.showToast({ title: '只有老鼠需要二维码', icon: 'none' });
      return;
    }
    
    if (this.data.isCaught) {
      wx.showToast({ title: '你已被抓住', icon: 'none' });
      return;
    }
    
    // 生成二维码数据
    const qrData = {
      gameId: this.data.gameId,
      playerId: this.data.playerId,
      role: this.data.playerRole,
      nickname: '我'
    };
    
    // 尝试使用预缓存
    try {
      const app = getApp();
      if (app && app.globalData && app.globalData.qrCodePath) {
        console.log('[二维码] 使用预缓存:', app.globalData.qrCodePath);
        wx.navigateTo({
          url: `/pages/qrcode/qrcode?cached=1&data=${encodeURIComponent(JSON.stringify(app.globalData.qrCodeData || qrData))}&path=${encodeURIComponent(app.globalData.qrCodePath)}`
        });
        return;
      }
    } catch (e) {
      console.log('[二维码] 获取缓存失败:', e);
    }
    
    // 没有缓存，实时生成
    const qrText = JSON.stringify(qrData);
    wx.navigateTo({
      url: `/pages/qrcode/qrcode?data=${encodeURIComponent(qrText)}`
    });
  },

  // 扫码抓人（猫专用）
  onScanQRCode() {
    if (this.data.playerRole !== 'cat') {
      wx.showToast({ title: '只有猫可以抓人', icon: 'none' });
      return;
    }
    
    wx.scanCode({
      onlyFromCamera: false, // 允许从相册选择
      success: async (res) => {
        console.log('[扫码] 结果:', res);
        
        try {
          // 解析二维码数据
          const qrData = JSON.parse(res.result);
          
          // 验证是否是同一游戏
          if (qrData.gameId !== this.data.gameId) {
            wx.showToast({ title: '不是同一场游戏', icon: 'none' });
            return;
          }
          
          // 验证是否是老鼠
          if (qrData.role !== 'mouse') {
            wx.showToast({ title: '只能抓老鼠', icon: 'none' });
            return;
          }
          
          // 调用抓住 API（传递猫和老鼠的当前位置，避免多实例数据不同步）
          const myPlayer = this.data.players.find(p => p.id === this.data.playerId);
          const mousePlayer = this.data.players.find(p => p.id === qrData.playerId);
          const result = await gameAPI.catchPlayer(
            this.data.gameId,
            this.data.playerId,
            qrData.playerId,
            myPlayer?.latitude,   // 猫的当前位置
            myPlayer?.longitude,
            mousePlayer?.latitude, // 老鼠的当前位置
            mousePlayer?.longitude
          );
          
          // 抓人成功的提示
          let content = `你已抓住 ${qrData.nickname}！`;
          if (result.transformed) {
            content += `\n${qrData.nickname} 变成了猫！`;
          }
          content += `\n共抓住 ${result.catchCount} 只，剩余 ${result.remaining} 只老鼠`;
          
          wx.showModal({
            title: '🎉 抓住成功！',
            content: content,
            showCancel: false
          });
          
          // 检查游戏是否结束
          if (result.remaining === 0) {
            setTimeout(() => {
              wx.navigateBack();
            }, 2000);
          }
        } catch (err) {
          console.error('[扫码] 失败:', err);
          wx.showToast({ 
            title: err.message || '抓住失败', 
            icon: 'none' 
          });
        }
      },
      fail: (err) => {
        console.error('[扫码] 取消或失败:', err);
      }
    });
  },

  // ==================== 道具使用 ====================

  onUseItem() {
    wx.showActionSheet({
      itemList: ['加速 ⚡', '隐身 👻', '雷达 📡'],
      success: async (res) => {
        const items = ['speed', 'invisible', 'radar'];
        const itemId = items[res.tapIndex];
        
        try {
          const result = await gameAPI.useItem(
            this.data.gameId,
            this.data.playerId,
            itemId,
            null
          );
          
          // 处理道具效果
          if (result.effect) {
            this.handleItemEffect(result.effect);
          }
        } catch (err) {
          wx.showToast({ 
            title: err.message || '使用失败', 
            icon: 'none' 
          });
        }
      }
    });
  },

  // 处理道具效果
  handleItemEffect(effect) {
    switch (effect.type) {
      case 'radar':
        // 雷达显示所有玩家位置
        if (effect.players && effect.players.length > 0) {
          wx.showModal({
            title: '📡 雷达扫描',
            content: `发现 ${effect.players.length} 名玩家`,
            showCancel: false
          });
        }
        break;
        
      case 'speed':
        wx.showToast({
          title: '⚡ 加速 30 秒',
          icon: 'success',
          duration: 2000
        });
        break;
        
      case 'invisible':
        wx.showToast({
          title: '👻 隐身 15 秒',
          icon: 'success',
          duration: 2000
        });
        break;
    }
  },

  // ==================== 游戏控制 ====================

  onEndGame() {
    wx.showModal({
      title: '确认结束',
      content: '确定要提前结束这场游戏吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await gameAPI.endGame(this.data.gameId, this.data.playerRole);
            wx.showToast({ title: '游戏已结束', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 1500);
          } catch (err) {
            wx.showToast({ title: '结束失败', icon: 'none' });
          }
        }
      }
    });
  },

  hideRoleTip() {
    this.setData({ showRoleTip: false });
  },

  // 切换记分板显示/隐藏
  toggleScoreBoard() {
    this.setData({ showScoreBoard: !this.data.showScoreBoard });
  },

  // 打开道具商店
  onOpenShop() {
    // 计算当前玩家积分
    const myPlayer = this.data.players.find(p => p.id === this.data.playerId);
    const myScore = myPlayer ? (myPlayer.score || 0) : 0;
    this.setData({ showShop: true, myScore });
  },

  // 关闭道具商店
  onCloseShop() {
    this.setData({ showShop: false });
  },

  // 购买道具
  async onBuyItem(e) {
    const itemId = e.currentTarget.dataset.item;
    wx.showLoading({ title: '购买中...' });
    
    try {
      const res = await gameAPI.useItem(this.data.gameId, this.data.playerId, itemId);
      wx.hideLoading();
      
      if (res.success) {
        wx.showToast({ 
          title: `购买${res.itemName}成功！剩余${res.remainingScore}分`, 
          icon: 'success' 
        });
        this.setData({ myScore: res.remainingScore });
        
        // 如果是雷达，显示效果
        if (itemId === 'radar' && res.effect.players) {
          wx.showModal({
            title: '📡 雷达扫描结果',
            content: `发现 ${res.effect.players.length} 名玩家`,
            showCancel: false
          });
        }
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '购买失败', icon: 'none' });
    }
  },

  // 地图区域变化（缩放、移动）
  onRegionChange(e) {
    console.log('[地图] 区域变化', e.type, e.cause);
    
    // 缩放开始/结束
    if (e.cause === 'gesture') {
      // 手势操作（滑动、缩放）
      if (e.type === 'begin') {
        console.log('[地图] 手势开始');
      } else if (e.type === 'end') {
        // 获取新的中心点和缩放级别
        this.mapCtx.getCenterLocation({
          success: (res) => {
            this.setData({
              latitude: res.latitude,
              longitude: res.longitude
            });
          }
        });
        
        this.mapCtx.getScale({
          success: (res) => {
            this.setData({
              scale: res.scale
            });
          }
        });
      }
    }
  },

  // 地图点击
  onMapTap(e) {
    console.log('[地图] 点击', e.detail);
  },

  // 放大地图
  onZoomIn() {
    const newScale = Math.min(20, this.data.scale + 2);
    this.setData({ scale: newScale });
  },

  // 缩小地图
  onZoomOut() {
    const newScale = Math.max(5, this.data.scale - 2);
    this.setData({ scale: newScale });
  },

  // 定位回当前位置
  onBackToLocation() {
    console.log('[地图] 归位到当前位置');
    this.mapCtx.moveToLocation({
      success: () => {
        console.log('[地图] 归位成功');
      },
      fail: (err) => {
        console.error('[地图] 归位失败', err);
        // 尝试重新获取位置
        wx.getLocation({
          type: 'gcj02',
          success: (res) => {
            this.setData({
              latitude: res.latitude,
              longitude: res.longitude
            });
          }
        });
      }
    });
  }
})
