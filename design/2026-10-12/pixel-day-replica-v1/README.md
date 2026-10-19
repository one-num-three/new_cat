# 晴日公园 · 16-bit 像素 · 15 状态 HTML 复刻

仅按选定原稿复刻，不增加产品设计。双击 index.html 可以打开；或在本目录运行 `node serve.cjs`，打开 http://127.0.0.1:8767 。

左侧选择 15 个状态；查看方式支持 HTML、原稿并排、半透明叠加。插画、像素角色、装饰标题与地图示意复用原稿，面板、表单、名单、HUD 和正文使用 HTML/CSS。固定按钮使用原稿完整图层保留字形、图标和底纹，外层仍是可操作的 HTML button；准备状态变化时显示真实动态文字。动态文字与原稿仍有字形差异。

这是固定示例数据的界面复刻，不是已接入后台的小程序。计时、扫码和定位未接入实际业务。现有 pages/components/utils 等小程序文件保持不变。地图仅保留原稿示意，真实地图由独立会话处理。

验证命令：`node verify.cjs baseline`、`node verify.cjs modified`。浏览器证据见 evidence；窄屏测试请求 390/320，浏览器实际报告 CSS 宽度为 582/477，记录按实际值保存。检查仅证明无横向溢出，不代表真机小程序测试。

`ROLLBACK.sh --test-copy` 将 baseline/index.html 恢复到 evidence/rollback-test.html，不覆盖当前复刻。该文件为原画廊 HTML 的逐字节恢复测试；画廊运行仍依赖原目录资源。源目录原画廊和所有原图始终保留。

后续沿用提示：
> 只按 sources.json 指向的晴日公园 16-bit 15 个定稿状态复刻，不重新设计或新增业务功能。保留现有小程序业务逻辑，地图单独对接；以原稿/复刻并排证据核对差异。

## 字体与按钮修正
旧版 900 字重改为 Noto Sans SC 可变字体子集（100–900），正文450、输入550、常规标题750、大号数字900。补齐当前界面中文覆盖。固定按钮不再拼四条边，使用单层连续原稿纹理，外扩8个源像素包含阴影与折角。此方案以静态定稿的准确复现为目标，不把原稿按钮字体冒认为已识别的具体字体。

检查：node verify-button-fix.cjs baseline / modified / rollback；回滚仅作用于专用测试副本：ROLLBACK.sh --button-fix-test。
字体参考：https://github.com/adobe-fonts/source-han-sans 。本地字体来源、范围、哈希见 font-manifest.json。
