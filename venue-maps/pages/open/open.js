const resources=require('../../../utils/venue-resources');
Page({onLoad(options={}){const loaded=()=>resources.markLoaded('venue-maps'),url='/pages/venue/venue?mapId='+(options.mapId==='seu-sipailou-v1'?'seu-sipailou-v1':'seu-jiulonghu-v1');if(options.resource==='1')wx.navigateBack({delta:1,success:loaded,fail:()=>{loaded();wx.redirectTo({url});}});else{loaded();wx.redirectTo({url});}}});
