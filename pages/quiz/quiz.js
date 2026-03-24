// pages/quiz/quiz.js
const { gameAPI } = require('../../utils/api');

Page({
  data: {
    devMode: true,         // 开发模式：显示答案
    gameId: null,
    playerId: null,
    taskPointId: '',       // 任务点ID
    questions: [],         // 5道题目
    currentQuestion: 0,    // 当前第几题 (0-4)
    currentQuestionData: null, // 当前题目数据
    selectedOption: null,  // 选择的选项
    answered: false,       // 是否已作答
    showExplanation: false, // 是否显示解析
    correctCount: 0,       // 答对题数
    accumulatedScore: 0,   // 累计得分
    countdown: 15,         // 倒计时
    countdownPercent: 100, // 倒计时进度
    showResult: false,     // 显示结果弹窗
  },

  countdownTimer: null,

  onLoad(options) {
    console.log('[问答页] onLoad', options);
    
    // 检查是否已有待领取奖励（从 Storage 读取）
    const pendingReward = wx.getStorageSync('pendingTaskReward');
    if (pendingReward) {
      // 检查是否是同一个任务点的奖励
      if (pendingReward.taskPointId === options.taskPointId) {
        console.log('[问答页] 同一任务点已有待领取奖励');
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
        console.log('[问答页] 不同任务点，清除旧奖励');
        wx.removeStorageSync('pendingTaskReward');
      }
    }
    
    if (options.gameId && options.playerId) {
      this.setData({
        gameId: options.gameId,
        playerId: options.playerId,
        taskPointId: options.taskPointId || ''
      });
      
      // 获取题目
      this.loadQuestions();
    }
  },

  onUnload() {
    this.stopCountdown();
  },

  // 从服务器获取题目
  async loadQuestions() {
    try {
      const res = await gameAPI.getQuizQuestions(this.data.gameId, this.data.playerId);
      if (res.success && res.questions) {
        this.setData({ questions: res.questions });
        this.startQuestion();
      }
    } catch (err) {
      console.error('[问答] 获取题目失败', err);
      wx.showToast({ title: '获取题目失败', icon: 'none' });
    }
  },

  // 开始一道题
  startQuestion() {
    const { questions, currentQuestion } = this.data;
    if (currentQuestion >= questions.length) {
      this.endGame();
      return;
    }
    
    this.setData({
      currentQuestionData: questions[currentQuestion],
      selectedOption: null,
      answered: false,
      showExplanation: false,
      countdown: 15,
      countdownPercent: 100
    });
    
    this.startCountdown();
  },

  // 开始倒计时
  startCountdown() {
    this.stopCountdown();
    
    this.countdownTimer = setInterval(() => {
      const countdown = this.data.countdown - 1;
      const countdownPercent = (countdown / 15) * 100;
      
      if (countdown <= 0) {
        // 时间到，自动提交
        this.stopCountdown();
        this.submitAnswer();
      } else {
        this.setData({ countdown, countdownPercent });
      }
    }, 1000);
  },

  // 停止倒计时
  stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  },

  // 选择选项
  onSelectOption(e) {
    if (this.data.answered) return;
    
    const option = e.currentTarget.dataset.option;
    this.setData({ selectedOption: option });
  },

  // 提交答案
  submitAnswer() {
    if (this.data.answered) return;
    
    this.stopCountdown();
    
    const { currentQuestionData, selectedOption, currentQuestion, questions } = this.data;
    const isCorrect = selectedOption === currentQuestionData.answer;
    
    // 保存用户答案到题目中
    if (questions[currentQuestion]) {
      questions[currentQuestion].userAnswer = selectedOption;
    }
    
    if (isCorrect) {
      this.setData({
        correctCount: this.data.correctCount + 1,
        accumulatedScore: this.data.accumulatedScore + 10
      });
    }
    
    this.setData({ 
      answered: true,
      showExplanation: true,
      questions: questions
    });
    
    // 等待3秒后进入下一题
    setTimeout(() => {
      this.nextQuestion();
    }, 3000);
  },

  // 下一题
  nextQuestion() {
    const nextIndex = this.data.currentQuestion + 1;
    
    if (nextIndex >= 5) {
      this.endGame();
    } else {
      this.setData({ currentQuestion: nextIndex });
      this.startQuestion();
    }
  },

  // 游戏结束
  async endGame() {
    this.stopCountdown();
    
    this.setData({ showResult: true });
    
    // 保存待领取奖励（使用 Storage 更可靠）
    const pendingReward = {
      taskPointId: this.data.taskPointId,  // 关联任务点ID
      taskType: 'quiz',
      correctCount: this.data.correctCount,
      reward: this.data.accumulatedScore,
      completedAt: Date.now()
    };
    
    // 同时保存到 globalData 和 Storage
    const app = getApp();
    if (app) {
      if (!app.globalData) {
        app.globalData = {};
      }
      app.globalData.pendingTaskReward = pendingReward;
    }
    
    // 保存到本地存储
    wx.setStorageSync('pendingTaskReward', pendingReward);
    console.log('[趣味问答] ✅ 已保存待领取奖励:', pendingReward);
    
    wx.vibrateShort({ type: 'medium' });
  },

  // 重新开始
  onRestart() {
    this.setData({
      currentQuestion: 0,
      selectedOption: null,
      answered: false,
      showExplanation: false,
      correctCount: 0,
      accumulatedScore: 0,
      countdown: 15,
      countdownPercent: 100,
      showResult: false
    });
    
    this.loadQuestions();
  },

  // 返回游戏
  onBack() {
    wx.navigateBack();
  }
});