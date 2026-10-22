const resources=require('../../../utils/venue-resources');
Page({onLoad(options={}){const loaded=()=>resources.markLoaded('venue-xuanwu'),url='/pages/venue/venue?mapId=xuanwu-v4';if(options.resource==='1')wx.navigateBack({delta:1,success:loaded,fail:()=>{loaded();wx.redirectTo({url});}});else{loaded();wx.redirectTo({url});}}});
