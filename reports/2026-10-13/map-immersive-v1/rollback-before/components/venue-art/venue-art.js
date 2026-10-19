const geometry=require('../../utils/venue-camera');
const art=require('../../utils/venue-art-config');
const TOUR_ZOOM=1.28, TOUR_LEG_MS=7500;
Component({
 properties:{src:{type:String,value:art.src},sourceWidth:{type:Number,value:art.width},sourceHeight:{type:Number,value:art.height},layoutKey:{type:String,value:''},compact:{type:Boolean,value:false},autoTour:{type:Boolean,value:true}},
 data:{fitReady:false,imageState:'loading',imageNodes:[],fitWidth:0,fitHeight:0,x:0,y:0,scaleValue:1,zoomLabel:'1.00×',canZoomOut:false,canZoomIn:true,mode:'auto',showControls:false,imageAnimation:{}},
 observers:{src(){if(this._alive){this._fit=null;this._userInterrupted=false;this._reloadImage();this._scheduleFit();}},'layoutKey,compact,sourceWidth,sourceHeight'(){if(this._alive)this._scheduleFit(true);},autoTour(value){if(!this._alive)return;if(value&&!this._userInterrupted)this._startTour();else this._stopTour(true);}},
 lifetimes:{attached(){this._alive=true;this._visible=true;this._measureSerial=0;this._imageSerial=0;this._tourSerial=0;this._camera={x:0,y:0,scale:1};this._reloadImage();this._scheduleFit();},detached(){this._alive=false;this._visible=false;this._measureSerial++;this._imageSerial++;this._stopTour(false);this._gesture=null;}},
 pageLifetimes:{hide(){this._resumeAfterShow=this.data.mode==='auto';this._visible=false;this._stopTour(false);this._gesture=null;},show(){this._visible=true;if(this._resumeAfterShow&&!this._userInterrupted)this._startTour();}},
 methods:{
  remeasure(){if(this._alive)this._scheduleFit(true);},
  _bound(c){return geometry.boundCamera(this._vp.width,this._vp.height,this._fit.width,this._fit.height,c);},
  _sample(){if(!this._segment)return {...this._camera};return geometry.interpolate(this._segment.from,this._segment.to,(Date.now()-this._segment.at)/this._segment.duration);},
  _publish(c){this.setData({x:c.x,y:c.y,scaleValue:c.scale,zoomLabel:c.scale.toFixed(2)+'×',canZoomOut:c.scale>1,canZoomIn:c.scale<geometry.MAX_SCALE});},
  _animate(c,duration=0){if(!this._alive)return;const a=wx.createAnimation({duration,timingFunction:'linear',transformOrigin:'0 0'});a.translate3d(c.x,c.y,0).scale(c.scale).step();this.setData({imageAnimation:a.export()});},
  _paint(c){if(!this._alive||!this._fit)return;this._camera=this._bound(c);this._publish(this._camera);this._animate(this._camera,0);},
  _scheduleFit(preserve=true){const serial=++this._measureSerial;wx.nextTick(()=>{if(!this._alive||serial!==this._measureSerial)return;this.createSelectorQuery().select('.venueViewport').boundingClientRect(rect=>{
   if(!this._alive||serial!==this._measureSerial)return;const fit=geometry.fitCover(rect&&rect.width,rect&&rect.height,this.data.sourceWidth,this.data.sourceHeight);
   if(!fit.valid){this._stopTour(false);this._fit=null;this.setData({fitReady:false});return;}
   if(preserve&&this._fit&&this.data.fitReady&&Math.abs(this._fit.width-fit.width)<.01&&Math.abs(this._fit.height-fit.height)<.01){this._vp=rect;return;}
   const oldFit=this._fit,oldVp=this._vp,old=this._sample();this._stopTour(false);this._vp=rect;this._fit=fit;this._gesture=null;
   let c={x:fit.x,y:fit.y,scale:1};if(preserve&&oldFit&&oldVp&&this._userInterrupted){const u=(oldVp.width/2-old.x)/(oldFit.width*old.scale),v=(oldVp.height/2-old.y)/(oldFit.height*old.scale);c={x:rect.width/2-u*fit.width*old.scale,y:rect.height/2-v*fit.height*old.scale,scale:old.scale};}
   this.setData({fitReady:true,fitWidth:fit.width,fitHeight:fit.height});this._paint(c);if(!this._userInterrupted)this._startTour();
  }).exec();});},
  _reloadImage(){this._stopTour(false);const generation=++this._imageSerial;this.setData({imageState:this.data.src?'loading':'error',imageNodes:[],showControls:false});wx.nextTick(()=>{if(this._alive&&generation===this._imageSerial&&this.data.src)this.setData({imageNodes:[generation]});});},
  _currentImage(e){return this._alive&&e.currentTarget&&Number(e.currentTarget.dataset.generation)===this._imageSerial;},
  onImageLoad(e){if(!this._currentImage(e)||this.data.imageState==='ready')return;this.setData({imageState:'ready',...(!this.data.autoTour?{mode:'manual',showControls:true}:{})});this._startTour();},
  onImageError(e){if(!this._currentImage(e))return;this._stopTour(false);this.setData({imageState:'error'});},
  retry(){if(!this._alive)return;this._userInterrupted=false;this._reloadImage();this._scheduleFit();},
  _stopTour(manual){this._tourSerial=(this._tourSerial||0)+1;if(this._tourTimer!=null)clearTimeout(this._tourTimer);this._tourTimer=null;if(this._segment&&this._fit&&this._vp){const c=this._sample();this._segment=null;this._paint(c);}this._segment=null;if(manual&&this._alive){this._userInterrupted=true;this.setData({mode:'manual',showControls:true});}},
  _startTour(){if(!this._alive||!this._visible||!this._fit||this.data.imageState!=='ready'||!this.data.autoTour||this._userInterrupted)return;this._stopTour(false);this.setData({mode:'auto',showControls:false});this._paint(geometry.zoomAt(this._camera,TOUR_ZOOM,this._vp.width/2,this._vp.height/2,this._vp.width,this._vp.height,this._fit.width,this._fit.height));this._tourIndex=0;const serial=this._tourSerial;wx.nextTick(()=>{if(this._alive&&serial===this._tourSerial&&!this._userInterrupted)this._tourLeg(serial);});},
  _tourLeg(serial){if(!this._alive||!this._visible||serial!==this._tourSerial||this._userInterrupted)return;const targets=geometry.perimeter(this._vp.width,this._vp.height,this._fit.width,this._fit.height,TOUR_ZOOM),to=targets[this._tourIndex%4],from={...this._camera};this._segment={from,to,at:Date.now(),duration:TOUR_LEG_MS};this._animate(to,TOUR_LEG_MS);this._tourTimer=setTimeout(()=>{this._tourTimer=null;if(!this._alive||!this._visible||serial!==this._tourSerial)return;this._segment=null;this._camera={...to};this._publish(to);this._tourIndex++;this._tourLeg(serial);},TOUR_LEG_MS);},
  resumeTour(){if(!this._alive)return;this._gesture=null;this._userInterrupted=false;this._startTour();},
  reset(){if(!this._alive||!this._fit)return;this._stopTour(true);this._gesture=null;this._paint({x:this._fit.x,y:this._fit.y,scale:1});},
  _points(e){return (e.touches||[]).slice(0,2).map(t=>{const x=Number.isFinite(t.clientX)?t.clientX:t.pageX,y=Number.isFinite(t.clientY)?t.clientY:t.pageY;return Number.isFinite(x)&&Number.isFinite(y)?{x:x-(this._vp.left||0),y:y-(this._vp.top||0)}:null;}).filter(Boolean);},
  _begin(points){if(!points.length){this._gesture=null;return;}const center=points.length===2?{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}:points[0];this._gesture={count:points.length,center,camera:{...this._camera},distance:points.length===2?Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y):0};this._lastPaintAt=-Infinity;},
  onTouchStart(e){if(!this._alive||!this._visible||!this._fit||this.data.imageState!=='ready')return;const points=this._points(e);if(!points.length)return;this._stopTour(true);this._begin(points);},
  onTouchMove(e){if(!this._alive||!this._visible||!this._gesture||!this._fit)return;const p=this._points(e);if(!p.length)return;if(p.length!==this._gesture.count){this._begin(p);return;}const g=this._gesture;let c;if(p.length===2){const center={x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2},d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(g.distance<1)return;const scale=geometry.clampScale(g.camera.scale*d/g.distance);c={x:center.x-(g.center.x-g.camera.x)*scale/g.camera.scale,y:center.y-(g.center.y-g.camera.y)*scale/g.camera.scale,scale};}else c={x:g.camera.x+p[0].x-g.center.x,y:g.camera.y+p[0].y-g.center.y,scale:g.camera.scale};this._camera=this._bound(c);if(Date.now()-this._lastPaintAt>=32){this._lastPaintAt=Date.now();this._paint(this._camera);}},
  onTouchEnd(e){if(!this._alive||!this._visible||!this._fit)return;this._paint(this._camera);this._begin(this._points(e));},
  _zoom(delta){if(!this._alive||!this._visible||!this._fit||this.data.imageState!=='ready')return;this._stopTour(true);this._gesture=null;this._paint(geometry.zoomAt(this._camera,this._camera.scale+delta,this._vp.width/2,this._vp.height/2,this._vp.width,this._vp.height,this._fit.width,this._fit.height));},
  zoomIn(){this._zoom(.25);},zoomOut(){this._zoom(-.25);}
 }
});
