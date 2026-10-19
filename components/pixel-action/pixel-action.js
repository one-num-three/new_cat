const dimensions=require('../../utils/pixel-button-dimensions');
Component({
 options:{styleIsolation:'apply-shared'},
 properties:{skin:{type:String,value:''},label:{type:String,value:''},tone:{type:String,value:'orange'},disabled:{type:Boolean,value:false},loading:{type:Boolean,value:false},dynamic:{type:Boolean,value:false},fontScale:{type:Number,value:1}},
 data:{artWidth:750,artHeight:130,artFailed:false},
 observers:{skin(){const size=dimensions[this.data.skin];this.setData({artFailed:false,...(size?{artWidth:size[0],artHeight:size[1]}:{})});this.notifyLayout();},'fontScale,dynamic,loading'(){this.notifyLayout();}},
 methods:{
  notifyLayout(){this.triggerEvent('layout',{}, {bubbles:true,composed:true});},
  loaded(e){const {width,height}=e.detail||{};if(Number.isFinite(width)&&width>0&&Number.isFinite(height)&&height>0){this.setData({artWidth:width,artHeight:height,artFailed:false});this.notifyLayout();}},
  failed(){this.setData({artFailed:true});this.notifyLayout();},
  activate(){if(!this.data.disabled&&!this.data.loading)this.triggerEvent('action');}
 }
});
