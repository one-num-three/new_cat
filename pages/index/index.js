// pages/index/index.js
const { systemAPI } = require('../../utils/api');

Page({
  data: {
    hasGame: false,
    gameInfo: null,
    serverVersion: '',
    serverVersionDate: ''
  },

  onLoad() {
    this.fetchVersion();
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
    wx.navigateTo({ url: '/pages/room/room?action=create' });
  },

  // 加入游戏
  onJoinGame() {
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
