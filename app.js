const config = require('./utils/config');
App({
  onLaunch() {
    if (config.mode === 'cloud' && wx.cloud) wx.cloud.init({ env: config.cloudEnv, traceUser: false });
  },
  globalData: { roomId: null }
});
