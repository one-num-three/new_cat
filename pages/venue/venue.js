const presentation = require('../../utils/presentation');
const catalog=require('../../utils/venue-catalog');
const foreground=require('../../utils/foreground-location'),osm=require('../../utils/osm-art-registration'),mapMarkers=require('../../utils/map-markers');
const scenarios=require('../../utils/location-scenarios');
const modelResources=require('../../utils/model-resources'),modelMap=require('../../utils/model-map');

function layoutKey(metrics) {
  return [metrics.viewportWidth, metrics.viewportHeight, metrics.fontScale, metrics.navHeight, metrics.safeBottom].join(':');
}

Page({
  data: {
    navHeight:64, viewportWidth:390, viewportHeight:844, fontScale:1, safeBottom:0,
    mapId:catalog.DEFAULT_ID,venueOptions:catalog.options,venueMapIndex:0,venueName:catalog.get().label,layoutKey:'', venueSource:'/assets/maps/xuanwu-lake-v4.jpg',locationOn:false,locationText:'点定位图标，查看真实本人位置',locationError:'',coordinateText:'',geoData:{points:[],regions:[]},artMode:true,modelMode:false,layerLoading:false,markers:[],latitude:32.0584,longitude:118.7968,hasPosition:false,followSelf:true
  },
  onLoad(options={}) { this.selectMap(options.mapId||catalog.DEFAULT_ID);this.refreshLayout();this.simulation=scenarios.get(options.simPosition,this.data.mapId);if(options.simPosition&&!this.simulation)this.setData({locationError:'模拟定位仅限电脑开发工具；真机请点准星获取实际位置'}); },
  selectMap(id){const image=catalog.get(id);if(!image){this.setData({venueError:'未知场地地图'});return;}if(this.simulation&&id!=='seu-jiulonghu-v1'){this.simulation=null;this.simulationStopped=true;this.stopGps();}this.setData({...(id!=='seu-jiulonghu-v1'&&this.data.modelMode?{modelMode:false,artMode:true}:{}),mapId:image.id,venueSource:image.src,venueName:image.label,venueMapIndex:catalog.options.findIndex(x=>x.id===image.id),venueError:''});if(this.position)this.displayPosition(this.position);},
  selectVenueMap(e){const item=catalog.options[Number(e.detail.value)];if(item)this.selectMap(item.id);},
  onShow() { this.active=true;this.refreshLayout();if(this.simulation&&!this.simulationStopped)this.startSimulation();else if(this.resumeLocationAfterResource){this.resumeLocationAfterResource=false;this.locate();} },
  onHide(){this.stopGps();this.active=false;},onUnload(){this.unloaded=true;this.stopGps();this.active=false;},
  locate(){
    if(this.simulation){this.simulationStopped=false;this.startSimulation();this.focusPosition();return;}
    if(this.data.locationOn&&this.position){this.focusPosition();return;}
    if(this.gps?.isActive())this.gps.stop();
    this.active=true;this.setData({locationOn:true,locationError:'',locationText:'正在获取真实位置…'});
    if(!this.gps)this.gps=foreground.create(p=>{if(this.active&&this.data.locationOn)this.displayPosition(p);},e=>{if(!this.active)return;this.position=null;const denied=/auth|deny|denied|permission/i.test(e?.errMsg||'');this.setData({locationOn:!!this.gps?.isActive(),hasPosition:false,geoData:{points:[],regions:[]},markers:[],coordinateText:'',locationText:'暂无可用位置',locationError:denied?'请在微信设置中允许定位后重试':e?.message||e?.errMsg||'定位未完成，请重试'});});
    this.gps.start();
  },
  displayPosition(p){
    this.position=p;const projected=this.data.modelMode?modelMap.project(p,this.data.mapId):osm.project(p,'gcj02',this.data.mapId),first=!this.data.hasPosition,simulated=!!p.simulated;
    const notice=!osm.available(this.data.mapId)?'此地图的定位参考尚未启用，可切换实时地图':catalog.contains(this.data.mapId,p)?'当前位置超出图片参考范围；可切换实时地图':'当前位置远离所选场地，请核对场地或切换实时地图';
    this.setData({hasPosition:true,simulated,...(first||this.data.followSelf?{latitude:p.lat,longitude:p.lng}:{}),locationText:simulated?'模拟定位 · '+p.label:'本人 · 精度约'+Math.round(p.accuracy)+'米',coordinateText:(simulated?'模拟 ':'')+'GCJ-02 '+p.lat.toFixed(6)+', '+p.lng.toFixed(6),locationError:this.data.modelMode?(projected?'3D近似参考，实地精度待核验':'位置超出模型参考，请切实时地图'):!this.data.artMode?'':projected?'OSM参考位置，实地精度待核验':notice,geoData:{points:[{...p,tone:'self',label:simulated?'模拟本人':'本人'}],regions:[]},markers:[{id:1,latitude:p.lat,longitude:p.lng,...mapMarkers.sprite('self')} ]});
    if(first&&projected){this.needsInitialFocus=true;wx.nextTick(()=>{if(this.position===p)this.onArtReady();});}
  },
  onArtReady(){if(this.active&&this.position&&this.needsInitialFocus&&this.data.artMode&&this.selectComponent('.venueArt')?.focusSelf())this.needsInitialFocus=false;},
  focusPosition(){if((this.data.artMode||this.data.modelMode)&&!this.selectComponent(this.data.modelMode?'.campusModel':'.venueArt')?.focusSelf())this.setData({locationError:'本人位置超出此图参考或地图未就绪，请切换实时地图'});else if(!this.data.artMode&&!this.data.modelMode&&this.position)this.setData({latitude:this.position.lat,longitude:this.position.lng,followSelf:true});},
  startSimulation(){if(this.gps)this.gps.stop();this.setData({locationOn:true});this.displayPosition(this.simulation);},
  stopGps(e){if(e?.currentTarget)this.simulationStopped=true;if(this.gps)this.gps.stop();this.position=null;this.needsInitialFocus=false;this.setData({locationOn:false,hasPosition:false,simulated:false,locationText:'点定位图标，查看真实本人位置',locationError:'',coordinateText:'',geoData:{points:[],regions:[]},markers:[]});},
  toggleLayer(){if(this.data.layerLoading)return;if(this.data.mapId!=='seu-jiulonghu-v1'){this.selectMapLayer(this.data.artMode?'native':'art');return;}wx.showActionSheet({itemList:['像素地图','实时地图','3D校园 · 体量示意'],success:r=>this.selectMapLayer(['art','native','model'][r.tapIndex])});},
  async selectMapLayer(layer){if(!['art','native','model'].includes(layer)||this.data.layerLoading)return;const id=this.data.mapId;if(layer==='model'&&!modelMap.available(id))return;this.setData({layerLoading:true});try{if(layer==='model'){this.resumeLocationAfterResource=this.data.locationOn&&!this.simulation;await modelResources.ensure();}if(this.unloaded||id!==this.data.mapId)return;this.setData({artMode:layer==='art',modelMode:layer==='model'});if(this.position)this.displayPosition(this.position);}catch(e){if(this.active)this.setData({locationError:e.message});}finally{this.resumeLocationAfterResource=false;if(!this.unloaded)this.setData({layerLoading:false});}},
  useArtMap(){this.selectMapLayer('art');},
  modelZoomIn(){this.selectComponent('.campusModel')?.zoomIn();},modelZoomOut(){this.selectComponent('.campusModel')?.zoomOut();},modelReset(){this.selectComponent('.campusModel')?.reset();},tiltModel(){this.selectComponent('.campusModel')?.tilt();},
  onNativeRegion(e){if((e.causedBy||e.detail?.causedBy)==='gesture')this.setData({followSelf:false});},
  onResize(event) { this.refreshLayout(event); },
  refreshLayout(event) {
    const metrics = event ? presentation.resize(event) : presentation.metrics();
    this.setData({...metrics, layoutKey:layoutKey(metrics)});
  },
  goBack() {
    wx.navigateBack({delta:1, fail() { wx.reLaunch({url:'/pages/index/index'}); }});
  }
});
