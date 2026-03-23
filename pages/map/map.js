// pages/map/map.js - 地图页面（核心游戏页面）
const { gameAPI } = require('../../utils/api');

Page({
  data: {
    latitude: 32.0584,
    longitude: 118.7968,
    scale: 16,
    markers: [],
    circles: [], // 视野范围圆圈
    goldenShieldCircles: [], // 金身保护圈
    bombardCircles: [], // 轰炸区域
    allCircles: [], // 所有圆圈的合并数组
    visionRange: 200, // 视野范围（米）- 基础值（老鼠）
    actualVisionRange: 200, // 实际视野范围（考虑角色加成）
    displayVisionRange: 200, // 显示用的四舍五入值
    hasEagleEye: false, // 是否激活鹰眼
    eagleEyeStacks: 0, // 鹰眼层数
    hasGoldenShield: false, // 是否激活金身
    inGoldenShield: false, // 是否在金身保护圈内
    goldenShieldExpiresAt: 0, // 金身过期时间
    selectingBombard: false, // 是否正在选择轰炸点
    bombardPreviewCircle: null, // 轰炸预览圆圈
    bombardPreviewLat: null, // 预览点纬度
    bombardPreviewLng: null, // 预览点经度
    bombardZones: [], // 轰炸区域列表
    gameId: null,
    playerId: null,
    playerRole: null, // 游戏开始时分配
    gameStatus: 'waiting', // waiting, playing, ended
    countdown: 600,
    players: [],
    allPlayers: [], // 所有玩家（用于记分板）
    showAllPlayers: false, // 是否展开显示所有玩家
    showRoleTip: true,
    showScreenTip: true, // 亮屏提示
    showScoreBoard: true, // 记分板展开状态
    showShop: false, // 道具商店显示状态
    shopItems: [
      { id: 'invisible', icon: '👻', name: '隐身', price: 15, desc: '15秒内对其他玩家隐藏' },
      { id: 'eagleEye', icon: '🦅', name: '鹰眼', price: 20, desc: '10秒内视野范围+50%' },
      { id: 'goldenShield', icon: '🛡️', name: '金身', price: 30, desc: '3分钟保护圈，圈内不可被抓' },
      { id: 'bombard', icon: '💣', name: '轰炸', price: 40, desc: '选择轰炸点，30秒后圈内-50分' }
    ],
    isLocationReady: false,
    lastLocationTime: 0,
    isCaught: false, // 是否被抓住（老鼠）
    rejoining: false, // 是否正在尝试重新加入
    danmakuList: [], // 弹幕列表
    events: [], // 事件历史
    showHistory: false, // 历史记录弹窗
    lastEventTime: 0 // 上次事件时间，用于检测新事件
  },

  mapCtx: null,
  locationUpdateTimer: null,
  statusPollTimer: null,
  countdownTimer: null, // 本地倒计时定时器
  serverCountdown: 0, // 服务器同步的倒计时

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
    
    // 保持屏幕常亮
    wx.setKeepScreenOn({
      keepScreenOn: true
    });
    console.log('[屏幕] 设置常亮');
    
    // show-location="true" 会显示系统的蓝色定位指示器
    // markers 只用于显示其他玩家，不添加自己
    
    this.setData({ 
      markers: [],
      showZoomControls: true 
    });
    
    // 初始化位置
    this.initLocation();
    
    // 启动游戏状态轮询（只在 onReady 启动一次）
    if (!this.statusPollTimer) {
      this.startStatusPoll();
    }
  },

  onShow() {
    // 页面显示时恢复位置更新
    if (this.data.isLocationReady) {
      this.startLocationUpdate();
    }
    // 注意：不再重复启动轮询，onReady 已经启动了
  },

  onHide() {
    // 页面隐藏时不做任何操作，位置持续更新
  },

  onUnload() {
    // 页面卸载时停止更新（掉线由服务器通过位置上报检测）
    this.stopLocationUpdate();
    this.stopStatusPoll();
    this.stopLocalCountdown();
    
    // 关闭屏幕常亮
    wx.setKeepScreenOn({
      keepScreenOn: false
    });
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
        // 更新视野圆圈
        this.updateVisionCircle(res.latitude, res.longitude);
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
    // 限制上报频率（最多每 500 毫秒一次，提高响应速度）
    if (now - this.data.lastLocationTime < 500) {
      return;
    }

    const { latitude, longitude } = res;
    
    console.log('[位置] 更新', latitude, longitude);
    
    // 注意：不要更新 this.data.latitude/longitude
    // 因为那会强制地图中心移动！
    // 只更新时间戳
    this.setData({
      lastLocationTime: now
    });
    
    // 更新自己的标记位置
    this.updateMyMarker(latitude, longitude);
    
    // 更新视野范围圆圈
    this.updateVisionCircle(latitude, longitude);
    
    // 创建新的 players 数组
    let players = [...this.data.players];
    const myIndex = players.findIndex(p => p.id === this.data.playerId);
    
    // 确保有自己的角色信息
    const myRole = this.data.playerRole || 'mouse';
    
    if (myIndex !== -1) {
      // 已存在，更新位置（创建新对象）
      players[myIndex] = {
        ...players[myIndex],
        latitude: latitude,
        longitude: longitude,
        role: players[myIndex].role || myRole // 确保有角色
      };
    } else if (this.data.playerId) {
      // 不存在，添加自己
      players.push({
        id: this.data.playerId,
        nickname: '我',
        role: myRole,
        latitude: latitude,
        longitude: longitude,
        score: 0
      });
    }
    
    // 生成 markers（确保自己始终显示）
    const myId = this.data.playerId;
    const markers = players
      .filter(p => p.latitude && p.longitude)
      .map((player) => {
        const isMe = player.id === myId;
        const isCaught = player.role === 'mouse' && player.isCaught;
        const score = player.score || 0;
        
        let content = '';
        let bgColor = '';
        
        if (player.role === 'cat') {
          content = `🐱 ${player.nickname}`;
          bgColor = '#FF6B6B';
          if (player.catchCount > 0) content += ` x${player.catchCount}`;
        } else {
          if (isCaught) {
            content = `🐭❌ ${player.nickname}`;
            bgColor = '#999';
          } else {
            content = `🐭 ${player.nickname}`;
            bgColor = '#4ECDC4';
          }
        }
        
        if (score > 0) content += ` · ${score}分`;
        
        return {
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
          alpha: isCaught ? 0.5 : 1
        };
      });
    
    // 一次性更新 players 和 markers
    this.setData({ players, markers });
    
    // 上报到服务器
    this.uploadLocation(latitude, longitude);
  },

  // 上报位置到服务器
  async uploadLocation(latitude, longitude) {
    console.log('[位置上报] 开始上报', latitude, longitude);
    try {
      const result = await gameAPI.updateLocation(
        this.data.gameId,
        this.data.playerId,
        latitude,
        longitude
      );
      console.log('[位置上报] 成功', result);
    } catch (err) {
      console.error('[位置上报] 失败', err);
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
    // 先停止旧的轮询，避免重复
    this.stopStatusPoll();
    
    // 启动本地倒计时（每秒减 1）
    this.startLocalCountdown();
    
    this.statusPollTimer = setInterval(async () => {
      try {
        // 传递当前位置用于视野过滤
        const res = await gameAPI.getGameStatus(
          this.data.gameId, 
          this.data.playerId, 
          this.data.latitude, 
          this.data.longitude
        );
        
        // 智能合并玩家数据
        const serverPlayers = res.players || [];
        
        // 检查自己是否在玩家列表中（可能被踢出了）
        const myServerPlayer = serverPlayers.find(p => p.id === this.data.playerId);
        if (!myServerPlayer && res.status === 'playing' && !this.data.rejoining) {
          // 自己不在列表中，尝试重新加入
          console.log('[重新加入] 自己不在玩家列表中，尝试重新加入');
          this.setData({ rejoining: true });
          
          try {
            const rejoinRes = await gameAPI.rejoinGame(this.data.gameId, this.data.playerId);
            if (rejoinRes.success) {
              console.log('[重新加入] 成功！恢复角色:', rejoinRes.player.role, '积分:', rejoinRes.player.score);
              // 立即更新角色
              this.setData({ 
                playerRole: rejoinRes.player.role,
                isCaught: rejoinRes.player.isCaught || false
              });
              wx.showToast({ title: '已重新加入', icon: 'success' });
            }
          } catch (rejoinErr) {
            console.log('[重新加入] 失败:', rejoinErr.message);
          }
          
          this.setData({ rejoining: false });
          return; // 等下次轮询获取更新后的状态
        }
        
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
        
        // 检查自己是否被抓（老鼠）
        const myPlayer = mergedPlayers.find(p => p.id === this.data.playerId);
        if (myPlayer?.isCaught && !this.data.isCaught) {
          this.setData({ isCaught: true });
          wx.showModal({
            title: '😢 你被抓住了！',
            content: '可以继续观战，或等待游戏结束',
            showCancel: false
          });
        }
        
        // 同步服务器倒计时（用于校准本地倒计时）
        const serverCountdown = res.countdown;
        const localCountdown = this.data.countdown;
        
        // 如果本地倒计时和服务器差距超过 2 秒，强制同步
        if (Math.abs(localCountdown - serverCountdown) > 2) {
          console.log('[倒计时] 同步服务器:', localCountdown, '→', serverCountdown);
          this.setData({ countdown: serverCountdown });
        }
        
        // 更新状态（不直接更新 countdown，让本地倒计时自己减）
        this.setData({
          gameStatus: res.status,
          players: mergedPlayers,
          allPlayers: res.allPlayers || mergedPlayers, // 所有玩家（用于记分板）
          events: res.events || [],
          visionRange: res.settings?.visionRange || 200,
          goldenShields: res.goldenShields || [], // 金身保护圈列表
          bombardZones: res.bombardZones || [] // 轰炸区域列表
        });
        
        // 更新视野圈（每次状态更新后都要重新计算，以反映鹰眼等效果）
        if (this.data.latitude && this.data.longitude) {
          this.updateVisionCircle(this.data.latitude, this.data.longitude);
        }
        
        // 更新轰炸区域显示
        this.updateBombardCircles();
        
        // 检测新事件，显示弹幕
        const events = res.events || [];
        const lastEventTime = this.data.lastEventTime;
        events.forEach(event => {
          if (event.time > lastEventTime) {
            this.showDanmaku(event);
          }
        });
        // 更新最后事件时间
        if (events.length > 0) {
          const maxTime = Math.max(...events.map(e => e.time));
          this.setData({ lastEventTime: maxTime });
        }
        
        // 更新商店积分
        if (this.data.showShop && myPlayer) {
          this.setData({ myScore: myPlayer.score || 0 });
        }
        
        // 如果角色发生变化（比如被抓变猫），更新角色
        if (myPlayer?.role && this.data.playerRole !== myPlayer.role) {
          console.log('[角色变化]', this.data.playerRole, '→', myPlayer.role);
          this.setData({ playerRole: myPlayer.role });
          if (myPlayer.role === 'mouse') {
            this.preloadQRCode();
          }
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
    }, 2000); // 每 2 秒轮询一次（用于同步状态）
  },

  // 启动本地倒计时
  startLocalCountdown() {
    // 先停止旧的
    this.stopLocalCountdown();
    
    this.countdownTimer = setInterval(() => {
      const countdown = this.data.countdown;
      if (countdown > 0) {
        this.setData({ countdown: countdown - 1 });
      }
    }, 1000); // 每秒减 1
  },

  // 停止本地倒计时
  stopLocalCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  },

  // 游戏结束处理
  onGameEnded(res) {
    // 防止重复触发
    if (this.data.gameEnded) return;
    this.setData({ gameEnded: true });
    
    this.stopStatusPoll();
    this.stopLocalCountdown();
    
    // 使用服务器返回的角色（更可靠），而不是本地缓存的 playerRole
    const myPlayer = this.data.allPlayers.find(p => p.id === this.data.playerId) || 
                     this.data.players.find(p => p.id === this.data.playerId);
    const myRole = myPlayer?.role || this.data.playerRole;
    const winner = res.winner;
    const winReason = res.winReason;
    const isWin = winner === myRole;
    
    // 统计数据
    const allPlayers = this.data.allPlayers || this.data.players;
    const totalCats = allPlayers.filter(p => p.role === 'cat').length;
    const totalMice = allPlayers.filter(p => p.role === 'mouse').length;
    const caughtMice = allPlayers.filter(p => p.role === 'mouse' && p.isCaught).length;
    const offlineCats = allPlayers.filter(p => p.role === 'cat' && p.isOffline).length;
    const offlineMice = allPlayers.filter(p => p.role === 'mouse' && p.isOffline).length;
    
    // 调试日志
    console.log('[游戏结束] myRole:', myRole, 'winner:', winner, 'winReason:', winReason, 'isWin:', isWin);
    console.log('[游戏结束] 猫:', totalCats, '鼠:', totalMice, '被抓:', caughtMice, '离线猫:', offlineCats, '离线鼠:', offlineMice);
    
    // 获取结束原因描述
    const reasonText = this.getWinReasonText(winReason, winner);
    
    // 构建详细统计
    const statsText = `📊 统计:\n🐱 猫: ${totalCats}人 (离线${offlineCats}人)\n🐭 鼠: ${totalMice}人 (被抓${caughtMice}人, 离线${offlineMice}人)`;
    
    // 根据玩家角色和结果定制消息
    let title = '';
    let content = '';
    
    if (myRole === 'cat') {
      if (isWin) {
        title = '🎉 猫获胜！';
        const catchCount = myPlayer?.catchCount || 0;
        const score = myPlayer?.score || 0;
        content = `${reasonText}\n\n${statsText}\n\n🏆 你的战绩:\n抓住 ${catchCount} 只老鼠\n最终积分：${score} 分`;
      } else {
        title = '😢 猫失败了';
        const score = myPlayer?.score || 0;
        content = `${reasonText}\n\n${statsText}\n\n最终积分：${score} 分\n下次再努力吧！`;
      }
    } else {
      // 老鼠
      if (isWin) {
        title = '🎉 老鼠获胜！';
        const score = myPlayer?.score || 0;
        content = `${reasonText}\n\n${statsText}\n\n🏆 你的战绩:\n成功存活！\n最终积分：${score} 分`;
      } else {
        title = '😢 老鼠失败';
        const score = myPlayer?.score || 0;
        if (myPlayer?.isCaught) {
          content = `${reasonText}\n\n${statsText}\n\n你被猫抓住了...\n最终积分：${score} 分\n下次躲得更好一点吧！`;
        } else {
          content = `${reasonText}\n\n${statsText}\n\n最终积分：${score} 分\n下次再努力吧！`;
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

  // 获取结束原因描述（详细版）
  getWinReasonText(winReason, winner) {
    const reasons = {
      'time_up': '⏱️ 时间到！\n老鼠成功存活到游戏结束',
      'all_mice_caught': '🐱 所有老鼠被抓！\n猫成功抓捕了所有老鼠',
      'cats_offline': '💤 所有猫已离线！\n老鼠在猫离线后存活获胜',
      'mice_offline_or_caught': '💤 所有老鼠已离线或被抓！\n猫获得胜利'
    };
    
    return reasons[winReason] || (winner === 'cat' ? '🐱 猫获胜！' : '🐭 老鼠获胜！');
  },

  stopStatusPoll() {
    if (this.statusPollTimer) {
      clearInterval(this.statusPollTimer);
      this.statusPollTimer = null;
    }
    this.stopLocalCountdown();
  },

  // ==================== 地图标记 ====================

  updateMarkers() {
    const myId = this.data.playerId;
    
    const markers = this.data.players
      .filter(p => {
        // 必须有位置才能显示 marker
        if (!p.latitude || !p.longitude) return false;
        // 隐身的玩家不显示（除了自己，且在隐身时间内）
        if (p.items?.invisible > Date.now() && p.id !== myId) return false;
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
          bgColor = '#888888'; // 深灰色表示掉线
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
        
        // 积分显示（掉线玩家不显示积分）
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
          // 掉线玩家半透明
          alpha: isOffline ? 0.6 : (isCaught ? 0.5 : 1)
        };
        
        return marker;
      });

    this.setData({ markers });
  },

  // 更新视野范围圆圈
  updateVisionCircle(latitude, longitude) {
    console.log('[视野圈] updateVisionCircle 被调用', latitude, longitude);
    
    if (!latitude || !longitude) {
      console.log('[视野圈] 没有经纬度，跳过');
      return;
    }
    
    const baseVisionRange = this.data.visionRange || 200;
    console.log('[视野圈] baseVisionRange:', baseVisionRange);
    
    // 找到自己的玩家信息
    const myPlayer = this.data.allPlayers.find(p => p.id === this.data.playerId) ||
                     this.data.players.find(p => p.id === this.data.playerId);
    
    console.log('[视野圈] myPlayer:', myPlayer ? JSON.stringify({ id: myPlayer.id, role: myPlayer.role, items: myPlayer.items }) : 'not found');
    
    // 计算实际视野范围
    let actualVisionRange = baseVisionRange;
    let baseRangeForRole = baseVisionRange; // 基础视野（不含鹰眼）
    let eagleEyeStacks = 0;
    
    // 猫的视野比老鼠大30%
    if (this.data.playerRole === 'cat') {
      actualVisionRange = baseVisionRange * 1.3;
      baseRangeForRole = baseVisionRange * 1.3;
    }
    
    // 鹰眼技能：每层+50%（可叠加）
    const hasEagleEye = myPlayer?.items?.eagleEye && myPlayer.items.eagleEye > Date.now();
    if (hasEagleEye) {
      eagleEyeStacks = myPlayer.items.eagleEyeCount || 1;
      // 每层乘以1.5
      for (let i = 0; i < eagleEyeStacks; i++) {
        actualVisionRange = actualVisionRange * 1.5;
      }
    }
    
    console.log('[视野圈] actualVisionRange:', actualVisionRange, 'playerRole:', this.data.playerRole);
    
    // 检查鹰眼状态是否变化
    const prevHasEagleEye = this.data.hasEagleEye;
    const prevStacks = this.data.eagleEyeStacks || 0;
    
    // 鹰眼消失时提示
    if (prevHasEagleEye && !hasEagleEye) {
      console.log('[鹰眼] 效果已消失');
      wx.showToast({
        title: '🦅 鹰眼效果已消失',
        icon: 'none',
        duration: 1500
      });
    }
    
    // 视野范围圆圈
    const circles = [];
    
    if (hasEagleEye) {
      // 鹰眼激活：显示两个圈
      // 1. 基础视野圈（原来的范围，青色）
      const baseVisionCircle = {
        latitude: latitude,
        longitude: longitude,
        radius: baseRangeForRole,
        color: '#4ECDC4',
        fillColor: '#4ECDC408',
        strokeWidth: 2
      };
      
      // 2. 鹰眼扩大后的视野圈（金色）
      const eagleEyeCircle = {
        latitude: latitude,
        longitude: longitude,
        radius: actualVisionRange,
        color: '#FFD700',
        fillColor: '#FFD70015',
        strokeWidth: 4
      };
      
      circles.push(baseVisionCircle, eagleEyeCircle);
      console.log('[视野圈] 鹰眼激活! 基础圈:', baseRangeForRole, '扩大圈:', actualVisionRange, '层数:', eagleEyeStacks);
    } else {
      // 普通状态：只显示一个圈
      const visionCircle = {
        latitude: latitude,
        longitude: longitude,
        radius: actualVisionRange,
        color: '#00D9C4',
        fillColor: '#4ECDC415',
        strokeWidth: 3
      };
      circles.push(visionCircle);
    }
    
    console.log('[视野圈] 生成的 circles:', JSON.stringify(circles));
    
    this.setData({ 
      circles: circles,
      actualVisionRange: actualVisionRange, // 实际视野范围（用于显示）
      displayVisionRange: Math.round(actualVisionRange), // 显示用的四舍五入值
      hasEagleEye: hasEagleEye, // 鹰眼状态
      eagleEyeStacks: eagleEyeStacks // 鹰眼层数
    });
    
    console.log('[视野圈] setData 完成，circles:', this.data.circles);
    
    // 更新金身保护圈
    this.updateGoldenShields(latitude, longitude);
    
    // 合并所有圆圈
    this.mergeAllCircles();
  },
  
  // 合并所有圆圈
  mergeAllCircles() {
    const allCircles = [
      ...this.data.circles,
      ...this.data.goldenShieldCircles,
      ...this.data.bombardCircles
    ];
    
    // 添加轰炸预览圈
    if (this.data.bombardPreviewCircle) {
      allCircles.push(this.data.bombardPreviewCircle);
    }
    
    console.log('[圆圈合并] allCircles 数量:', allCircles.length);
    this.setData({ allCircles });
  },

  // 更新金身保护圈
  updateGoldenShields(myLat, myLng) {
    const goldenShields = this.data.goldenShields || [];
    const goldenShieldCircles = [];
    const GOLDEN_SHIELD_VISIBLE_RADIUS = 500; // 500米内可见金身圈
    
    goldenShields.forEach(shield => {
      // 检查是否在可见范围内
      if (shield.center && myLat && myLng) {
        const distance = this.calculateDistance(
          myLat, myLng,
          shield.center.latitude, shield.center.longitude
        );
        
        if (distance <= GOLDEN_SHIELD_VISIBLE_RADIUS) {
          // 在可见范围内，添加保护圈
          goldenShieldCircles.push({
            latitude: shield.center.latitude,
            longitude: shield.center.longitude,
            radius: shield.radius,
            color: '#FFD700', // 金色边框
            fillColor: '#FFD70020', // 金色半透明填充
            strokeWidth: 3
          });
        }
      }
    });
    
    // 检查自己是否有金身，以及是否在保护圈内
    const myPlayer = this.data.allPlayers.find(p => p.id === this.data.playerId) ||
                     this.data.players.find(p => p.id === this.data.playerId);
    
    let hasGoldenShield = false;
    let inGoldenShield = false;
    let goldenShieldExpiresAt = 0;
    
    if (myPlayer?.items?.goldenShield && myPlayer.items.goldenShield > Date.now()) {
      hasGoldenShield = true;
      goldenShieldExpiresAt = myPlayer.items.goldenShield;
      
      // 检查是否在保护圈内
      const center = myPlayer.items.goldenShieldCenter;
      const radius = myPlayer.items.goldenShieldRadius || 50;
      
      if (center && myLat && myLng) {
        const distanceFromCenter = this.calculateDistance(
          center.latitude, center.longitude,
          myLat, myLng
        );
        inGoldenShield = distanceFromCenter <= radius;
      }
    }
    
    // 检测金身失效或出圈
    const prevInShield = this.data.inGoldenShield;
    const prevHasShield = this.data.hasGoldenShield;
    
    if (prevHasShield && !hasGoldenShield) {
      // 金身时间结束
      wx.showToast({
        title: '🛡️ 金身效果已消失',
        icon: 'none',
        duration: 2000
      });
    } else if (hasGoldenShield && prevInShield && !inGoldenShield) {
      // 离开了保护圈
      wx.showToast({
        title: '⚠️ 已离开金身保护圈！',
        icon: 'none',
        duration: 2000
      });
    }
    
    this.setData({
      goldenShieldCircles,
      hasGoldenShield,
      inGoldenShield,
      goldenShieldExpiresAt
    });
    
    // 合并所有圆圈
    this.mergeAllCircles();
  },

  // 计算两点距离（米）
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // 地球半径（米）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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
    
    // 检查金身状态
    if (this.data.inGoldenShield) {
      wx.showModal({
        title: '🛡️ 金身保护中',
        content: '你正在金身保护圈内，无法被扫码抓住！\n\n离开保护圈后，二维码才能被扫描。',
        showCancel: true,
        cancelText: '知道了',
        confirmText: '仍要查看',
        success: (res) => {
          if (res.confirm) {
            this.navigateToQRCode();
          }
        }
      });
      return;
    }
    
    this.navigateToQRCode();
  },
  
  // 跳转到二维码页面
  navigateToQRCode() {
    // 生成二维码数据
    const qrData = {
      gameId: this.data.gameId,
      playerId: this.data.playerId,
      role: this.data.playerRole,
      nickname: '我'
    };
    
    // 添加金身状态
    const hasGoldenShield = this.data.hasGoldenShield;
    
    // 尝试使用预缓存
    try {
      const app = getApp();
      if (app && app.globalData && app.globalData.qrCodePath) {
        console.log('[二维码] 使用预缓存:', app.globalData.qrCodePath);
        wx.navigateTo({
          url: `/pages/qrcode/qrcode?cached=1&data=${encodeURIComponent(JSON.stringify(app.globalData.qrCodeData || qrData))}&path=${encodeURIComponent(app.globalData.qrCodePath)}&goldenShield=${hasGoldenShield ? 1 : 0}`
        });
        return;
      }
    } catch (e) {
      console.log('[二维码] 获取缓存失败:', e);
    }
    
    // 没有缓存，实时生成
    const qrText = JSON.stringify(qrData);
    wx.navigateTo({
      url: `/pages/qrcode/qrcode?data=${encodeURIComponent(qrText)}&goldenShield=${hasGoldenShield ? 1 : 0}`
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
          
          // 调用抓住 API
          const result = await gameAPI.catchPlayer(
            this.data.gameId,
            this.data.playerId,
            qrData.playerId
          );
          
          wx.showModal({
            title: '🎉 抓住成功！',
            content: `你已抓住 ${qrData.nickname}，共抓住 ${result.catchCount} 只老鼠，剩余 ${result.remaining} 只`,
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
      itemList: ['隐身 👻'],
      success: async (res) => {
        const itemId = 'invisible';
        
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
      case 'invisible':
        wx.showToast({
          title: '👻 隐身 15 秒',
          icon: 'success',
          duration: 2000
        });
        break;
      case 'eagleEye':
        const stacks = effect.stacks || 1;
        wx.showToast({
          title: `🦅 鹰眼启动！视野+${stacks * 50}%`,
          icon: 'success',
          duration: 2000
        });
        break;
      case 'goldenShield':
        wx.showToast({
          title: `🛡️ 金身开启！圈内保护`,
          icon: 'success',
          duration: 2000
        });
        this.setData({ 
          hasGoldenShield: true,
          goldenShieldExpiresAt: Date.now() + effect.duration * 1000
        });
        break;
      case 'bombard_select':
        // 进入轰炸点选择模式
        this.setData({ 
          selectingBombard: true,
          bombardPreviewCircle: null,
          bombardPreviewLat: null,
          bombardPreviewLng: null
        });
        // 不显示toast，直接进入选择模式，由遮罩层显示提示
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

  // ==================== 弹幕和历史记录 ====================

  // 显示弹幕
  showDanmaku(event) {
    const danmakuList = this.data.danmakuList;
    danmakuList.push({
      ...event,
      show: true
    });
    
    // 最多保留5条弹幕
    if (danmakuList.length > 5) {
      danmakuList.shift();
    }
    
    this.setData({ danmakuList });
    
    // 3秒后隐藏
    setTimeout(() => {
      const list = this.data.danmakuList;
      const index = list.findIndex(d => d.time === event.time);
      if (index !== -1) {
        list[index].show = false;
        this.setData({ danmakuList: list });
      }
    }, 3000);
  },

  // 显示历史记录
  onShowHistory() {
    this.setData({ showHistory: true });
  },

  // 关闭历史记录
  onCloseHistory() {
    this.setData({ showHistory: false });
  },

  hideRoleTip() {
    this.setData({ showRoleTip: false });
  },

  hideScreenTip() {
    this.setData({ showScreenTip: false });
  },

  // 切换记分板显示/隐藏
  toggleScoreBoard() {
    this.setData({ showScoreBoard: !this.data.showScoreBoard });
  },

  // 展开/收起所有玩家
  toggleAllPlayers() {
    this.setData({ showAllPlayers: !this.data.showAllPlayers });
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
        // 处理道具效果
        if (res.effect) {
          this.handleItemEffect(res.effect);
        } else {
          wx.showToast({ 
            title: `购买${res.itemName}成功！`, 
            icon: 'success' 
          });
        }
        this.setData({ myScore: res.remainingScore });
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
    
    // 如果正在选择轰炸点
    if (this.data.selectingBombard && e.detail && e.detail.latitude) {
      this.showBombardPreview(e.detail.latitude, e.detail.longitude);
      return;
    }
  },

  // 显示轰炸预览
  showBombardPreview(latitude, longitude) {
    // 显示预览圆圈（200米半径）
    const previewCircle = {
      latitude: latitude,
      longitude: longitude,
      radius: 200,
      color: '#FF0000',
      fillColor: '#FF000020',
      strokeWidth: 3
    };
    
    this.setData({
      bombardPreviewCircle: previewCircle,
      bombardPreviewLat: latitude,
      bombardPreviewLng: longitude
    });
    
    // 更新圆圈显示（包含预览圈）
    this.mergeAllCircles();
    
    // 弹出确认框
    wx.showModal({
      title: '💣 确认轰炸点',
      content: `确认在此位置设置轰炸点？\n30秒后引爆，半径200米内玩家将扣除50积分。`,
      confirmText: '确认轰炸',
      cancelText: '重新选择',
      success: (res) => {
        if (res.confirm) {
          this.setBombardTarget(latitude, longitude);
        } else {
          // 取消预览，继续选择
          this.setData({
            bombardPreviewCircle: null,
            bombardPreviewLat: null,
            bombardPreviewLng: null
          });
          this.mergeAllCircles();
        }
      }
    });
  },

  // 设置轰炸目标点
  async setBombardTarget(latitude, longitude) {
    if (!this.data.selectingBombard) return;
    
    this.setData({ 
      selectingBombard: false,
      bombardPreviewCircle: null
    });
    
    wx.showLoading({ title: '设置轰炸点...' });
    
    try {
      const res = await gameAPI.setBombardTarget(
        this.data.gameId,
        this.data.playerId,
        latitude,
        longitude
      );
      
      wx.hideLoading();
      
      if (res.success) {
        wx.showModal({
          title: '💣 轰炸点已设置',
          content: `轰炸将在 30 秒后引爆！\n半径 200 米内的玩家将扣除 50 积分`,
          showCancel: false
        });
        
        // 更新轰炸区域列表
        this.updateBombardCircles();
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '设置失败', icon: 'none' });
    }
  },
  
  // 取消轰炸选择
  cancelBombardSelect() {
    this.setData({ 
      selectingBombard: false,
      bombardPreviewCircle: null,
      bombardPreviewLat: null,
      bombardPreviewLng: null
    });
    this.mergeAllCircles();
    wx.showToast({ title: '已取消轰炸', icon: 'none' });
  },

  // 更新轰炸区域显示
  updateBombardCircles() {
    const bombardZones = this.data.bombardZones || [];
    const bombardCircles = [];
    
    bombardZones.forEach(zone => {
      if (zone.status === 'pending') {
        // 计算剩余时间
        const remainingMs = zone.detonateAt - Date.now();
        const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
        
        bombardCircles.push({
          id: zone.id,
          latitude: zone.center.latitude,
          longitude: zone.center.longitude,
          radius: zone.radius,
          color: '#FF0000', // 红色边框
          fillColor: '#FF000015', // 红色半透明填充
          strokeWidth: 4
        });
      }
    });
    
    this.setData({ bombardCircles });
    
    // 合并所有圆圈
    this.mergeAllCircles();
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
