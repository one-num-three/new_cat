const config = require('./utils/config');
App({
  onShow(){require('./utils/location-v2').setForeground(true);},
  onHide(){require('./utils/location-v2').setForeground(false);},
  onLaunch() {
    if (config.mode === 'cloud' && wx.cloud) wx.cloud.init({ env: config.cloudEnv, traceUser: false });
  },
  globalData: { roomId: null }
});
