# 猫鼠行动 · 试点版 0.2

## 2026-10-13 沉浸地图 v4

地图导览改为单张放大的图片等比cover铺满，不再保留蓝色空条和底部大工具栏。内置生图按v3原稿扩绘湖面，实际生成1254×1254；运行JPEG804062B，原PNG和v3均保留。每7.5秒沿矩形四角缓慢平移，总览一个环路约30秒（含首次由中心进入）。任意触摸即暂停自动运动，用户可拖动、双指缩放或用小控件1–4倍缩放；放手不自动抢回镜头，只有点“巡游”恢复。隐藏/离页停止计时器，同尺寸布局不扰动手动镜头。

原生IDE已实测自动图像位置变化、触摸打断、单指拖动、双指缩放、停留、居中及恢复9项。此艺术图未地理配准，真实对局继续授权原生map。新证据见reports/2026-10-13/map-immersive-v1/。生图原始提示词及SHA见design/maps/xuanwu-lake/immersive-v4/；源码改动不改变pilot-0.2、身份或胜负。

---


## 当前增量实现（2026-10-13，pixel-native-final-v2）

修复：原生组件选择器不再允许空检查通过；按钮从首帧预留原稿尺寸，图片异步加载后地图重测可用空间，不裁边、不拉伸；无尺寸变化时保留缩放。79项自动回归通过；MCP正常/大字/窄内容各17张截图，窄版仍是320×693内容约束而非真机。24项累计预览交互断言已通过，包括原生触摸平移、缩放、错误重试、入房/准备/开始及安全区内的页尾动作。大字关闭最终通过原生子按钮点击和MCP状态读取补验；证据来自分段运行，不冒充单次整批成功。

最新无压缩小程序副本与证据：reports/2026-10-13/pixel-native-final-v2/。图库/15状态入口不变；真实身份、定位、抓捕及胜负逻辑不变，本轮没有上传或改服务器。旧截图的空组件几何检查不作最新版验收依据。


面向 6–12 名熟人的实景猫鼠短局。微信小程序是本轮主客户端；服务端统一身份、阶段、抓捕和结算。规则版本为 `pilot-0.2`，具体数值是场地试点参数，尚未验证平衡性。历史冻结规划见 [PROJECT_PLAN.md](PROJECT_PLAN.md)，2026-10-08 审计仍保留在 `reports/`。

当前视觉基线为用户交接的晴日公园 16-bit 像素 15 状态，已替换到原生小程序；02-01 外观保留为历史。组件、字体、素材与比例约束见 [DESIGN_BASELINE.md](DESIGN_BASELINE.md)。

已选素材及其 SHA-256、运行副本与未来生图提示词固定在 [ART_LOCK.md](ART_LOCK.md)。运行地图的被捕、暂停/重连与胜利状态已使用相应插画；未来技能视觉仍是概念素材，不是已启用玩法。

可复用透明插画、已接入地图的标记和分层页面源文件见 [素材说明](design/2026-10-09/usable-assets/README.md)。

## 新 UI 预览（2026-10-13）

微信开发者工具导入 `D:\cat-mouse-miniprogram`，编译模式选择「界面调试台」，逐项打开状态；「玄武湖新版地图」可独立打开完整导览。原设计参考入口仍是 `design/2026-10-12/pixel-day-replica-v1/index.html`，这是设计对照，不是业务客户端。当前6个注册页面复用真实处理器；开发预览使用固定数据，不发起对局/GPS/抓捕请求。

代码回归75/75，素材哈希通过，33文件隔离回滚及旧31测试通过。可复核证据：`reports/2026-10-13/xuanwu-ui-v1/VERIFICATION.txt`；逐页对照：同目录 `visual/compare.html`。修前完整IDE截图已有51张；最后6项细节修复后整批截图/交互因C盘空间为0未完成，腾出空间后重新编译并运行下列脚本。真实手机/系统大字/GPS配准/扫码仍单独验收。

无压缩导出：`powershell -File scripts/package-release.ps1 -DirectoryOnly -OutputDirectory <新的空输出目录>`，输出MODIFIED_FILE文件夹；保留所有源素材，不上传或部署。

## 本地启动

需要 Node.js 22+。服务端默认使用持久化的嵌入式 PostgreSQL（PGlite），数据目录为 `cat-mouse-server/data/`。两身份工程验收时，在 PowerShell 中运行：

```powershell
cd D:\cat-mouse-miniprogram\cat-mouse-server
npm ci
$env:NODE_ENV='test'
$env:ENABLE_LOCAL_TEST_IDENTITIES='true'
npm start
```

访问 `http://127.0.0.1:4000/health` 和 `/ready`。`/api/v2/session/test` 只在上述显式本地测试模式启用。切回真实微信登录时，清除这两个环境变量，在服务端配置 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`，并将小程序 `utils/config.js` 的 `localTestIdentities` 改为 `false`。正式部署必须配置 `DATABASE_URL`；没有它，`NODE_ENV=production` 会拒绝启动。

微信开发者工具导入仓库根目录。当前 `project.config.json` 已填写试点 AppID；`utils/config.js` 指向 `https://seu-link.fit/catmouse` 和 `wss://seu-link.fit/catmouse`，并使用真实 `wx.login`，不会请求测试身份接口。测试身份模式仅用于上面的隔离本地服务端验收；若要从小程序连接本地服务，需临时修改 `utils/config.js`，测试结束后恢复当前公网配置。2026-10-11 已巡检开发工具 390×753 视口的调试台及 14 个页面/状态，并修正实际渲染问题；真实登录、手机定位/扫码、小屏和大字体仍待真机验证。

## 开发版界面调试台

以开发版在微信开发者工具打开小程序首页，点击「打开界面调试台」；也可在工具顶部编译模式下拉框选择「界面调试台」或任一状态并重新编译。`project.config.json` 已登记 16 个编译模式（调试台 + 14 个页面/状态 + 玄武湖导览）。可单独打开首页、创建、房间准备、猫/鼠追逐地图、近距预警、躲藏、动态码、被捕、暂停、断线、两种胜利和取消。调试台使用显著的「界面预览」标记与固定样例数据；动态码为不可扫描的占位图。进入预览不会调用会话、房间、定位、相机、WebSocket 或定时同步，也不会改动真实对局。预览内的创建、准备和开局只在界面本地切换或跳转，返回后可选择下一项；真实流程仍从首页正常按钮进入。该入口仅在小程序 `envVersion=develop` 出现，体验版/正式版直接打开预览链接会回到首页。

本地两身份流程：各自建立测试会话 → 一个创建 2 人工程房间 → 另一人输入房间码加入 → 两人定位准备 → 房主开始 → 30 秒躲藏 → 鼠展示 15 秒动态码 → 猫扫码 → 两端看到猫胜。正式预设仍为 6–12 人，8 人为 2 猫 6 鼠。

### 不移动桌面窗口的自动巡检

用户已在本机 IDE 开启服务端口。开发工具保持现有分屏；以下命令只控制小程序路由，不上传或发布，也不调整窗口。先 `cd cat-mouse-server; npm ci; cd ..` 安装开发依赖，正式镜像继续 `npm ci --omit=dev`。

```powershell
& 'D:\Program Files (x86)\微信web开发者工具\cli.bat' auto --project 'D:\cat-mouse-miniprogram' --auto-port 9420
node scripts/replica-review.cjs all "$env:TEMP\cat-mouse-faithful-v2\normal"
node scripts/replica-review.cjs all "$env:TEMP\cat-mouse-faithful-v2\large" large
node scripts/replica-review.cjs all "$env:TEMP\cat-mouse-faithful-v2\narrow" normal 320x693
node scripts/replica-interaction.cjs "$env:TEMP\cat-mouse-faithful-v2\interaction"
```

巡检校验预览身份、各页边界、地图面板不重叠、房间码/复制按钮分离、冻结/出局/断线文案和素材实际渲染比例。`onResize` 配合同源生成的 `utils/art-ratios.wxss`，避免 widthFix 在改宽时缓存旧高度；不使用单轴拉伸。本轮使用官方SDK路由/选择器与截图，没有桌面窗口调整。中间证据先放项目外，减少IDE文件监控触发重编译的干扰；SDK可能显示截图缩略图，未声称修复IDE窗口自行缩小。320x693仅改变页面布局画布，不是实际320px设备或系统分辨率测试。截图合集保留每张来自哪次顺序采集，不描述为最后一次全量重跑。逐页比对见 [原稿与三种布局](reports/2026-10-12/replica-v2/visual/compare.html)，命令与原始结果见 [当前复刻证据](reports/2026-10-12/replica-v2/VERIFICATION.txt)。

## 规则与架构

- 30 秒躲藏、6 分钟追逐。猫达到开局鼠人数 60% 向上取整的抓捕目标即胜；截止时未达目标则鼠胜。取消不计胜负。
- 猫每 30 秒得到存活鼠约 50 米区域线索；鼠在猫进入约 120 米范围时只收到近距预警，不收到猫坐标；被捕者只看公开状态。客户端不会收到全员精确坐标。
- 停下扫码是抓捕动作。服务端绑定对局、鼠身份和 15 秒有效期，原子消费；最近 5 秒、精度 ≤25 米、距离 ≤50 米的 GPS 仅作辅助校验，线下仍需近距确认。
- 房间、会话、命令结果、事件、历史结果存 PostgreSQL；最新位置只在单进程内存。重启后进行中对局暂停，必须重新采集位置，由房主恢复。
- REST `/api/v2` 承担可靠命令；原生 WebSocket `/api/v2/live` 推送逐人授权快照。断线降级为单飞轮询。旧 `server.js` 留作审计来源，不是启动入口，也不随发布包复制。
- 地图页 WebSocket 断开后继续每 2 秒读取授权快照，并按退避间隔重连；正常连接每 1 秒推送一次授权快照，离页清理重试、心跳和定位。定位事件最短约 2 秒上报一次，事件缺失时约 3 秒补采样；真正的定位回调频率、精度和端到端可见延迟仍需真机验证。

## 验证

```powershell
cd D:\cat-mouse-miniprogram\cat-mouse-server
npm test
cd ..
node cat-mouse-server/v2/load60.cjs reports/2026-10-09/evidence/load60-location-fast-local.json
powershell -ExecutionPolicy Bypass -File .\scripts\package-release.ps1
```

自动化测试涵盖身份、权限、人数、动态码、时间、并发、可见性、数据库写失败、重启恢复和旧结果保留。60 人脚本包含每 2 秒位置上报、状态读取、WebSocket 推送及部分重连；默认仍是本地嵌入式数据库仿真，不代表真机、公网或自有服务器容量。当前证据与未执行项目见 [WORK_LOG.md](WORK_LOG.md)。部署和真机试点见 [RELEASE.md](RELEASE.md)。
