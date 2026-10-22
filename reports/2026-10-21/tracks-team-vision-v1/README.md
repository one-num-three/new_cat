# API0.6.0：轨迹导出、共享视野与分享海报

2026-10-21，本地完成，未部署/上传。真实微信截图与原生PNG见[index.html](index.html)。产品规则/边界与现场步骤见[TRACKS_AND_TEAM_VISION.md](../../../TRACKS_AND_TEAM_VISION.md)。

## 使用

房间→玩法设置→鼠队共享视野→保存→全员重新准备。结算→我的行动轨迹与导出→CSV/GeoJSON，或生成我的轨迹海报。房主另有全员导出；海报始终只含本人。手机保存/分享为用户主动动作，本轮未实际发送。

最终完整前端：`release-verified/MODIFIED_FILE`，请包含app.wxss和所有分包一起导入微信工具。源码工程仍为`D:\cat-mouse-miniprogram`。需配套0.6.0后端，线上0.5.2尚无本功能。

## 可复核验证

- `tests-final.log`：209/209，新增13项覆盖设置权限/幂等/回滚、联合视野、过期/捕获/暂停/补入、轨迹权限/TTL/数据库失败/进程恢复、CSV转义/坐标/分段、身份切换与文件清理、历史标定、海报慢走/跳点/断点/原画比例。
- `compile-wxml.json`、`compile-wxss.json`：官方逐入口编译；文件数见verification.json。`package-manifest.json`逐字节比对目录与源码，`package-sizes.json`原始字节预算，不代表微信上传结果。
- `load60.json`：共享视野开启、真实本地SQL持久点。0错误、位置p95 493ms、WS本人更新p95 1190ms、WS正文2.057Mbps、RSS314MiB。首轮带宽误将30秒预热计入8秒分母，已纠正并重跑；首轮保留为`load60-initial-invalid-bandwidth.*`，不得引用其带宽值。
- `mcp/`：一个真实模拟器顺序切换身份，真实隔离HTTP/SQL/原生WS、真实时钟、模拟GPS；v3跑完猫动态码抓4鼠→猫胜→本人CSV→房主8人GeoJSON。v6新局同样真实抓捕结算，v8最终海报原生Canvas导出941×1672；v7/8确认导航修复。共7张有效图（含完整PNG），已逐张人工查看，未按脚本截图数量直接算通过。
- `mcp/restore.json`：原会话/生产运行配置恢复，备份移除。测试服务已shutdown，临时库路径校验后删除。未把凭据写入产物。
- `attempts/`保留AppID网络超时、白屏、授权遮罩、旧导航反例；均不计最终视觉通过。v4失联后正常取消，不宣称那局猫胜。v6功能通过时导航缺失，已修复并在v7/8复验。
- 地图/前景与用户原始参考SHA见`assets.json`，设计原稿及提示词完整保留。只打包共用透明前景，没有压缩/拉伸原地图。

## 本地启动

在项目目录PowerShell执行（仅本地开发测试）：

```powershell
npm --prefix cat-mouse-server ci
$env:NODE_ENV='test'
$env:ENABLE_LOCAL_TEST_IDENTITIES='true'
$env:HOST='127.0.0.1'
$env:DATA_DIR='D:\cat-mouse-miniprogram\.local-test-tmp\manual-tracks'
npm --prefix cat-mouse-server start
```

微信开发工具使用本工程；仅develop+devtools可按utils/config.js配置本地`baseUrl=http://127.0.0.1:4000`、`wsUrl=ws://127.0.0.1:4000`、`localTestIdentities=true`。真机/正式环境保持真实微信会话，不启用测试身份。后端本地SQL数据保存在指定目录，保留它即可重启恢复，最新GPS需重采。

```powershell
$env:TEMP='D:\cat-mouse-miniprogram\.local-test-tmp'
$env:TMP=$env:TEMP
npm --prefix cat-mouse-server test
$env:LOAD_SHARED_VISION='true'
node cat-mouse-server/v2/load60.cjs .local-test-tmp/load60-shared.json
```

MCP复核脚本`scripts/mcp-tracks-fixture.cjs`、`mcp-tracks-vision.cjs`、`mcp-track-poster.cjs`必须指向专用D盘输出目录；测试库仅本地、15分钟自清、必要时`/__mcp/shutdown`。脚本会恢复原会话，不上传、不代发送。捕获用动态凭据，未直接写赢家。

## 未执行及限制

- 真机相册/文件发送、相机抓捕、系统大字体/真实手势、真实GPS/锁屏/后台与现场配准未执行。旧证据或mock不算通过。
- 新后端在真实PostgreSQL和自有服务器/公网的压测未执行，0.6.0未部署。后台定位账号接口尚未开通。
- 联合视野120m不检测建筑遮挡，未证明平衡；同点测试玩家图标重叠，未做聚合。海报距离/GPS片段时间为估计，缺口不补；热量按60kg/4MET假设，不当作实测。
- 无轨迹或过期局不补造；历史0.5.x没有采集的数据无法补回。场地图参考配准仍fieldVerified=false。

保留用户已有未提交改动，没有Git reset、推送、真实服务器写入或微信上传。
