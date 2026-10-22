const api=require('../../../utils/v2'),presentation=require('../../../utils/presentation'),catalog=require('../../../utils/venue-catalog'),resources=require('../../../utils/venue-resources'),poster=require('../../../utils/track-poster');
const live=p=>p.active&&p.viewer===wx.getStorageSync('v2UserId');
Page({
 data:{matchId:'',fontScale:1,navHeight:64,loading:false,saving:false,action:'',feedback:'',posterPath:'',notice:'',error:''},
 onLoad(o){this.serial=0;this.files=new Set();this.disposed=false;this.setData({...presentation.metrics(),matchId:o.matchId||''});},
 onShow(){this.active=true;const viewer=wx.getStorageSync('v2UserId');if(this.viewer&&this.viewer!==viewer){this.serial++;this.cleanFiles();this.actionResult=null;this.setData({posterPath:'',notice:'',loading:false,error:'',feedback:''});}this.viewer=viewer;const result=this.actionResult;this.actionResult=null;this.setData({saving:!!this.pendingAction,action:this.pendingAction?.kind||'',...(result?.viewer===viewer&&result.path===this.data.posterPath?result.status:{})});if(this.resume){const resume=this.resume;this.resume=null;resume();}if(!this.data.posterPath&&!this.data.loading)this.load();},
 onHide(){this.active=false;if(!this.resourceLoading){this.serial++;this.setData({loading:false});}},onUnload(){this.disposed=true;this.active=false;this.serial++;if(this.resume){this.resume();this.resume=null;}this.cleanFiles();},onResize(e){this.setData(presentation.resize(e));},
 // Native image menus can outlive the page. Keep their file until the callback,
 // and never let an old identity's completion change a new identity's UI.
 cleanFiles(){for(const f of this.files||[])if(f!==this.pendingAction?.path){this.remove(f);this.files.delete(f);}},
 remove(path){try{wx.getFileSystemManager().unlinkSync(path);}catch{}},
 canvas(){return new Promise((resolve,reject)=>wx.createSelectorQuery().in(this).select('#posterCanvas').fields({node:true}).exec(r=>r?.[0]?.node?resolve(r[0].node):reject(Error('当前环境不支持海报画布，请升级微信'))));},
 async load(){if(!live(this)||this.data.loading||this.pendingAction)return;const run=++this.serial,viewer=this.viewer;this.setData({loading:true,error:'',feedback:'',posterPath:''});let path;
  try{await api.session();const raw=await api.tracks(this.data.matchId,'self');if(!live(this)||run!==this.serial)return;if(raw.matchId!==this.data.matchId||raw.scope!=='self'||raw.schema!=='tracks-v1'||raw.players.length!==1||raw.players[0].id!==viewer)throw Error('本人轨迹响应不匹配');
   const image=catalog.get(raw.venue?.mapId||catalog.DEFAULT_ID);if(!image)throw Error('本局场地地图暂不支持海报');
   // The existing package bootstrap temporarily hides this page. Resume only
   // after it returns; an actual back/unload invalidates the generation below.
   this.resourceLoading=true;try{await resources.ensure(image.id);if(!this.active&&run===this.serial)await new Promise(resolve=>this.resume=resolve);}finally{this.resourceLoading=false;}if(!live(this)||run!==this.serial)return;
   const canvas=await this.canvas();const result=await poster.render(canvas,raw,image);if(!live(this)||run!==this.serial)return;
   path=await new Promise((resolve,reject)=>wx.canvasToTempFilePath({canvas,fileType:'png',destWidth:941,destHeight:1672,success:r=>resolve(r.tempFilePath),fail:reject},this));
   if(!live(this)||run!==this.serial){this.remove(path);return;}this.files.add(path);this.rawViewer=viewer;this.setData({posterPath:path,notice:result.notice,settlementLabel:raw.outcome==='cancelled'?'本局已取消，不计胜负':'本局已结算'});
  }catch(e){if(live(this)&&run===this.serial)this.setData({error:e.message||e.errMsg||'生成失败，请重试'});}
  finally{if(run===this.serial)this.setData({loading:false});}
 },
 async imageAction(kind){if(!live(this)||this.rawViewer!==this.viewer||!this.data.posterPath||this.pendingAction)return;
  let method={save:'saveImageToPhotosAlbum',share:'showShareImageMenu',preview:'previewImage'}[kind];if(!method)return;
  if(kind==='share'&&typeof wx[method]!=='function'){method='previewImage';kind='preview';}
  if(typeof wx[method]!=='function'){this.setData({error:'当前环境不支持，请在手机微信中操作',feedback:''});return;}
  const action={kind,viewer:this.viewer,path:this.data.posterPath};this.pendingAction=action;this.setData({saving:true,action:kind,error:'',feedback:''});let status;
  try{const options=kind==='save'?{filePath:action.path}:kind==='preview'?{current:action.path,urls:[action.path]}:{path:action.path};await new Promise((resolve,reject)=>wx[method]({...options,success:resolve,fail:reject}));status={error:'',feedback:kind==='save'?'已保存到手机相册':kind==='preview'?'可长按海报保存或转发':'已打开微信图片菜单，请选择转发对象'};}
  catch(e){const message=e.errMsg||e.message||'';status={feedback:'',error:/cancel/i.test(message)?'已取消，海报仍保留，可再次操作':kind==='save'&&/auth|deny|denied|permission/i.test(message)?'未保存：请在微信设置中允许相册访问后重试':kind==='save'?'保存失败，请检查相册权限后重试':'分享未打开，可点海报长按保存或转发'};}
  finally{if(this.pendingAction===action)this.pendingAction=null;const same=!this.disposed&&action.viewer===wx.getStorageSync('v2UserId')&&action.path===this.data.posterPath;
   if(same){if(live(this))this.setData({...status,saving:false,action:''});else this.actionResult={viewer:action.viewer,path:action.path,status};}
   else{this.remove(action.path);this.files.delete(action.path);}if(live(this)){this.setData({saving:!!this.pendingAction,action:this.pendingAction?.kind||''});if(!this.data.posterPath&&!this.data.loading)this.load();}
  }
 },
 saveImage(){return this.imageAction('save');},shareImage(){return this.imageAction('share');},previewImage(){return this.imageAction('preview');}
});
