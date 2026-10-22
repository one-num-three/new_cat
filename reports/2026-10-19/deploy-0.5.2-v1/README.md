# API0.5.2部署与前端同步

2026-10-19。用户授权真实服务器与配套前端同步更新。后端已部署，本地前端已同步并复验；微信开发版上传已发起，最后返回待用户在开发工具确认，未声明上传或正式发布成功。见platform-status.json和verification.json。

## 已完成

- 真实服务器122.51.95.61，HTTPS `https://seu-link.fit/catmouse`、WSS同域。0.5.0→0.5.2，当前目录 `/opt/cat-mouse/release-20261019-dynamic-target-v1`。
- 新能力：reinforce-v2、joined-mice-60-v1动态捕获目标、fresh-v1终局清准备、snapshotViewer认证快照。补员目标按累计鼠人数60%向上取整，原阵营/截止不变，新猫不单独增加鼠基数。
- 源码39文件SHA候选核对；npm ci生产依赖0漏洞；独立真实PostgreSQL的10WS补员、动态目标3项、6身份14项抓捕/历史/重启验收全部通过。测试身份只在隔离数据库/回环服务启用。
- 本地完整184/184通过。截图发现房间页仍许诺固定目标，已改为累计鼠人数60%向上取整/倒计时不变；补单独文案断言和MCP实际页面复核。最新前端147文件逐文件SHA一致、主包原始1783246B、最大地图分包1981419B；16WXML/20WXSS编译及31语法通过。包体数字是本地文件统计，平台上传结果另记。
- 切换前及停止写入口后均无活跃局；备份后独立数据库实际恢复核验，再切systemd，健康/就绪/版本通过。原1房间、6会话、0结果和房间摘要一致，原密钥未更改。
- 公网6项：health/ready/version/maps返回200，本地测试会话403、匿名房间401。未新增生产伪造玩家/对局，未发送邀请，无Git提交/推送。

## 入口与交付

- 当前微信开发工具工程：`D:\cat-mouse-miniprogram`。
- 无压缩目录版：`frontend/MODIFIED_FILE`，配置仍为真实HTTPS/WSS，localTestIdentities=false。
- 规则截图沿用上一轮 `../dynamic-target-v1/index.html`，19张图是本机隔离服务MCP验收；本轮production-room.png为原真实房主准备页，新文案已绘制。production-mcp.json证明同一真实身份WSS实时连接、轮询关闭，未开始或伪造生产对局。
- 平台上传开发版本不等于正式审核发布，手机相机/GPS/前后台/现场规则平衡及公网长测仍待设备验证。

## 备份与回退

- 数据库：`/opt/cat-mouse/backup-before-dynamic-target-1792420464.dump`。
- 原单元：`/opt/cat-mouse/unit-before-dynamic-target-1792420464.service`。
- 前代码目录：`/opt/cat-mouse/release-20261019-join-sync-v1`。
- 后端无表迁移；已有reinforce-v2对局不能直接交给旧固定目标逻辑。若出现问题，先阻止新局/确认无活跃局、备份当前库、检查数据兼容性，再恢复单元并重启验证；不可为回退覆盖现在的生产库。部署脚本在切换验证失败时会恢复原单元。

## 证据

preflight.json、source-manifest.json、prepare.json、postgres-tests.log、dynamic-postgres.log、deployment.json、public-checks.json、tests.log、compile-wxml.json、compile-wxss.json、package-manifest.json、package-sizes.json、verification.json、production-mcp.json、public-wss.json、production-room.png、rule-copy-check.json、platform-status.json。

MCP直接调用Socket探针两次未完成/握手失败；同一会话在仅内存保存凭据的回环探针通过公网Node WSS取快照，随后使用小程序原房间页真实连接同样通过，因此没有为探针错误改服务端鉴权或网关。探针已关闭，未导出凭据/伪造玩家。页面取证后回首页停止房间定位/监听。

## 最后一步：微信确认

wechatide-skill要求upload返回pending时由用户在开发工具确认，不能自动绕过或重复提交。当前任务 `confirmation_upload_d49332f7-7629-4e61-ba4d-68d4a3c432d1`，project为当前工程，version为0.5.2。

用户回复已确认后，先查询该任务状态；确认成功且对应最终源码后才记上传成功。房间说明在发起确认后又做过上述修正，需比对上传时间/最终来源；如先前确认产生旧包，须在旧任务明确终态后补传最终前端，不可因pending直接重复上传。正式审核发布和手机真机测试尚未执行。
