const {metrics}=require('../../utils/presentation');
Component({options:{styleIsolation:'apply-shared'},properties:{pinned:{type:Boolean,value:false},title:{type:String,value:'猫鼠行动'},back:{type:Boolean,value:false},preview:{type:Boolean,value:false}},data:{statusHeight:20,barHeight:44},lifetimes:{attached(){const m=metrics();this.setData({...m,barHeight:m.navHeight-m.statusHeight});}},methods:{goBack(){if(this.data.preview)wx.reLaunch({url:'/pages/dev/dev'});else if(getCurrentPages().length>1)wx.navigateBack();else wx.reLaunch({url:'/pages/index/index'});}}});

