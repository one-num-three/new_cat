# 扫码抓捕、全员结算与下一局 · MCP实测

日期：2026-10-19。入口：[截图图集](index.html)、[逐人核对](mcp/result.json)、[自动化和编译](verification.json)。

## 验收范围

- 标准8人、2猫6鼠，30秒躲藏、6分钟追逐；4只鼠被捕达到目标，猫队胜。
- 官方微信开发者工具MCP调用原有Page处理器：showCode、scan、replay、toggleReady、start。没有直接写入被捕、阵营或胜负，没有用devPreview。工具的原生元素句柄曾因资源加载页失效；本轮不把物理点击命中算通过。
- 鼠端从真实服务获取动态码并写成PNG；实际解码该页面绑定的PNG，再用官方MCP模拟wx.scanCode返回。猫端执行原有扫码校验、定位辅助和抓捕请求，服务器提交事务。为避开15秒有效期，扫码使用展示控件刷新后的PNG；截图中的码是展示样例，不宣称同一张旧码一直有效。
- 单个模拟器轮换8个身份，另有8个授权WebSocket同时接收裁剪快照。GPS模拟在九龙湖；本机回环服务及隔离PGlite，真实服务器时间。不是8台手机、真实相机或公网测试。
- 第一局终局后，后台陪测身份停止定位；只有各身份在MCP实际回准备页、定位并准备成功后，才模拟它保持准备页前台的后续GPS，避免把准备问题藏在自动补定位里。

## 核对结果

| 场景 | 正确行为 | 证据 |
| --- | --- | --- |
| 4次扫码抓捕 | 每次实际PNG解码；服务端进度1→2→3→4 | scan-captures.json，含PNG SHA/当前matchId |
| 重复扫码 | 已被捕提示保留，次数仍为1 | duplicate-scan-rejected.json |
| 被捕者 | captured，仅公开状态；无玩家位置、不能展示码/抓捕，停止定位 | mouse-captured；round-one-final.json |
| 全员结算 | 8个身份均猫队胜、4/4、相同matchId；全员停止定位 | result-player-01至08，8个WS快照 |
| 重新准备 | 终局清除旧ready；全员重新定位及准备，只有房主可开始 | next-ready-01至08，ready-all-eight |
| 新对局 | 新matchId、0/4、8人active，按服务端重新分阵营 | next-player-01至08，final-state.json |
| 轮换 | 旧两名猫均轮换为鼠，新猫来自旧鼠队 | mcp/result.json逐人表 |
| 旧结果 | 旧结果仅一条，新局开始后内容不变 | round-one-final与final-state中的archivedResults |
| 回归/编译 | 181/181、0失败；16WXML/20WXSS及31语法检查通过 | tests-final.log、verification.json |

## 本轮修复

1. 普通玩家原本无法直接从结算页回到准备页；现在所有在线参与者都可“再来一局”进入准备，开始权限仍属于房主。
2. 终局事务清除所有旧准备标记，旧定位已清除。新一局必须重新定位、确认准备；重新采集GPS本身不会替代准备。终局读取响应也重新投影，不能返回旧ready。
3. 抓捕错误原先会被紧随的轮询/WS快照抹掉；现在保留同一对局的抓捕反馈，下一次扫码、离页/断线或阶段变化后清除。避免“已被捕”或待确认提示瞬间消失。

4. 每份快照增加服务端认证的viewerId；实时通道、地图和准备页拒绝其他身份快照，旧HTTP响应也不能覆盖或清除新会话。MCP逐图校验viewerId和owner，覆盖阵营/状态相同而身份不同的情况。

新增4项replay-flow回归均先复现失败，再修复通过：regression-before.log、capture-feedback-before.log、viewer-before.log；最终完整回归为181项。没有保留旧缺陷以迎合旧断言。

规则参数仍为pilot-0.3，补入规则reinforce-v1不变；这次只修下一局准备流程，不宣称试点平衡完成。本地API0.5.1新增capabilities.roundReadiness=fresh-v1，无新表迁移。

## 本地复现

开发者工具打开仓库根目录、允许Codex本地MCP调试，开发版模拟器且C盘有可用空间。

终端一：

```powershell
$env:NODE_ENV='test'
$env:ENABLE_LOCAL_TEST_IDENTITIES='true'
node scripts/mcp-join-fixture.cjs D:/cat-mouse-preview-evidence/my-capture-run capture
```

终端二：

```powershell
node scripts/mcp-capture-replay.cjs D:/cat-mouse-preview-evidence/my-capture-run run
```

使用新输出目录。驱动会私下备份原会话和配置，仅在develop/devtools切换本机测试服务；在finally恢复配置、存储和实际mock的方法。中断时可手动执行：

```powershell
node scripts/mcp-capture-replay.cjs D:/cat-mouse-preview-evidence/my-capture-run restore
```

再请求该次fixture.json中base的`/__mcp/shutdown`停止并删除该次临时数据库。服务仅本机监听，有15分钟自动退出保护；不要部署测试控制端点。

生成截图图集和拼版：

```powershell
python reports/2026-10-19/mcp-capture-replay-v1/build-evidence.py D:/cat-mouse-preview-evidence/my-capture-run reports/2026-10-19/my-capture-evidence
```

生成器会再次断言逐人UI/授权WS/角色/状态/胜负/新旧matchId/旧结果；不复制会话、扫描凭据或命令日志。原PNG保持长宽比，拼版仅缩放展示；人工复核另记visual-review.json。

## 交付状态与限制

- 本地代码和目录版在release-verified/MODIFIED_FILE；后端修复是本地0.5.1，线上仍0.5.0，本轮没有部署、Git推送或微信上传/发布。应用本次准备流程修复需要前后端配套更新。
- 原真实微信会话、HTTPS/WSS、房间和定位/扫码API均恢复；临时库删除，见restore.json、cleanup.json及restored-production-check.json。真实配置文件保持测试身份关闭，没有向生产写入测试玩家/对局。
- 本轮只在MCP验证猫达到捕获目标胜；未在MCP等待另一局6分钟自然到时鼠胜，该分支有自动化回归，不混算为本次截图验收。
- 未验证：真实手机相机扫码、手机GPS、前后台/进程结束恢复、物理点击命中、真实公网多人联机与负载。旧真实PostgreSQL验收在前一轮目录，本轮PGlite验证不替代它。
- 真机下一步：两台以上微信预览配套前后端 → 鼠停下展示码、猫当面扫码 → 被捕者查出局/停止定位 → 场地8人抓满4人全员核对猫胜 → 每个人点再来一局、重新定位准备 → 房主开始 → 核对新身份、0/4及新matchId；随后另跑时间到鼠胜。
