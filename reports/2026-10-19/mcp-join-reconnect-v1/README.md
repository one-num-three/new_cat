# 中途加入与断线重连 · 微信 MCP 实测

日期：2026-10-19。入口：[实际截图图集](index.html)、[逐人核对记录](mcp/result.json)、[自动化与编译结果](verification.json)。

## 实测方法

- 官方微信开发者工具 MCP，复用现有模拟器，不调整桌面窗口或分屏。
- 标准 8 人开局，30 秒躲藏、6 分钟追逐。追逐中 P09、P10 从真实首页输入房间码加入；真实会话、HTTP 与原生 WebSocket 规则服务分配身份，不使用 devPreview 或向页面注入对局状态。
- 1 个模拟器轮换 10 个本地测试身份，分别重新接收授权状态并截图；另有 10 个同身份的独立 WebSocket 同时接收快照，核对全员阵营、状态、版本、阶段和位置权限。
- 服务仅监听本机回环地址，使用隔离 PGlite；GPS 由 MCP 模拟在九龙湖校区。测试身份端点仅明确的 test 环境开启，不向生产添加玩家、对局或模拟位置。
- 对 P09 定向阻断 HTTP/WS 并销毁现有连接，保留同一小程序页面；恢复后不导航、不重新登录，检查自动同步。不是关闭电脑 Wi-Fi，也不代表手机前后台/公网网络验收。

## 完成条件与证据

| 检查 | 正确行为 | 证据 |
| --- | --- | --- |
| 中途加入 | P09 鼠、P10 猫；总计3猫7鼠，原8人角色不变 | after-join.json；player-01至10 |
| 全员同步 | 10个授权连接的本人角色/状态、公共名单、版本与阶段一致 | final-state.json；mcp/result.json |
| 固定开局目标 | 同一matchId，捕获目标保持4，已捕获1 | 各截图对应JSON |
| 信息权限 | 活跃者精确位置仅本人/同阵营，被捕者0个玩家位置 | final-state.json中的peerViews |
| 断线 | 位置清空、倒计时不冒充实时、不可抓捕/展示码 | 11-network-lost |
| 失联暂停 | 服务端定位失联暂停，同伴收到公共状态 | others-during-disconnect.json |
| 自动重连 | 原页、原身份、原阵营；仍暂停，等待组织者 | 12-same-page-recovered |
| 恢复追逐 | 被捕房主可恢复且不复活，P09保持原身份 | 13-host-resumed；14-returned-player-active |
| 自动回归 | 177/177，0失败 | tests-final.log |
| 官方编译 | 16 WXML、20 WXSS；31个语法检查 | verification.json |
| 环境恢复 | 原会话与生产HTTPS/WSS配置恢复，删除临时备份 | restore.json；cleanup.json |

本轮发现并修复：被捕房主点击恢复时不再上传被禁止的本人定位；实时连接绑定当前会话，拒绝本人角色/状态矛盾的旧快照，并用独立连接标识隔离重连。两项新增回归在 `cat-mouse-server/v2/reconnect-controls.test.js`。旧UI测试的恢复场景补齐真实 `PAUSED/active` 状态。

## 截图说明

`screenshots/*.png` 均为开发工具的原始截图；同名JSON记录截图前读取的真实小程序状态及服务端状态。共15张原始截图，图集采用14张有效对局截图（10个身份独立视角＋4张断线/恢复）。首次8人基线的逻辑层状态已同步，但截图仍是地图加载帧，保留原始证据且不算UI通过、不放入图集。只有拼版预览改变展示尺寸，原始截图保留完整比例。`captures.json` 是索引，不含会话凭据；人工复核见 visual-review.json。

首次取证过程中有驱动崩溃、跨页面MCP评估超时和旧身份快照问题；没有把这些失败算通过。最终证据来自单独的连续验收运行，详细纠错见 WORK_LOG。之前一轮的自然终局图片不混入最终图集。

## 本地复现

微信工程已打开，允许 Codex 本地 MCP 调试，开启服务端口；保持开发版模拟器。先在单独终端运行：

```powershell
$env:NODE_ENV='test'
$env:ENABLE_LOCAL_TEST_IDENTITIES='true'
node scripts/mcp-join-fixture.cjs D:/cat-mouse-preview-evidence/my-join-run
```

在另一终端按顺序执行；请用新目录，避免覆盖既有证据：

```powershell
$run='D:/cat-mouse-preview-evidence/my-join-run'
node scripts/mcp-join-reconnect.cjs $run init
node scripts/mcp-join-reconnect.cjs $run baseline
node scripts/mcp-join-reconnect.cjs $run join
node scripts/mcp-join-reconnect.cjs $run views 0 1 2 3 4 5 6 7 8 9
node scripts/mcp-join-reconnect.cjs $run offline
node scripts/mcp-join-reconnect.cjs $run recover
node scripts/mcp-join-reconnect.cjs $run resume
node scripts/mcp-join-reconnect.cjs $run restore
```

命令失败时先分析错误，不重复执行抓捕步骤。无论是否通过，都执行 `restore` 恢复原会话/配置及本次mock；再向该次 `fixture.json` 的本机base发送 `/__mcp/shutdown`，关闭进程并清除该次临时数据库。驱动另有15分钟自动退出保护。不要把这些本地诊断端点部署到公网。

整理证据：

```powershell
node scripts/build-mcp-join-evidence.cjs $run reports/2026-10-19/my-join-evidence
```

生成器会断言10个身份各自UI与实时快照一致、权限正确、同身份恢复及原配置恢复；只复制公开状态与截图，不复制命令参数或会话存储。

## 交付与限制

- 当前前端修复已在本地工程和 `release/MODIFIED_FILE`，微信开发工具重新编译即可。后端仍是已部署的0.5.0，本次不涉及服务端更新、微信上传或发布。
- `utils/config.js` 保持真实HTTPS/WSS入口、`localTestIdentities:false`。原真实账号、联调房间保留。
- 包体为本地原始文件统计，尚非微信上传结果；见 package-sizes.json。
- 未执行：多台真机、真实GPS、扫码相机、系统前后台/进程杀死、真实公网断网与长时负载。此前真实PostgreSQL联机验收在上一轮目录，本次隔离库不能替代该验收。
- 手机下一步：两台以上设备预览当前工程 → 开局后新微信身份扫码/房间码加入 → 检查阵营名单 → 单台关网30秒以上 → 全员看到暂停 → 原设备恢复网络 → 房主恢复；被捕者重复该过程必须仍出局。最后增加到8–12台现场核验。
