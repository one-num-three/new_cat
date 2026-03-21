// pages/index/index.js
const app = getApp();

Page({
  data: {
    hasGame: false,
    gameInfo: null
  },

  onLoad() {
    console.log('首页加载，服务器地址:', app.globalData.serverUrl);
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
