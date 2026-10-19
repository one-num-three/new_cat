const presentation=require('../../utils/presentation');
const preview = require('../../utils/dev-preview');
Page({
  onResize(e) { this.setData(presentation.resize(e)); },
  data:{cases:[],available:false},
  onLoad(){this.setData(presentation.metrics());const available=preview.enabled();this.setData({available,cases:available?preview.cases:[],groups:available?preview.groups:[]});if(!available)wx.reLaunch({url:'/pages/index/index'});},
  home(){wx.reLaunch({url:'/pages/index/index'});},
  openVenue(){wx.navigateTo({url:'/pages/venue/venue'});},
  open(e){if(!preview.enabled())return;const item=preview.cases.find(x=>x.id===e.currentTarget.dataset.id);if(item)wx.navigateTo({url:item.path});}
});
