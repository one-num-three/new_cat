const resources=require('../../../utils/model-resources');
Page({onLoad(){wx.navigateBack({delta:1,success:()=>resources.markLoaded(),fail:()=>{resources.markLoaded();wx.redirectTo({url:'/pages/venue/venue?mapId=seu-jiulonghu-v1'});}});}});
