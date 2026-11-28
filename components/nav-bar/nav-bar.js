const {metrics,resize}=require('../../utils/presentation');
Component({
 options:{styleIsolation:'apply-shared'},
 properties:{pinned:{type:Boolean,value:false},title:{type:String,value:'猫鼠行动'},back:{type:Boolean,value:false},preview:{type:Boolean,value:false},custom:{type:Boolean,value:false}},
 data:{statusHeight:20,barHeight:44},
 lifetimes:{attached(){this.syncMetrics();}},
 pageLifetimes:{show(){this.syncMetrics();},resize(e){this.syncMetrics(e);}},
 methods:{
  syncMetrics(e){const m=e?resize(e):metrics(),next={...m,barHeight:Math.max(40,m.navHeight-m.statusHeight)};if(Object.keys(next).some(k=>this.data[k]!==next[k]))this.setData(next);},
  goBack(){if(this.data.preview)wx.reLaunch({url:'/pages/dev/dev'});else if(getCurrentPages().length>1)wx.navigateBack({delta:1,fail:()=>wx.reLaunch({url:'/pages/index/index'})});else wx.reLaunch({url:'/pages/index/index'});}
 }
});

