// pages/index/index.js
const { systemAPI } = require('../../utils/api');

Page({
  data: {
    hasGame: false,
    gameInfo: null,
    serverVersion: '',
    serverVersionDate: '',
    nickname: ''
  },

  onLoad() {
    this.loadNickname();
    this.fetchVersion();
  },

  onShow() {
    this.loadNickname();
  },

  // 加载昵称
  loadNickname() {
    const nickname = wx.getStorageSync('nickname') || '';
    this.setData({ nickname });
  },

  // 昵称输入
  onNicknameInput(e) {
    const nickname = e.detail.value;
    this.setData({ nickname });
  },

  // 昵称保存
  onNicknameBlur() {
    let nickname = this.data.nickname.trim();
    if (!nickname) {
      nickname = '玩家' + Math.floor(Math.random() * 10000);
    }
    this.setData({ nickname });
    wx.setStorageSync('nickname', nickname);
    console.log('[昵称] 已保存:', nickname);
  },

  // 获取服务器版本
  async fetchVersion() {
    try {
      const res = await systemAPI.getVersion();
      this.setData({
        serverVersion: res.version || '',
        serverVersionDate: res.versionDate || ''
      });
    } catch (e) {
      console.log('[版本] 获取失败', e);
    }
  },

  // 创建游戏
  onCreateGame() {
    // 确保昵称已保存
    this.onNicknameBlur();
    wx.navigateTo({ url: '/pages/room/room?action=create' });
  },

  // 加入游戏
  onJoinGame() {
    // 确保昵称已保存
    this.onNicknameBlur();
    wx.showModal({
      title: '加入游戏',
      editable: true,
      placeholderText: '请输入房间号',
      success: (res) => {
        if (res.confirm && res.content) {
          wx.navigateTo({ url: `/pages/room/room?action=join&roomId=${res.content}` });
        }
      }
    });
  }
});
