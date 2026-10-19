const {SOURCE_WIDTH, SOURCE_HEIGHT, MIN_SCALE, MAX_SCALE, clampScale, fitContain} = require('../../utils/venue-camera');

Component({
  properties: {
    src: {type:String, value:'/assets/maps/xuanwu-lake-v3.png'},
    sourceWidth: {type:Number, value:SOURCE_WIDTH},
    sourceHeight: {type:Number, value:SOURCE_HEIGHT},
    layoutKey: {type:String, value:''},
    compact: {type:Boolean, value:false}
  },
  data: {
    fitReady:false, imageState:'loading', imageNodes:[], cameraNodes:[],
    fitWidth:0, fitHeight:0, x:0, y:0, scaleValue:1,
    zoomLabel:'1.00×', canZoomOut:false, canZoomIn:true
  },
  observers: {
    src() {
      if (this._alive) this._reloadImage();
    },
    'layoutKey, compact, sourceWidth, sourceHeight'() {
      if (this._alive) this._scheduleFit();
    }
  },
  lifetimes: {
    attached() {
      this._alive = true;
      this._measureSerial = this._measureSerial || 0;
      this._cameraSerial = this._cameraSerial || 0;
      this._imageSerial = this._imageSerial || 0;
      this._camera = {x:0, y:0, scale:1};
      this._reloadImage();
      this._scheduleFit();
    },
    detached() {
      this._alive = false;
      this._measureSerial += 1;
      this._imageSerial += 1;
      this._cameraSerial += 1;
    }
  },
  methods: {
    _scheduleFit() {
      const serial = ++this._measureSerial;
      // Wait for the parent's flex layout and font/viewport changes to render.
      wx.nextTick(() => {
        if (!this._alive || serial !== this._measureSerial) return;
        this.createSelectorQuery().select('.venueViewport').boundingClientRect(rect => {
          if (!this._alive || serial !== this._measureSerial) return;
          const fit = fitContain(rect && rect.width, rect && rect.height, this.data.sourceWidth, this.data.sourceHeight);
          if (!fit.valid) {
            this._fit = null;
            this.setData({fitReady:false, cameraNodes:[]});
            return;
          }
          this._fit = fit;
          this._resetCamera();
        }).exec();
      });
    },
    _resetCamera() {
      if (!this._alive || !this._fit) return;
      const fit = this._fit;
      this._camera = {x:fit.x, y:fit.y, scale:MIN_SCALE};
      // A new native node also resets native gesture state when bound x/y/scale
      // still equal their old values. No CSS transform or image-axis scaling.
      this.setData({
        fitReady:true, fitWidth:fit.width, fitHeight:fit.height,
        x:fit.x, y:fit.y, scaleValue:MIN_SCALE,
        cameraNodes:[++this._cameraSerial], zoomLabel:'1.00×',
        canZoomOut:false, canZoomIn:true
      });
    },
    _reloadImage() {
      const generation = ++this._imageSerial;
      this.setData({imageState:this.data.src ? 'loading' : 'error', imageNodes:[]});
      wx.nextTick(() => {
        if (!this._alive || generation !== this._imageSerial || !this.data.src) return;
        this.setData({imageNodes:[generation]});
      });
    },
    _currentImage(event) {
      return this._alive && Number(event.currentTarget.dataset.generation) === this._imageSerial;
    },
    onImageLoad(event) {
      if (this._currentImage(event) && this.data.imageState !== 'ready') this.setData({imageState:'ready'});
    },
    onImageError(event) {
      if (this._currentImage(event) && this.data.imageState !== 'error') this.setData({imageState:'error'});
    },
    retry() {
      if (!this._alive) return;
      // Remount the same packaged image: no cache-busting network request.
      this._reloadImage();
      this._scheduleFit();
    },
    reset() {
      this._resetCamera();
    },
    _currentCamera(event) {
      return this._alive && Number(event.currentTarget.dataset.camera) === this._cameraSerial;
    },
    _rememberPosition(detail) {
      if (Number.isFinite(detail.x)) this._camera.x = detail.x;
      if (Number.isFinite(detail.y)) this._camera.y = detail.y;
    },
    onMove(event) {
      if (this._currentCamera(event)) this._rememberPosition(event.detail || {});
    },
    onScale(event) {
      if (!this._currentCamera(event)) return;
      const detail = event.detail || {};
      this._rememberPosition(detail);
      if (Number.isFinite(detail.scale)) this._camera.scale = clampScale(detail.scale);
      // The native component renders every gesture frame; no setData here.
    },
    onGestureEnd(event) {
      if (!this._currentCamera(event)) return;
      if (event.touches && event.touches.length) return;
      const serial = this._cameraSerial;
      wx.nextTick(() => {
        if (this._alive && serial === this._cameraSerial) this._commitCamera();
      });
    },
    _commitCamera() {
      const camera = this._camera;
      const values = {
        x:camera.x, y:camera.y, scaleValue:camera.scale,
        zoomLabel:camera.scale.toFixed(2) + '×',
        canZoomOut:camera.scale > MIN_SCALE, canZoomIn:camera.scale < MAX_SCALE
      };
      const patch = {};
      Object.keys(values).forEach(key => {
        if (values[key] !== this.data[key]) patch[key] = values[key];
      });
      if (Object.keys(patch).length) this.setData(patch);
    },
    _zoomBy(delta) {
      if (!this._alive || !this._fit || this.data.imageState !== 'ready') return;
      this._camera.scale = clampScale(this._camera.scale + delta);
      this._commitCamera();
    },
    zoomIn() { this._zoomBy(0.25); },
    zoomOut() { this._zoomBy(-0.25); }
  }
});
