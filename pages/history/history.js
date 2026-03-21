// pages/history/history.js - 游戏历史记录页面
const app = getApp();
const { historyAPI } = require('../../utils/api');

Page({
  data: {
    historyList: [],
    isLoading: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    totalGames: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0
  },

  onLoad() {
    this.loadHistory();
  },

  onPullDownRefresh() {
    this.setData({
      page: 1,
      historyList: [],
      hasMore: true
    });
    this.loadHistory().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.isLoading) {
      this.loadHistory();
    }
  },

  // 加载游戏历史
  async loadHistory() {
    if (this.data.isLoading) return;
    
    const userId = app.globalData.userInfo?.id;
    if (!userId) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    this.setData({ isLoading: true });
    
    try {
      const res = await historyAPI.getHistory(userId);
      const history = res.history || [];
      
      // 计算统计数据
      const totalGames = history.length;
      const winCount = history.filter(h => h.result === 'win').length;
      const lossCount = totalGames - winCount;
      const winRate = totalGames > 0 ? Math.round((winCount / totalGames) * 100) : 0;
      
      // 格式化历史记录
      const formattedHistory = history.map(item => ({
        ...item,
        formattedDate: this.formatDate(item.endedAt),
        roleText: item.role === 'cat' ? '猫' : '鼠',
        roleIcon: item.role === 'cat' ? '' : '',
        resultText: item.result === 'win' ? '胜利' : '失败',
        resultClass: item.result === 'win' ? 'win' : 'lose',
        durationText: this.formatDuration(item.settings?.gameDuration)
      }));

      this.setData({
        historyList: formattedHistory,
        totalGames,
        winCount,
        lossCount,
        winRate,
        isLoading: false,
        hasMore: false // 内存缓存一次性返回所有
      });
    } catch (err) {
      console.error('[历史] 加载失败', err);
      this.setData({ isLoading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  // 格式化日期
  formatDate(timestamp) {
    if (!timestamp) return '未知时间';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // 今天
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    // 昨天
    if (diff < 48 * 60 * 60 * 1000 && date.getDate() === now.getDate() - 1) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    // 本周
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return days[date.getDay()] + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    }
    // 更早
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  },

  // 格式化时长
  formatDuration(seconds) {
    if (!seconds) return '10分钟';
    const minutes = Math.floor(seconds / 60);
    return `${minutes}分钟`;
  },

  // 查看详情
  onViewDetail(e) {
    const { index } = e.currentTarget.dataset;
    const item = this.data.historyList[index];
    
    wx.navigateTo({
      url: `/pages/history/detail?gameId=${item.gameId}`
    });
  },

  // 返回首页
  onBackToHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
