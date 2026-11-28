const config = require('./utils/config');
function sweepTempFiles() {
  try {
    if (typeof wx === 'undefined' || !('getFileSystemManager' in wx) || !wx.env?.USER_DATA_PATH) return;
    const fs = wx.getFileSystemManager();
    const base = wx.env.USER_DATA_PATH;
    if (typeof fs.readdir !== 'function') return;
    fs.readdir({
      dirPath: base,
      success: res => {
        for (const name of res?.files || []) {
          if (/^(?:capture-|room-invite-|catmouse-)/.test(name)) {
            try { fs.unlink({ filePath: base + '/' + name, fail: () => {} }); } catch {}
          }
        }
      },
      fail: () => {}
    });
  } catch {}
}
App({
  onShow(){require('./utils/location-v2').setForeground(true);},
  onHide(){require('./utils/location-v2').setForeground(false);},
  onLaunch() {
    if (config.mode === 'cloud' && wx.cloud) wx.cloud.init({ env: config.cloudEnv, traceUser: false });
    sweepTempFiles();
    if (typeof wx !== 'undefined' && 'onNeedPrivacyAuthorization' in wx && typeof wx.onNeedPrivacyAuthorization === 'function') {
      try {
        wx.onNeedPrivacyAuthorization(resolve => {
          const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
          const top = pages[pages.length - 1];
          if (top && typeof top.openConsent === 'function') {
            top._privacyResolve = resolve;
            top.openConsent();
          } else {
            resolve({ event: 'disagree' });
          }
        });
      } catch {}
    }
  },
  globalData: { roomId: null }
});
