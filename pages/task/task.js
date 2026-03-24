// pages/task/task.js
const { gameAPI } = require('../../utils/api');

Page({
  data: {
    devMode: true,     // 开发模式：显示答案
    gameId: null,
    playerId: null,
    taskPointId: '',   // 任务点ID
    answer: '',        // 谜底（4位数字）
    inputValue: '',    // 用户输入
    attempts: 0,       // 尝试次数
    lastResult: null,  // 上次结果（正确个数）
    guessHistory: [],  // 猜测历史
    cooldown: 0,       // 冷却倒计时
    canSubmit: false,  // 是否可以提交
    startTime: null,   // 开始时间
    elapsedTime: '0:00', // 用时
    gameEnded: false,  // 游戏是否结束
    showResult: false, // 显示结果弹窗
    reward: 50,        // 奖励积分
    pendingReward: null, // 待领取的奖励信息
  },

  cooldownTimer: null,
  elapsedTimer: null,

  onLoad(options) {
    console.log('[任务页] onLoad', options);
    
    // 检查是否已有待领取奖励（从 Storage 读取）
    const pendingReward = wx.getStorageSync('pendingTaskReward');
    if (pendingReward) {
      // 检查是否是同一个任务点的奖励
      if (pendingReward.taskPointId === options.taskPointId) {
        console.log('[任务页] 同一任务点已有待领取奖励');
        wx.showModal({
          title: '提示',
          content: '你还有待领取的奖励，请先返回任务点领取',
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
        return;
      } else {
        // 不同任务点，清除旧奖励
        console.log('[任务页] 不同任务点，清除旧奖励');
        wx.removeStorageSync('pendingTaskReward');
      }
    }
    
    if (options.gameId && options.playerId) {
      this.setData({
        gameId: options.gameId,
        playerId: options.playerId,
        taskPointId: options.taskPointId || ''
      });
      
      // 从服务器获取谜底
      this.loadRiddle();
    }
    
    // 开始计时
    this.startElapsedTimer();
  },
  
  // 从服务器加载谜底
  async loadRiddle() {
    console.log('[猜数字] loadRiddle 开始');
    try {
      const res = await gameAPI.getTaskRiddle(this.data.gameId, this.data.playerId);
      console.log('[猜数字] getTaskRiddle 返回:', res);
      if (res.success) {
        console.log('[猜数字] ✅ 获取谜底成功:', res.riddle);
        this.setData({
          answer: res.riddle
        });
      } else {
        console.log('[猜数字] ❌ 获取谜底失败:', res.message);
      }
    } catch (err) {
      console.error('[猜数字] 获取谜底失败，使用本地生成', err);
      // 如果获取失败，使用本地生成
      this.generateAnswer();
    }
  },
  
  // 本地生成谜底（备用）
  generateAnswer() {
    const digits = [];
    while (digits.length < 4) {
      const digit = Math.floor(Math.random() * 10);
      if (!digits.includes(digit)) {
        digits.push(digit);
      }
    }
    const answer = digits.join('');
    console.log('[猜数字] 本地生成谜底:', answer);
    this.setData({ answer });
  },

  onUnload() {
    // 清理定时器
    this.stopCooldownTimer();
    this.stopElapsedTimer();
  },

  // 输入变化
  onInputChange(e) {
    const value = e.detail.value;
    
    // 只允许数字
    const numValue = value.replace(/\D/g, '');
    
    this.setData({
      inputValue: numValue,
      canSubmit: numValue.length === 4
    });
  },

  // 提交猜测
  onSubmit() {
    console.log('[猜数字] ========== onSubmit ==========');
    console.log('[猜数字] inputValue:', this.data.inputValue);
    console.log('[猜数字] answer:', this.data.answer);
    console.log('[猜数字] cooldown:', this.data.cooldown);
    console.log('[猜数字] gameEnded:', this.data.gameEnded);
    
    const { inputValue, answer, cooldown, gameEnded } = this.data;
    
    // 检查是否可以提交
    if (cooldown > 0 || gameEnded) {
      console.log('[猜数字] 不能提交: cooldown或gameEnded');
      return;
    }
    
    // 验证输入
    if (inputValue.length !== 4) {
      wx.showToast({
        title: '请输入4位数字',
        icon: 'none'
      });
      return;
    }
    
    // 计算正确个数
    let correct = 0;
    for (let i = 0; i < 4; i++) {
      if (inputValue[i] === answer[i]) {
        correct++;
      }
    }
    console.log('[猜数字] 正确个数:', correct);
    
    // 更新状态
    const attempts = this.data.attempts + 1;
    const guessHistory = [...this.data.guessHistory, {
      guess: inputValue,
      result: correct
    }];
    
    this.setData({
      attempts,
      lastResult: correct,
      guessHistory,
      inputValue: '',
      canSubmit: false
    });
    
    // 检查是否猜对
    if (correct === 4) {
      console.log('[猜数字] ✅ 猜对了！调用 onGameWon');
      this.onGameWon();
      return;
    }
    
    console.log('[猜数字] 没猜对，开始冷却');
    // 开始冷却
    this.startCooldown();
  },

  // 开始冷却倒计时
  startCooldown() {
    this.stopCooldownTimer();
    
    this.setData({ cooldown: 5 });
    
    this.cooldownTimer = setInterval(() => {
      const cooldown = this.data.cooldown - 1;
      
      if (cooldown <= 0) {
        this.stopCooldownTimer();
        this.setData({ cooldown: 0 });
      } else {
        this.setData({ cooldown });
      }
    }, 1000);
  },

  // 停止冷却计时
  stopCooldownTimer() {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  },

  // 开始用时计时
  startElapsedTimer() {
    this.setData({ startTime: Date.now() });
    
    this.elapsedTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.data.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      this.setData({
        elapsedTime: `${minutes}:${seconds.toString().padStart(2, '0')}`
      });
    }, 1000);
  },

  // 停止用时计时
  stopElapsedTimer() {
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
  },

  // 游戏胜利（猜对，但不发放奖励，需要返回任务点领取）
  async onGameWon() {
    console.log('[猜数字] ========== onGameWon 开始 ==========');
    this.stopElapsedTimer();
    this.stopCooldownTimer();
    
    // 计算用时（秒）
    const elapsedSeconds = Math.floor((Date.now() - this.data.startTime) / 1000);
    
    // 计算奖励（基础50分，尝试次数越少奖励越高）
    const attempts = this.data.attempts;
    let reward = 50;
    if (attempts <= 5) {
      reward = 100; // 5次内猜中，奖励100分
    } else if (attempts <= 10) {
      reward = 75; // 10次内猜中，奖励75分
    }
    
    console.log('[猜数字] attempts:', attempts, 'reward:', reward);
    
    // 播放震动
    wx.vibrateShort({ type: 'heavy' });
    
    // 保存待领取奖励（使用 Storage 更可靠）
    const pendingReward = {
      taskPointId: this.data.taskPointId,  // 关联任务点ID
      taskType: 'guessNumber',
      attempts: attempts,
      timeUsed: elapsedSeconds,
      reward: reward,
      guessedAt: Date.now()
    };
    
    console.log('[猜数字] 准备保存 pendingReward:', pendingReward);
    
    try {
      // 保存到本地存储
      wx.setStorageSync('pendingTaskReward', pendingReward);
      console.log('[猜数字] ✅ setStorageSync 调用成功');
      
      // 验证保存成功
      const saved = wx.getStorageSync('pendingTaskReward');
      console.log('[猜数字] 验证读取:', saved);
      
      // 同时保存到 globalData
      const app = getApp();
      if (app) {
        if (!app.globalData) {
          app.globalData = {};
        }
        app.globalData.pendingTaskReward = pendingReward;
        console.log('[猜数字] 也保存到 globalData');
      }
    } catch (e) {
      console.error('[猜数字] 保存失败:', e);
    }
    
    // 显示提示弹窗
    wx.showModal({
      title: '🎉 恭喜猜对！',
      content: `谜底: ${this.data.answer}\n尝试: ${attempts} 次\n用时: ${this.data.elapsedTime}\n\n请返回任务点范围内领取 +${reward} 积分`,
      showCancel: false,
      confirmText: '返回地图',
      success: () => {
        console.log('[猜数字] 用户点击返回地图');
        wx.navigateBack();
      }
    });
  },

  // 重新开始
  onRestart() {
    this.stopCooldownTimer();
    this.stopElapsedTimer();
    
    this.setData({
      inputValue: '',
      attempts: 0,
      lastResult: null,
      guessHistory: [],
      cooldown: 0,
      canSubmit: false,
      startTime: null,
      elapsedTime: '0:00',
      gameEnded: false,
      showResult: false,
      reward: 50,
      pendingReward: null
    });
    
    // 重新加载谜底（玩家可能重新设置了）
    this.loadRiddle();
    
    // 重新开始计时
    this.startElapsedTimer();
  },

  // 返回游戏
  onBack() {
    wx.navigateBack();
  }
});