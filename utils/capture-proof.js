// Shared token image lifecycle for the standalone code view and map sheet.
// The server issues the proof; views only persist and display its PNG.
function create(api, wx) {
  return {
    removeImage(path) { if(path)try{wx.getFileSystemManager().unlinkSync(path);}catch{} },
    async refresh() {
      if(this.refreshing || !this.active)return;
      this.refreshing=true;const lifecycle=this.lifecycle;
      try {
        const r=await api.token(this.data.roomId);
        if(!this.active || lifecycle!==this.lifecycle)return;
        if(!r.qrPngBase64 || !Number.isFinite(r.expiresAt) || r.expiresAt<=Date.now())throw Error('抓捕码已过期，请重试');
        this.fileSeq=(this.fileSeq||0)+1;
        const path=wx.env.USER_DATA_PATH+'/capture-'+r.expiresAt+'-'+this.fileSeq+'.png',previous=this.imagePath;
        wx.getFileSystemManager().writeFileSync(path,r.qrPngBase64,'base64');
        if(!this.active || lifecycle!==this.lifecycle){this.removeImage(path);return;}
        this.imagePath=path;this.expiresAt=r.expiresAt;this.nextRetryAt=0;
        this.setData({image:path,seconds:Math.ceil((r.expiresAt-Date.now())/1000),codeError:'',error:''});
        this.removeImage(previous);
      } catch(e) {
        if(!this.active || lifecycle!==this.lifecycle)return;
        this.removeImage(this.imagePath);this.imagePath=null;this.expiresAt=0;this.nextRetryAt=Date.now()+3000;
        if(e.code==='TOKEN_UNAVAILABLE')this.stopProof();
        this.setData({codeError:'无法生成抓捕码：'+e.message,error:'无法生成抓捕码：'+e.message,image:'',seconds:0});
      } finally { this.refreshing=false; }
    }
  };
}
module.exports={create};
