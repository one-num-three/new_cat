const resources=require('../../../utils/venue-resources');
Page({onLoad(options){resources.markLoaded('venue-maps');const url='/pages/venue/venue?mapId='+(options.mapId==='seu-sipailou-v1'?'seu-sipailou-v1':'seu-jiulonghu-v1');if(options.resource==='1')wx.navigateBack({delta:1,fail:()=>wx.redirectTo({url})});else wx.redirectTo({url});}});
