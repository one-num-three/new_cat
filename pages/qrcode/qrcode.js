// pages/qrcode/qrcode.js - 二维码展示页面
Page({
  data: {
    qrData: null,
    qrCodeUrl: '',
    qrCodePath: '', // 预缓存的本地路径
    loading: true,
    hasGoldenShield: false // 是否有金身保护
  },

  onLoad(options) {
    // 接收金身状态
    if (options.goldenShield === '1') {
      this.setData({ hasGoldenShield: true });
    }
    
    // 优先使用预缓存的二维码
    if (options.cached === '1' && options.path) {
      console.log('[二维码] 使用预缓存');
      this.setData({
        qrCodePath: decodeURIComponent(options.path),
        loading: false
      });
      
      if (options.data) {
        try {
          const qrData = JSON.parse(decodeURIComponent(options.data));
          this.setData({ qrData });
        } catch (e) {
          console.error('[二维码] 解析数据失败', e);
        }
      }
      return;
    }
    
    // 没有缓存，实时生成
    if (options.data) {
      try {
        const qrData = JSON.parse(decodeURIComponent(options.data));
        this.setData({ qrData });
        this.generateQRCode(qrData);
      } catch (err) {
        console.error('[二维码] 解析失败', err);
        wx.showToast({ title: '二维码数据错误', icon: 'none' });
        this.setData({ loading: false });
      }
    }
  },

  // 生成二维码
  generateQRCode(data) {
    const qrText = JSON.stringify(data);
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&bgcolor=ffffff&color=000000&data=${encodeURIComponent(qrText)}`;
    
    this.setData({ qrCodeUrl });
  },

  // 图片加载完成
  onImageLoad() {
    this.setData({ loading: false });
    console.log('[二维码] 加载完成');
  },

  // 图片加载失败
  onImageError(err) {
    console.error('[二维码] 加载失败', err);
    this.setData({ loading: false });
    wx.showToast({ title: '二维码加载失败', icon: 'none' });
  },

  // 长按保存
  onLongPress() {
    wx.showActionSheet({
      itemList: ['保存到相册'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.saveToAlbum();
        }
      }
    });
  },

  // 保存到相册
  saveToAlbum() {
    // 优先使用预缓存的本地路径
    if (this.data.qrCodePath) {
      wx.saveImageToPhotosAlbum({
        filePath: this.data.qrCodePath,
        success: () => {
          wx.showToast({ title: '已保存到相册', icon: 'success' });
        },
        fail: (err) => {
          if (err.errMsg && err.errMsg.includes('auth deny')) {
            this.requestAlbumAuth();
          } else {
            wx.showToast({ title: '保存失败', icon: 'none' });
          }
        }
      });
      return;
    }
    
    // 从网络下载后保存
    if (!this.data.qrCodeUrl) {
      wx.showToast({ title: '二维码未生成', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '保存中...' });
    
    wx.downloadFile({
      url: this.data.qrCodeUrl,
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            wx.hideLoading();
            wx.showToast({ title: '已保存到相册', icon: 'success' });
          },
          fail: (err) => {
            wx.hideLoading();
            if (err.errMsg && err.errMsg.includes('auth deny')) {
              this.requestAlbumAuth();
            } else {
              wx.showToast({ title: '保存失败', icon: 'none' });
            }
          }
        });
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('[下载] 失败', err);
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    });
  },

  // 请求相册权限
  requestAlbumAuth() {
    wx.showModal({
      title: '需要授权',
      content: '请允许访问相册以保存图片',
      success: (res) => {
        if (res.confirm) {
          wx.openSetting();
        }
      }
    });
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
})