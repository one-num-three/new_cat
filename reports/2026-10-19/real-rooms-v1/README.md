# 真实房间、邀请、抓捕与地图服务 · 2026-10-19

## 当前交付

- 后端 API **0.4.0** 已在原服务器部署，入口为 https://seu-link.fit/catmouse 。沿用真实微信登录、原数据库与安全配置。规则仍为 pilot-0.3，默认8人、2猫6鼠、捕获目标4；本轮没有开放积分商店。
- 地图目录由服务端提供，登记玄武湖、九龙湖、四牌楼的 ID、图像修订与可用图层。房主可在开局前或终局后切换地图、集合点与多边形范围；进行中和暂停时锁定。换场地清准备及旧定位，换底图清旧标定。图像版本不兼容时客户端使用真实地图，不套用错误底图。
- 创建房间的指令有数据库幂等回执；抓捕使用绑定房间/对局、目标及有效期的动态凭据，事务内提交、单次捕获、持久化结果。超时不确定时客户端复用原指令重试，避免重复扣算。
- 首页可扫码入房，房间可生成真实邀请二维码及微信分享路径。邀请与抓捕二维码采用不同用途标识，不能混用。普通成员不能改场地、开始、接管房主或指定赢家。
- 新邀请页及范围编辑页接入真实服务。MCP发现编辑面板被裁切，已修复高度、内边距与按钮宽度；普通字号、应用1.3倍字号均有实际截图。

**前端是当前本地开发工程，尚未上传/发布微信新版。** 手机须预览当前工程，不能用旧版小程序验收新增入口。

## 微信 MCP 实际验收

用户手动在既有分屏打开项目后，由官方微信 MCP 完成页面导航、原生按钮操作、状态读取及截图；未移动、激活或调整桌面窗口。

1. 新的真实 wx.login 换取生产会话成功，HTTP 200；令牌只保存在小程序中，没有写入报告。
2. 实际创建房间 **9D61CEDC51**，房间 ID 为 e6d804dd-06f1-48fe-8759-31736daa4834；当前1/8人，2猫6鼠，尚未开始。房主是本次真实微信身份。
3. 在九龙湖真实地图点选四顶点及集合点，原生保存按钮返回创建页；服务端持久化范围约20623平方米。这里的点是手动地图点选，**不是GPS采集或现场精度证据**。
4. 实际邀请PNG经解码得到 catmouse.room.v1 和上述房间码；图像359×359，微信分享路径为 /pages/index/index?roomCode=9D61CEDC51。
5. 真实 wx.connectSocket 曾收到本房间授权 SNAPSHOT；首次探针失败、后续成功，只算单次联通，不算公网长时稳定性。

邀请二维码是**打开本小程序后，在首页点“扫码加入”扫描**的标准二维码；不是微信外部扫码即可启动的小程序码。微信分享卡片带启动路径，但本轮未选择联系人、未发送分享。两台手机相机扫码仍待验证。

图集见 [index.html](index.html)，MCP记录见 [mcp/result.json](mcp/result.json)。失败的旧自动化跑批日志保留，不计成功；最终截图来自后续分段MCP操作。

## 启动与配置

微信开发者工具打开 **D:\cat-mouse-miniprogram** 并编译。当前 utils/config.js 已指向上述 HTTPS/WSS 入口，localTestIdentities=false。其 mode=local 表示直接HTTP服务接入，不代表模拟身份。

本地后端和自动回归：

~~~powershell
cd D:\cat-mouse-miniprogram
npm ci --prefix cat-mouse-server
$env:TEMP='D:\cat-mouse-miniprogram\.local-test-tmp'
$env:TMP=$env:TEMP
npm test --prefix cat-mouse-server
npm start --prefix cat-mouse-server
~~~

未配置 DATABASE_URL 时使用本地PGlite持久目录；生产必须使用PostgreSQL。配置入口为 cat-mouse-server/.env.example，进程实际读取环境变量，并不自动加载.env。本地微信登录需设置 WECHAT_APP_ID、WECHAT_APP_SECRET；密钥只放环境变量或受限服务器配置，不能写源码。若要让前端连本机服务，需相应修改 utils/config.js 的 baseUrl/wsUrl；手机不能用电脑的127.0.0.1。

双身份工程流程由自动测试在隔离测试环境内部启用测试会话；生产测试身份接口仍403。真实PostgreSQL验收脚本为 cat-mouse-server/v2/acceptance.cjs，只接受 catmouse_verify_数字_数字 格式的隔离数据库、NODE_ENV=test、显式本地测试开关；不对生产库运行该脚本。

本地编译及目录版逐文件复核：

~~~powershell
node scripts/verify-venue-boundary.cjs reports/2026-10-19/real-rooms-v1 release/MODIFIED_FILE
~~~

release/MODIFIED_FILE 是可单独导入的当前小程序目录，无压缩包。仅上传副本排除34张已不用的按钮PNG；源码、原图和许可均保留。包体原始文件计数不等于微信上传后编译包体验收。

## 测试证据与边界

| 验证 | 结果及范围 | 证据 |
| --- | --- | --- |
| 自动化回归 | 173/173，0失败；隔离PGlite，含权限、幂等、并发抓捕、乱序/截止、数据库失败、重启、二维码解码与客户端生命周期 | tests-final.log |
| 实际PostgreSQL | 6模拟身份、加速时钟、14项检查；两猫原子抓捕、全员一致结果和重启保留回执 | acceptance-postgres.json |
| 官方离线编译 | 16 WXML、20 WXSS，退出0；发行JS/CJS语法与共享模块/字体/目录SHA检查 | verification.json、compile-*.json |
| 微信MCP | 真实会话、1个真实房间、地图框选保存、邀请码及授权WSS；5张页面截图 | mcp/result.json、01–05 PNG |
| 备份恢复 | 生产切换前备份，在独立库恢复成功；不覆盖生产数据库 | restore-check.json |
| 服务器短测 | 隔离PostgreSQL，5房×12人，8秒；客户端/API同一个Node进程及同机回环 | load60-postgres.json |

短测：240位置请求、240状态读取均0失败；位置P95 295ms、状态P95 127ms、请求到本人WS位置P95 552ms，18次WS重连无错误，观测WS应用数据约1.561Mbps。同机测试不包含手机GPS采样、TLS公网和相机，不推导并发上限或真实追逐延迟。

未验证：两台手机扫码、外部微信分享启动、手机断网/前后台、现场GPS与地图精度、系统大字/小屏、手机3D性能、真实公网长时压测及微信上传包体。应用字号1.3截图不代替系统无障碍测试。地图 fieldVerified=false，试点规则数值未被证明平衡。

## 服务器、持久化与回退

- 活跃目录 /opt/cat-mouse/release-20261019-real-v1，systemd 为 catmouse-api.service。API/数据库仍只在本机监听，经既有Nginx路径提供HTTPS/WSS；没有引入多进程或微服务。
- 新增 operation_commands 表保存作用域、身份、指令ID、摘要与回执，启动时增量建表；旧 rooms、commands、events、match_results 保留。创建并发使用事务锁，抓捕及结果在房间事务中提交。
- 最新位置只在进程内存，重启后重新采集；对局与结果保留，重启/失联继续按既有暂停恢复规则处理，不凭空恢复GPS。
- 切换前活跃对局0；备份 /opt/cat-mouse/backup-before-real-rooms-1792404476.dump，旧单元 /opt/cat-mouse/unit-before-real-rooms-1792404476.service。备份时房间0，之后创建的真实联调房间不在该备份内。
- 旧0.2目录保留，但不理解新多边形等数据；有新房间后不能盲目切回旧代码。回退前先停止新流量、备份当前数据、确认兼容；不自动覆盖当前数据库。
- scripts/prepare-real-rooms-server.py 与 deploy-real-rooms-server.py 留存本次操作。准备脚本现在拒绝修改正在运行的候选目录；再次发布使用新目录和新验证，不能直接重跑本次脚本。

部署/公网检查分别见 deployment.json、public-version.json、public-checks.json。没有Git提交/推送、微信上传/发布、邀请消息发送或密钥替换。

## 下一次真机试点

1. 用当前工程生成开发预览，至少两台手机登录；用邀请分享路径或首页扫码加入9D61CEDC51，确认不能靠邀请码接管房主。正式现场优先新建8人2猫6鼠房间。
2. 房主选真实集合点、沿可通行边界框选；现场核对数个未参与配准的路口，记录GCJ-02和accuracy。偏差明显切真实地图，禁止把艺术图当实测。
3. 所有人定位后准备，验证改场地会清准备；8人到齐再开始，观察30秒躲藏、6分钟追逐、目标4及角色裁剪。
4. 停下后鼠展示动态码、猫用相机扫码；验证邀请码不可当抓捕码、过期/跨局拒绝、重复确认不重复记数。把相机/GPS/网络各自结果分开记录。
5. 步行验证断网恢复原身份/对局、暂停/恢复、退出、终局停止定位；结算全员一致，再开matchId变更且旧结果保留。若只有两台设备，只算工程联调，不算8人平衡试点。
