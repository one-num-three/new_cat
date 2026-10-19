# 试点部署与现场执行（v0.2）

## 当前本地界面候选（2026-10-13，pixel-day-native-v1）

导入仓库根目录并选择「界面调试台」编译；15状态原稿映射到真实页面，另有独立玄武湖导览。运行素材使用交接像素稿，不再默认02-01风格。扫码、权限与终局仍由原服务端路径裁决；不新增技能或积分。

无压缩候选在 `reports/2026-10-13/xuanwu-ui-v1/MODIFIED_FILE`，可独立导入。完整命令/构建尺寸/差异/回退见同目录 VERIFICATION.txt。当前75项自动测试通过；33项基线在隔离副本恢复、旧31测试通过，live保留新UI。

IDE正常/应用1.3大字/320×693内容画布的第一轮17×3截图已留存。最后6项细节修复已完成代码和自动测试；C盘空间耗尽导致微信截图与DOM挂载失败，最终整批复测及原生交互尚未完成，不以先前截图冒充最终验收。请先释放约1GB再编译；脚本输出建议放D盘。

`node scripts/pixel-ui-review.cjs <输出目录> normal`（large/narrow分别运行）；`node scripts/pixel-interaction.cjs <另一个输出目录>`。需要IDE服务端口及自动化9420，CLI通过当前实际HTTP端口连接；本机为31118。只控制小程序路由，不改桌面窗口。地图v3未地理配准；现场位置只看真实地图，不能用导览图推断实际玩家坐标。

真机执行：两种系统分别检查安全区/系统大字/按钮滚动可达→真实登录→8人2猫6鼠准备和30秒躲藏→停下动态码抓捕→断网重连→暂停/恢复→正常终局和新matchId。全程记录实际GPS误差和请求延迟，不把本地截图或历史60人回环测试等同现场验收。本轮未上传/发布/改服务器。

## 历史本地界面候选（2026-10-12，02-01-faithful-2）

微信开发者工具导入 `D:\cat-mouse-miniprogram`，开发版选择「界面调试台」编译；可打开全部页面 / 状态。运行素材直接派生自批准的 16 张原稿，原生输入、按钮、动态码与真实地图保持原处理器及授权状态。应用大字与窄画布改排版，不拉伸角色 / 公园；真实地理地图不替换为概念公园图。

本地候选包：`dist/replica-02-01-v2/cat-mouse-miniprogram-mvp.zip`（90 文件，未压缩 1,987,228 B，ZIP 1,910,668 B）。校验 ZIP CRC、所有条目与当前源文件 SHA-256、注册页 / 组件 / 图片依赖及关闭测试身份均通过；没有上传微信或再次部署服务器。自动回归 31/31；微信 IDE 正常 / 应用大字 / 窄内容画布各 16 路由，预览交互检查 12 项。证据、原稿差异与隔离回退入口见 `reports/2026-10-12/replica-v2/VERIFICATION.txt`，逐页对照见同目录 `visual/compare.html`。

现场补验：Android 与 iPhone 各打开正常 / 系统大字 / 小屏；检查安全区、字体回退、图片比例与真实 map 层叠，再走真实微信登录、多人入房、前后台定位、近距停下扫码、断线恢复及结算。IDE 应用倍率和内容画布不代替系统字体 / 实际设备；真实扫码、日光阅读、动画帧率和公网长时稳态本轮未执行。下方服务器记录保留其原日期，不表示本轮 UI 已在服务器发布。

后端已在指定服务器完成仅本机监听的部署，并通过既有 `seu-link.fit` Nginx 站点的专用 `/catmouse/` 路径提供 HTTPS 入口；尚未进行微信真机验证。该服务器已执行短时 60 人同机模拟，但不等于公网容量验收。规则参数是试点起点，不是已证实的平衡值。

## 当前服务器实例（2026-10-11）

- 服务采用 Ubuntu 24.04、系统 PostgreSQL 16、Node.js 22、`catmouse-api.service`，没有使用本页下方的备选 Compose 方案。代码目录为 `/opt/cat-mouse/release-20261011b`；API 与数据库分别只监听 `127.0.0.1:4000`、`127.0.0.1:5432`。服务器实际为 2 vCPU、约 3.6GiB 内存，不能按先前 4 核假设承诺容量。
- `curl http://127.0.0.1:4000/health`、`/ready`、`/api/version` 在服务器内返回 200；测试身份接口返回 403，匿名房间读取返回 401。重启 API 后 `/ready` 仍返回 200。初始数据库备份已保存至 `/opt/cat-mouse/backup-initial-20261011.dump`，独立恢复演练通过。完整命令与结果见 `reports/2026-10-11/evidence/deploy-server.txt`。
- `npm audit --omit=dev` 发现的 `proxy-addr` 问题已通过更新锁文件至 2.0.8 修复；生产依赖复查为 0 项漏洞，自动化测试 14/14 通过。旧代码目录与切换前 systemd 单元保留，便于回退；密码只在服务器的 `/opt/cat-mouse/api.env` 与 `/opt/cat-mouse/db-password`，权限为 0600。
- 在隔离的 `catmouse_loadtest` 数据库上完成 5 房×12 人、8 秒同机回环模拟：240 次位置、240 次状态请求、18 次 WS 重连均无失败；位置请求 p95 210ms、状态请求 p95 148ms、构造请求到本人 WS 新坐标 p95 530ms。WS 应用数据约 1.502Mbps；不含公网、TLS、手机定位采样。测试数据库已删除，生产服务仍就绪。结果见 `reports/2026-10-11/evidence/load60-server-loopback.json`。服务器只有 2 vCPU，这段短测不能推断一小时稳态或人数上限。
- 用户已在服务器私密环境文件中填写微信 AppID/AppSecret；已确认两个字段非空且当前 API 进程已加载，未读取或记录具体值。小程序已切换到 `https://seu-link.fit/catmouse` 和 `wss://seu-link.fit/catmouse`，关闭测试身份。公网 `/health`、`/ready`、`/api/version` 已返回 200，测试身份接口 403，匿名房间接口 401。无效微信授权码返回 `LOGIN_FAILED`；真实 `wx.login` 仍待微信工具或真机验证。独立短期会话和房间的公网 WSS 握手、授权快照已通过，探针数据已清理；这不是真机实时链路验收。Nginx 配置为 `/etc/nginx/snippets/catmouse.conf`，原站点位置文件有 `.pre-catmouse-20261011` 备份。详见 `reports/2026-10-11/evidence/gateway-domain.txt`。不要把密钥写进仓库。

服务器检查：`ssh root@122.51.95.61 'systemctl status catmouse-api; curl -fsS http://127.0.0.1:4000/ready; nginx -t'`。专用路由只修改现有 Nginx 站点的位置包含文件，其他服务路由保留。回退该网关路由时，先将 `/etc/nginx/snippets/seu-link-locations.conf.pre-catmouse-20261011` 复制回 `/etc/nginx/snippets/seu-link-locations.conf`，执行 `nginx -t`，再 `systemctl reload nginx`；这只回退 Nginx 路由，不删除 API 或数据库。

## 单机容器部署准备

1. 在仓库根目录创建不入库的 `.env`，填写强随机 `POSTGRES_PASSWORD`、真实 `WECHAT_APP_ID`、`WECHAT_APP_SECRET`。保持 `NODE_ENV=production`，不要设置测试身份开关。
2. `docker compose up -d --build`。`GET http://127.0.0.1:4000/health` 和 `/ready` 都应成功；端口默认只绑定宿主机回环地址。
3. 通过实际 HTTPS/WSS 网关暴露服务，设置域名证书、微信 request/socket 合法域名和小程序 `utils/config.js`。数据库只在 Compose 内部网络监听。
4. 发布前导出数据库并验证恢复。先在容器内写二进制备份，再复制到宿主机，避免 PowerShell 重定向改变字节编码：

   ```powershell
   docker compose exec -T db pg_dump -U catmouse -Fc -f /tmp/catmouse.dump catmouse
   docker compose cp db:/tmp/catmouse.dump ./backup.dump
   docker compose exec -T db createdb -U catmouse catmouse_restore
   docker compose cp ./backup.dump db:/tmp/catmouse_restore.dump
   docker compose exec -T db pg_restore -U catmouse -d catmouse_restore /tmp/catmouse_restore.dump
   docker compose exec -T db psql -U catmouse -d catmouse_restore -c "SELECT count(*) FROM match_results;"
   ```

   核对 `match_results` 和 `events` 后，将备份复制到另一存储位置。恢复演练只用独立测试库，绝不覆盖正式库。
5. 更新时先停止新房间入口、等待正在进行的对局结束；若进程重启，未终结对局进入暂停，所有定位失效。组织者确认所有活跃玩家重新定位后恢复，否则取消，不计胜负。

Dockerfile 使用 Node 24 Alpine，Compose 使用 PostgreSQL 17。这是备选方案，当前服务器因缺少 Compose 插件未按此方案部署；实际系统 PostgreSQL 备份恢复已演练。当前本机没有 Docker/psql，容器启动和网关步骤尚未实测。镜像标签在采用容器方案前应固定到经验证的具体补丁或摘要。

## 服务器负载验证（短时同机模拟已执行；公网与稳态待执行）

加快节奏后的本地 60 人结果在 `reports/2026-10-09/evidence/load60-location-fast-local.json`：5 房×12 人、约 8 秒、240 次位置上报、240 次状态读取、18 次 WebSocket 重连；本次均无失败，位置请求 p95 为 175ms、状态请求 p95 为 138ms。从构造位置请求到对应玩家在 WS 快照中看到新坐标，p95 为 682ms（240/240 次）；这个指标不包括手机取得真实定位的时间。观察到的 WS 应用数据约 1.497Mbps，不包含 HTTP、协议、TLS 和公网开销。旧版 4 秒上报/2 秒推送的结果另见 `load60-location-local.json`。客户端与服务端运行在同一台本机，不能据此推断 4 核/4GB/5Mbps 服务器容量。

已在当前非 Compose 服务器通过 `scripts/run-server-load.sh` 对独立测试库执行一次。下方是备选 Compose 环境的执行示例，不能指向正式 `catmouse` 数据库；脚本要求显式确认变量与 `_loadtest` 后缀：

```sh
docker compose exec -T db createdb -U catmouse catmouse_loadtest
docker compose exec -T -e LOAD_USE_COMPOSE_TEST_DB=true -e LOAD_ISOLATED_DB=true api node v2/load60.cjs /tmp/load60-server.json
docker compose cp api:/tmp/load60-server.json ./load60-server.json
docker stats --no-stream
```

记录 API/数据库 CPU、内存、数据库连接数、位置与快照的 p50/p95、失败数、WS 帧大小和实际带宽。这个脚本仍用同机回环网络；要验收 5Mbps 公网链路、手机前后台定位和真实场地，需再用外部压测端与真机单独测。不要在正式数据上开启测试身份模式或运行造数脚本。

## 下一次真实场地试点

1. 确定成年人熟人 8 人、2 猫 6 鼠的安全活动区；领队核查道路、障碍、集合点和约 200 米场地边界，并明确紧急停止口令。
2. 用已配置的 AppID、服务器私密微信登录密钥和 `seu-link.fit` HTTPS/WSS 域名，在微信开发者工具及 Android、iPhone 各至少一台设备上完成真实 `wx.login`、连接与定位权限验证；先测前台定位 10 分钟、锁屏 5 分钟、切应用 5 分钟及扫码返回后的上报间隔。平台配置是否生效以实际设备请求为准。
3. 领队建 8 人房间；每人授权定位并准备；确认所有手机时间、网络和场地位置。先讲明猫在躲藏阶段留集合点、停下扫码和安全优先。
4. 连续玩 2–3 轮，每轮记录开局耗时、捕获争议、取消原因、首捕时间、个人被捕等待、复玩与实际定位延迟。位置延迟须从真实定位采样到另一台授权手机显示分别记录 p50/p95，首轮目标 p95 ≤5 秒；再记录定位返回的 accuracy 值、开阔地/建筑物附近的偏差，以及手机前后台状态。下一轮生成新 matchId，轮换猫玩家；不要同时调整多项规则数值。
5. 试点结束核对两端结算、数据库结果和事件；验证退出及终局后定位停止。记录太阳下阅读、小屏、大字体、弱网、断线和权限拒绝体验。将发现写入 `WORK_LOG.md`，再决定调整哪一个试点参数。

## 发布门槛

真实微信授权码、平台服务类目/隐私资料验收、真机定位和扫码、公网链路与长时间稳态负载及场地安全检查尚待完成。实际系统 PostgreSQL 的备份恢复与服务器 60 人短时同机测试已执行，但不能据此承诺公网并发。发布包可由 `scripts/package-release.ps1` 生成，仍需在微信开发者工具和目标设备检查。
