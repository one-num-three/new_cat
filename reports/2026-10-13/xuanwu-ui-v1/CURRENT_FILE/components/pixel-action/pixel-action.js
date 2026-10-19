Component({
 options:{styleIsolation:'apply-shared'},
 properties:{skin:{type:String,value:''},label:{type:String,value:''},tone:{type:String,value:'orange'},disabled:{type:Boolean,value:false},loading:{type:Boolean,value:false},dynamic:{type:Boolean,value:false},fontScale:{type:Number,value:1}},
 data:{artWidth:750,artHeight:130,artFailed:false},
 observers:{skin(){this.setData({artFailed:false});}},
 methods:{
  loaded(e){const {width,height}=e.detail||{};if(Number.isFinite(width)&&width>0&&Number.isFinite(height)&&height>0)this.setData({artWidth:width,artHeight:height,artFailed:false});},
  failed(){this.setData({artFailed:true});},
  activate(){if(!this.data.disabled&&!this.data.loading)this.triggerEvent('action');}
 }
});
