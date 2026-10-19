const presentation = require('../../utils/presentation');

function layoutKey(metrics) {
  return [metrics.viewportWidth, metrics.viewportHeight, metrics.fontScale, metrics.navHeight, metrics.safeBottom].join(':');
}

Page({
  data: {
    navHeight:64, viewportWidth:390, viewportHeight:844, fontScale:1, safeBottom:0,
    layoutKey:'', venueSource:'/assets/maps/xuanwu-lake-v3.png'
  },
  onLoad() { this.refreshLayout(); },
  onShow() { this.refreshLayout(); },
  onResize(event) { this.refreshLayout(event); },
  refreshLayout(event) {
    const metrics = event ? presentation.resize(event) : presentation.metrics();
    this.setData({...metrics, layoutKey:layoutKey(metrics)});
  },
  goBack() {
    wx.navigateBack({delta:1, fail() { wx.reLaunch({url:'/pages/index/index'}); }});
  }
});
