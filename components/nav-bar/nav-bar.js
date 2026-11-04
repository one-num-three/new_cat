const {metrics,resize}=require('../../utils/presentation');
Component({
 options:{styleIsolation:'apply-shared'},
 properties:{pinned:{type:Boolean,value:false},title:{type:String,value:'猫鼠行动'},back:{type:Boolean,value:false},preview:{type:Boolean,value:false}},
 data:{statusHeight:20,barHeight:44},
 lifetimes:{attached(){this.syncMetrics();}},
 pageLifetimes:{show(){this.syncMetrics();},resize(e){this.syncMetrics(e);}},
 methods:{
  syncMetrics(e){const m=e?resize(e):metrics();this.setData({...m,barHeight:m.navHeight-m.statusHeight});},
  goBack(){if(this.data.preview)wx.reLaunch({url:'/pages/dev/dev'});else if(getCurrentPages().length>1)wx.navigateBack();else wx.reLaunch({url:'/pages/index/index'});}
 }
});

