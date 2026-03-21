# 猫鼠游戏小程序 - 开发文档 🐱🐭

**最后更新**: 2026-03-18  
**服务器 IP**: `118.178.85.214`  
**API 端口**: `3004`

---

## 📋 项目同步流程

### 我修改代码后（服务器端）

```bash
cd /home/transplanted/cat-mouse-miniprogram

# 1. 查看更改
git status

# 2. 添加更改
git add .

# 3. 提交（带描述性信息）
git commit -m "feat: 添加 xxx 功能"
# 或
git commit -m "fix: 修复 xxx 问题"
# 或
git commit -m "docs: 更新开发文档"

# 4. 推送到裸仓库
git push origin main
```

### 你同步代码（本地）

```bash
cd 你的本地/cat-mouse-miniprogram

# 1. 拉取最新代码
git pull origin main

# 2. 查看更新
git log --oneline -5
```

---

## 🎯 功能开发状态

### 已完成 ✅

| 模块 | 功能 | 文件 | 说明 |
|------|------|------|------|
| **首页** | 创建游戏入口 | `pages/index/index.js` | 跳转到房间创建页 |
| **首页** | 加入游戏入口 | `pages/index/index.js` | 输入房间号加入 |
| **首页** | 游戏说明展示 | `pages/index/index.wxml` | 4 条核心玩法说明 |
| **房间** | 创建房间 | `pages/room/room.js` | 设置猫鼠数量、时长、范围 |
| **房间** | 加入房间 | `pages/room/room.js` | 通过房间号加入 |
| **房间** | 开始游戏 | `pages/room/room.js` | 房主专属功能 |
| **房间** | 分享房间 | `pages/room/room.js` | 微信分享功能 |
| **地图** | 实时位置显示 | `pages/map/map.js` | 腾讯地图集成 |
| **地图** | 玩家标记 | `pages/map/map.js` | 猫/鼠不同图标 |
| **地图** | 道具使用 UI | `pages/map/map.js` | 加速/隐身/雷达 |
| **地图** | 游戏倒计时 | `pages/map/map.js` | 600 秒默认时长 |
| **地图** | 角色提示 | `pages/map/map.js` | 显示当前角色 |
| **地图** | 扫码抓人 | `pages/map/map.js` | 猫扫描老鼠二维码 |
| **地图** | 二维码展示 | `pages/qrcode/qrcode.js` | 老鼠生成二维码 |
| **个人中心** | 微信登录 | `pages/profile/profile.js` | 授权登录流程 |
| **个人中心** | 退出登录 | `pages/profile/profile.js` | 清除本地缓存 |
| **个人中心** | 游戏历史入口 | `pages/profile/profile.js` | 待实现 |
| **工具** | API 封装 | `utils/api.js` | 统一请求处理 |
| **配置** | 位置权限 | `app.json` | 后台定位权限 |
| **后端** | 房间管理 API | `cat-mouse-server/server.js` | 创建/加入/开始房间 |
| **后端** | 游戏状态 API | `cat-mouse-server/server.js` | 获取状态/倒计时 |
| **后端** | 位置更新 API | `cat-mouse-server/server.js` | 更新玩家位置 |
| **后端** | 扫码抓住 API | `cat-mouse-server/server.js` | 猫抓老鼠核心逻辑 |
| **后端** | 道具系统 API | `cat-mouse-server/server.js` | 加速/隐身/雷达 |
| **后端** | 游戏历史 API | `cat-mouse-server/server.js` | 历史记录查询 |
| **后端** | WebSocket | `cat-mouse-server/server.js` | 实时事件推送 |

### 开发中 🚧

| 模块 | 功能 | 进度 | 预计完成 |
|------|------|------|----------|
| **后端 API** | 房间管理接口 | 100% | ✅ 已完成 |
| **后端 API** | 游戏状态接口 | 100% | ✅ 已完成 |
| **后端 API** | 位置更新接口 | 100% | ✅ 已完成 |
| **后端 API** | 道具系统接口 | 100% | ✅ 已完成 |
| **后端 API** | 游戏历史接口 | 100% | ✅ 已完成 |
| **游戏历史** | 历史记录展示 | 50% | 前端待实现 |

### 待规划 📝

- [ ] 排行榜系统
- [ ] 成就系统
- [ ] 好友系统
- [ ] 多人语音聊天
- [ ] 游戏回放功能
- [ ] 举报系统

---

## 📁 项目结构

```
cat-mouse-miniprogram/
├── app.js                      # 小程序入口（全局配置）
├── app.json                    # 小程序配置（页面、权限）
├── app.wxss                    # 全局样式
├── project.config.json         # 项目配置（AppID 等）
├── sitemap.json                # 站点地图
├── DEVELOPMENT.md              # 本开发文档
├── README.md                   # 项目说明
│
├── pages/
│   ├── index/                  # 首页
│   │   ├── index.js
│   │   ├── index.wxml
│   │   └── index.wxss
│   ├── map/                    # 地图页（核心游戏页）
│   │   ├── map.js
│   │   ├── map.wxml
│   │   └── map.wxss
│   ├── room/                   # 房间管理页
│   │   ├── room.js
│   │   ├── room.wxml
│   │   └── room.wxss
│   └── profile/                # 个人中心页
│       ├── profile.js
│       ├── profile.wxml
│       └── profile.wxss
│
├── utils/
│   └── api.js                  # API 请求封装
│
├── components/                 # 自定义组件（待开发）
│
├── assets/
│   ├── icons/                  # 图标资源
│   │   ├── cat.png            # 猫图标
│   │   └── mouse.png          # 鼠图标
│   └── images/                 # 其他图片资源
│
└── .git/                       # Git 版本控制
```

---

## 🔌 后端 API 文档

**服务器地址**: `http://118.178.85.214:3004`

### 房间管理

| 接口 | 方法 | 请求参数 | 响应 | 说明 |
|------|------|----------|------|------|
| `/api/game/room` | POST | `{catCount, mouseCount, gameDuration, mapRange}` | `{gameId, roomId}` | 创建房间 |
| `/api/game/room/:id` | GET | - | `{roomInfo, players[]}` | 获取房间信息 |
| `/api/game/room/:id` | POST | `{playerId, nickname}` | `{playerId, role}` | 加入房间 |
| `/api/game/room/:id/start` | POST | - | `{success}` | 开始游戏（房主） |

### 游戏进行

| 接口 | 方法 | 请求参数 | 响应 | 说明 |
|------|------|----------|------|------|
| `/api/game/:id/status` | GET | - | `{status, players[], countdown}` | 获取游戏状态 |
| `/api/game/:id/location` | POST | `{playerId, latitude, longitude}` | `{success}` | 更新玩家位置 |
| `/api/game/:id/item` | POST | `{playerId, itemId, targetId}` | `{success, effect}` | 使用道具 |
| `/api/game/:id/end` | POST | `{winner}` | `{success, result}` | 结束游戏 |

### 用户系统

| 接口 | 方法 | 请求参数 | 响应 | 说明 |
|------|------|----------|------|------|
| `/api/user/login` | POST | `{code}` (微信登录码) | `{token, userInfo}` | 微信登录 |
| `/api/user/profile` | GET | - | `{userInfo}` | 获取用户信息 |
| `/api/user/profile` | PUT | `{nickname, avatar}` | `{success}` | 更新用户信息 |

---

## 🛠️ 开发环境配置

### 微信开发者工具

1. 下载：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html
2. 导入项目：选择 `cat-mouse-miniprogram` 目录
3. 配置 AppID：修改 `project.config.json`
4. 编译预览

### 真机调试

1. 微信开发者工具 → 预览 → 扫码
2. 或上传为体验版

### 位置权限

需要在 `app.json` 中配置：

```json
{
  "permission": {
    "scope.userLocation": {
      "desc": "用于在地图上显示你的位置，以便进行游戏"
    }
  },
  "requiredBackgroundModes": ["location"]
}
```

---

## 📝 Git 提交规范

### Commit Message 格式

```
<type>: <description>

[optional body]

[optional footer]
```

### Type 类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat: 添加道具系统` |
| `fix` | 修复 bug | `fix: 修复位置更新延迟` |
| `docs` | 文档更新 | `docs: 更新 API 文档` |
| `style` | 代码格式 | `style: 格式化代码` |
| `refactor` | 重构 | `refactor: 重构 API 封装` |
| `perf` | 性能优化 | `perf: 优化地图渲染` |
| `test` | 测试 | `test: 添加单元测试` |
| `chore` | 构建/工具 | `chore: 更新依赖` |

### 示例

```bash
git commit -m "feat: 添加游戏历史记录功能"
git commit -m "fix: 修复地图标记显示异常"
git commit -m "docs: 更新开发文档和 API 说明"
```

---

## 🚀 部署流程

### 前端（小程序）

1. 微信开发者工具 → 上传
2. 登录微信公众平台 → 版本管理
3. 提交审核 → 发布

### 后端（Node.js）

```bash
# 服务器上
cd cat-mouse-server
npm install
npm run start

# 或使用 PM2
pm2 start server.js --name cat-mouse-api
```

---

## 📊 当前版本

**Version**: `v0.1.0-alpha`

- ✅ 前端 UI 完成
- ✅ 演示模式可用
- ⚠️ 后端 API 待开发
- ⚠️ 需要真实服务器部署

---

## 📞 联系方式

有问题或需要添加功能，直接联系我！

---

*最后同步时间：2026-03-18 13:20*
