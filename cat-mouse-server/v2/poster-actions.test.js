const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 let def,viewer='me';const calls=[],removed=[],files=new Set(['/poster.png']),wx={getStorageSync:()=>viewer,getFileSystemManager:()=>({unlinkSync:p=>{removed.push(p);files.delete(p);}})};
 for(const method of ['saveImageToPhotosAlbum','showShareImageMenu','previewImage'])wx[method]=options=>calls.push({method,options});
 vm.runInNewContext(fs.readFileSync(path.join(root,'room-tools/pages/share/share.js'),'utf8'),{Page:p=>def=p,require:n=>n.includes('presentation')?{metrics:()=>({})}:{},wx,Set,Promise,Error});
 const page={...def,data:plain(def.data),setData(d){assert.notEqual(this.disposed,true,'no UI writes after unload');Object.assign(this.data,plain(d));}};
 page.onLoad({matchId:'settled-match'});page.viewer='me';page.rawViewer='me';page.active=true;page.files.add('/poster.png');page.data.posterPath='/poster.png';page.load=()=>{page.loads=(page.loads||0)+1;};
 return {page,wx,calls,removed,files,switchIdentity:id=>viewer=id};
}
test('poster save uses the generated file, prevents double taps across hide/show, and confirms album success only after callback',async()=>{
 const {page:p,calls}=fixture();assert.equal(calls.length,0);const save=p.saveImage();assert.equal(calls.length,1);assert.equal(calls[0].method,'saveImageToPhotosAlbum');assert.equal(calls[0].options.filePath,'/poster.png');assert.equal(calls[0].options.path,undefined);assert.equal(p.data.feedback,'');
 await p.shareImage();p.onHide();p.onShow();await p.saveImage();assert.equal(calls.length,1);assert.equal(p.data.saving,true);
 p.onHide();calls[0].options.success({});await save;assert.equal(p.data.feedback,'','hidden completion waits for onShow');p.onShow();assert.equal(p.data.feedback,'已保存到手机相册');assert.equal(p.data.saving,false);assert.equal(p.data.posterPath,'/poster.png');
});
test('poster sharing opens the image menu without claiming delivery and retains its file until the native callback after unload',async()=>{
 const {page:p,calls,removed}=fixture(),share=p.shareImage();assert.equal(calls[0].method,'showShareImageMenu');assert.equal(calls[0].options.path,'/poster.png');assert.equal(calls[0].options.filePath,undefined);calls[0].options.success({});await share;assert.match(p.data.feedback,/图片菜单/);assert.doesNotMatch(p.data.feedback,/已发送|已转发|已保存/);
 const again=p.shareImage();p.onHide();p.onUnload();assert.deepEqual(removed,[],'share owns the temporary file while its native menu is open');calls[1].options.fail({errMsg:'showShareImageMenu:fail cancel'});await again;assert.deepEqual(removed,['/poster.png']);assert.equal(p.files.size,0);
});
test('poster permission/cancel failures preserve retry, older WeChat falls back to explicit preview, and unsupported APIs fail clearly',async()=>{
 const {page:p,wx,calls}=fixture();let action=p.saveImage();calls.at(-1).options.fail({errMsg:'saveImageToPhotosAlbum:fail auth deny'});await action;assert.match(p.data.error,/允许相册访问/);assert.equal(p.data.saving,false);assert.equal(p.data.posterPath,'/poster.png');
 action=p.shareImage();calls.at(-1).options.fail({errMsg:'showShareImageMenu:fail cancel'});await action;assert.match(p.data.error,/已取消/);assert.equal(p.data.saving,false);
 delete wx.showShareImageMenu;action=p.shareImage();assert.equal(calls.at(-1).method,'previewImage');assert.equal(calls.at(-1).options.current,'/poster.png');assert.deepEqual(plain(calls.at(-1).options.urls),['/poster.png']);calls.at(-1).options.success({});await action;assert.match(p.data.feedback,/长按/);
 delete wx.previewImage;await p.shareImage();assert.match(p.data.error,/手机微信/);assert.equal(p.data.saving,false);
});
test('poster preview is explicit and stale identity/action completion cannot expose or replace a new poster',async()=>{
 const {page:p,calls,switchIdentity,removed}=fixture();p.rawViewer='other';await p.previewImage();assert.equal(calls.length,0);p.rawViewer='me';await p.imageAction('arbitraryWxApi');assert.equal(calls.length,0);
 const preview=p.previewImage();assert.equal(calls[0].method,'previewImage');p.onHide();switchIdentity('new-viewer');p.onShow();assert.equal(p.data.posterPath,'');assert.equal(p.data.feedback,'');assert.deepEqual(removed,[],'pending preview still owns old file');
 p.data.posterPath='/new-poster.png';p.rawViewer='new-viewer';p.files.add('/new-poster.png');calls[0].options.success({});await preview;assert.equal(p.data.posterPath,'/new-poster.png');assert.equal(p.data.feedback,'');assert.deepEqual(removed,['/poster.png']);assert.equal(p.files.has('/new-poster.png'),true);assert.equal(p.data.saving,false);
});
