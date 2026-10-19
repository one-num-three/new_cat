# 服务端 v0.2

单进程 Express + 原生 WebSocket。`npm start` 启动 `v2/server.js`；旧 `server.js` 只供追溯审计，不再接管服务。环境变量见 `.env.example`，本地运行和试点说明见仓库根目录 `README.md` 与 `RELEASE.md`。

本地默认用持久化 PGlite；生产用 `DATABASE_URL` 连接 PostgreSQL。`/health` 检查进程，`/ready` 检查数据库查询。测试身份仅在 `NODE_ENV=test` 与 `ENABLE_LOCAL_TEST_IDENTITIES=true` 同时设置时可创建；真实微信登录需要服务端持有 AppID 与密钥。

主要接口：`POST /api/v2/session/{test,wechat}`、`POST /api/v2/rooms`、`POST /api/v2/rooms/:id/join`、`GET /api/v2/rooms/:id`、`POST /api/v2/rooms/:id/{location,ready,start,token,capture,pause,resume,cancel,leave}`、`GET /api/v2/matches/:id/result`。所有房间接口使用 `Authorization: Bearer <session token>`；WebSocket 握手也使用该请求头。`capture` 需要 UUID `commandId`、`matchId` 和扫码 token。

本地回归：`npm test`。PGlite 与 PostgreSQL 共用 SQL 和事务路径，但仍须在目标 PostgreSQL 上做部署验证。
