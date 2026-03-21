// pages/profile/profile.js - 个人中心/登录页面
const app = getApp();
const { userAPI } = require('../../utils/api');

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    gameHistory: []
  },

  onLoad() {
    this.checkLoginStatus();
  },

  checkLoginStatus() {
    const userInfo = app.globalData.userInfo;
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn,
      userInfo
    });
  },

  // 微信登录
  onWechatLogin() {
    wx.login({
      success: async (res) => {
        if (res.code) {
          wx.showLoading({ title: '登录中...' });
          try {
            const result = await userAPI.login(res.code);
            app.globalData.userInfo = result.userInfo;
            app.globalData.isLoggedIn = true;
            wx.setStorageSync('userInfo', result.userInfo);
            wx.setStorageSync('token', result.token);
            wx.hideLoading();
            wx.showToast({ title: '登录成功', icon: 'success' });
            this.checkLoginStatus();
          } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: err.message || '登录失败', icon: 'none' });
          }
        }
      },
      fail: () => {
        wx.showToast({ title: '登录失败', icon: 'none' });
      }
    });
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          app.globalData.userInfo = null;
          app.globalData.isLoggedIn = false;
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('token');
          this.checkLoginStatus();
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      }
    });
  },

  // 查看游戏历史
  onViewHistory() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/history/history' });
  }
})
