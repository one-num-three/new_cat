const presentation=require('../../utils/presentation');
const preview = require('../../utils/dev-preview');
Page({
  onResize(e) { this.setData(presentation.resize(e)); },
  data:{cases:[],available:false},
  onLoad(){this.setData(presentation.metrics());const available=preview.enabled();this.setData({available,cases:available?preview.cases:[],groups:available?preview.groups:[]});if(!available)wx.reLaunch({url:'/pages/index/index'});},
  openCalibration(){wx.navigateTo({url:'/pages/calibrate/calibrate?devPreview=calibrate'});},
  home(){wx.reLaunch({url:'/pages/index/index'});},
  openCampus(e){if(!preview.enabled())return;wx.navigateTo({url:'/pages/map/map?devPreview=mouse&mapId='+encodeURIComponent(e.currentTarget.dataset.map)});},
  openVenue(){wx.navigateTo({url:'/pages/venue/venue'});},
  simulateJiulonghu(){if(!preview.enabled())return;wx.navigateTo({url:'/pages/venue/venue?mapId=seu-jiulonghu-v1&simPosition=jiulonghu-meiyuan7b'});},
  simulateJiulonghuBoundary(){if(!preview.enabled())return;wx.navigateTo({url:'/pages/venue/venue?mapId=seu-jiulonghu-v1&simPosition=jiulonghu-northeast'});},
  open(e){if(!preview.enabled())return;const item=preview.cases.find(x=>x.id===e.currentTarget.dataset.id);if(item)wx.navigateTo({url:item.path});}
});
