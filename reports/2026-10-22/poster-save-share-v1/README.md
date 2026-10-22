# 海报生成、保存与转发

2026-10-22，前端本地修订，API仍0.6.1。没有部署、微信上传或代发消息。

## 使用

1. 已结算对局 → 我的行动轨迹与导出 → 生成我的轨迹海报。即使房主从全员页进入，也只重新请求本人的授权轨迹。
2. 生成后底部固定「保存到相册」「转发海报」，无需滚完全部说明。点海报看大图，也可长按操作。
3. 保存成功后显示「已保存到手机相册」；权限拒绝、取消或失败保留海报，允许再次操作。
4. 转发调用微信图片菜单，由使用者选择对象；只提示菜单已打开，不宣称已经发送。旧版本缺少图片菜单API时改为图片预览与长按操作。

临时文件在离页后清理；正在被原生菜单使用的文件保留到回调。切页不会解除重复点击门禁；旧身份回调不写入新身份界面，页面卸载后不调用setData。没有新增分享对象、服务端写入、定位或网络轮询。

## 可直接保存的PNG

[打开预览与保存入口](index.html) / [完整PNG](generated/poster-desktop-canvas.png)。941×1672，复用前一轮已授权本人17点，**隔离对局、模拟GPS、桌面Canvas**，不是使用者本人真实轨迹，不是微信截图；素材/地图/实际标记点/统计口径不变。只记录起终点，示例里程没有用于真实导出。

## 验证

- 新增poster-actions.test.js 4项，覆盖双击与隐藏/恢复、保存回调、原生菜单文件生命周期、取消/权限失败、缺少API回退、身份切换与旧回调。微信API使用桩，不冒充手机通过。
- 本地完整回归220/220，见tests-final.log。沿用隔离PGlite、D盘临时目录，不访问生产用户数据。
- 同一产品Canvas绘制器重画PNG，人工查看旗子/气泡/原比例与完整下缘；证明见generated/render-proof.json。
- 官方20WXML/25WXSS逐入口编译、53语法、175文件与源码SHA一致，git diff --check=0；字体753字形/30112B并核验原稿与运行哈希。主包1,014,416B，room-tools1,349,671B，均在本地预算内，不代表微信上传后体积。详见verification.json、compile-*.json、package-sizes.json、font-build.log和font-verify.log。
- 微信MCP本次返回`cant find runtimeid by projectpath D:\cat-mouse-miniprogram`，见mcp/result.json。未移动分屏或尝试新开工程，不把CLI退出0当调用成功。
- **尚未执行：** 当前海报页微信原生截图、手机相册拒绝/允许、真实选择联系人转发、Android/iOS大字体和小屏。没有新增真机GPS、服务器、公网压力或上线结论。

## 复核

```powershell
$env:TEMP='D:\cat-mouse-miniprogram\.local-test-tmp'
$env:TMP=$env:TEMP
npm --prefix cat-mouse-server test
node scripts/render-track-highlights.cjs reports/2026-10-22/poster-save-share-v1/generated --saved
node scripts/verify-venue-boundary.cjs reports/2026-10-22/poster-save-share-v1 release-verified/MODIFIED_FILE
```

完整前端目录release-verified/MODIFIED_FILE，含全部分包；用户仍可直接打开原工程。新轨迹功能需配套0.6.1后端，旧线上0.5.2不支持；本次没有部署授权或线上操作。
