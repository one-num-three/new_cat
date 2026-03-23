# 🐱🐭 猫鼠游戏小程序 - 开发文档

> 线下实景追逐游戏 · 线上实时定位

---

## 📋 项目概述

猫鼠游戏是一款基于地理位置的线下实景追逐游戏小程序。玩家分为猫和鼠两个阵营，猫需要抓住老鼠，老鼠需要躲避追捕。被抓的老鼠会变成猫，继续追捕其他老鼠！

### 核心玩法

#### 🐱 猫（Cat）
**目标**：抓住所有老鼠

**初始状态**：
- 积分：20 分
- 道具：无（需购买）

**抓老鼠**：
1. 靠近老鼠（10米内）
2. 点击「📷 扫码抓人」
3. 扫描老鼠的二维码
4. 抓住成功！老鼠变成猫

**积分规则**：
- 抓住老鼠：5 分 + 老鼠当前积分的一半
- 新猫（被抓变成猫的）：继承原猫一半积分

**道具商店**：
| 道具 | 价格 | 效果 |
|------|------|------|
| 👻 隐身 | 15 分 | 15秒内对其他玩家隐藏 |

---

#### 🐭 老鼠（Mouse）
**目标**：躲避猫的追捕，存活到游戏结束

**初始状态**：
- 积分：0 分

**躲避技巧**：
1. 保持移动，不要停留
2. 利用地图障碍物遮挡
3. 注意周围环境

**积分规则**：
- 每存活 1 分钟：+3 分
- 存活越久，积分越高！

**被抓住**：
- 变成猫！继续追捕其他老鼠
- 继承抓你的猫一半积分

---

#### 🔄 角色转换
被抓的老鼠会变成猫：
1. 原猫获得：基础 5 分 + 老鼠积分的一半
2. 新猫继承：原猫积分的一半
3. 继续追捕剩余的老鼠

---

## 🎯 获胜条件

| 获胜方 | 条件 |
|--------|------|
| 🐱 猫获胜 | 所有老鼠被抓或掉线 |
| 🐭 老鼠获胜 | 时间结束仍有老鼠存活，或所有猫掉线 |

---

## 📡 可见性规则

| 查看者 | 目标 | 可见条件 |
|--------|------|----------|
| 猫 | 猫 | ✅ 始终可见 |
| 猫 | 老鼠 | 仅 visionRange 米内 |
| 老鼠 | 老鼠 | ✅ 始终可见 |
| 老鼠 | 猫 | 仅 visionRange 米内 |

**隐身道具**：使用后 15 秒内对所有其他玩家不可见

---

## 🔌 掉线与重新加入

### 掉线检测
| 检测类型 | 时间 | 效果 |
|---------|------|------|
| 显示掉线 | 2秒 | 显示 💤 图标 |
| 踢出对局 | 10秒 | 移出玩家列表 |

### 重新加入
被踢出的玩家回来后：
- 自动检测并重新加入
- 恢复原有角色（猫/鼠）
- 恢复原有积分
- 继续游戏

---

## 🏗️ 技术架构

### 前端（微信小程序）
```
猫鼠小程序 (cat-mouse-miniprogram/)
├── pages/
│   ├── index/        # 首页
│   ├── map/          # 地图页（核心游戏页面）
│   ├── room/         # 房间等待页
│   ├── profile/      # 个人中心
│   ├── qrcode/       # 二维码页
│   └── history/      # 历史记录
├── utils/
│   └── api.js        # API 调用封装
└── app.js            # 小程序入口
```

### 后端（Node.js + Express + Socket.IO）
```
猫鼠服务器 (cat-mouse-server/)
├── server.js         # 主服务器
├── Dockerfile        # 微信云托管部署
├── package.json
└── README.md
```

### 代码仓库
| 项目 | 地址 |
|------|------|
| 后端 GitHub | https://github.com/one-num-three/cat-mouse-server |
| 后端 Gitee | https://gitee.com/Keke_cocoa/cat-mouse-server |
| 前端 GitHub | https://github.com/one-num-three/cat-mouse-miniprogram |

---

## 🌐 服务器配置

### 本地开发服务器
| 端口 | 协议 | 地址 | 用途 |
|------|------|------|------|
| 4001 | HTTP | `http://118.178.85.214:4001` | 开发测试 |
| 4000 | HTTPS | `https://campus-link.fit:4000` | 生产环境（需备案） |

### 微信云托管
| 配置项 | 值 |
|--------|-----|
| 服务名称 | mousecat |
| 云环境 ID | prod-2g2i6z425323d612 |
| 公网域名 | https://mousecat-235685-9-1412623736.sh.run.tcloudbase.com |

### PM2 管理
```bash
pm2 status cat-mouse-game    # 查看状态
pm2 logs cat-mouse-game      # 查看日志
pm2 restart cat-mouse-game   # 重启服务
```

---

## 📡 API 接口

### 版本查询
```javascript
GET /api/version
// 返回: { version: "1.4.4", date: "2026-03-23" }
```

### 房间管理
```javascript
// 创建房间
POST /api/game/room
{ catCount, mouseCount, gameDuration, mapRange, revealTime }

// 加入房间
POST /api/game/room/:roomId
{ playerId, nickname, isOwner, role }

// 重新加入（被踢出后恢复）
POST /api/game/room/:roomId/rejoin
{ playerId }

// 获取房间信息
GET /api/game/room/:roomId

// 开始游戏
POST /api/game/room/:roomId/start
{ playerId }
```

### 游戏进行
```javascript
// 获取游戏状态
GET /api/game/:gameId/status

// 更新位置
POST /api/game/:gameId/location
{ playerId, latitude, longitude }

// 扫码抓住
POST /api/game/:gameId/catch
{ catcherId, caughtId, catLat, catLng, mouseLat, mouseLng }

// 使用道具
POST /api/game/:gameId/item
{ playerId, itemId }

// 离开游戏
POST /api/game/:gameId/leave
{ playerId }
```

### WebSocket 事件
```javascript
// 客户端 → 服务器
socket.emit('joinRoom', roomId)

// 服务器 → 客户端
socket.on('playerJoined', { player, players })
socket.on('playerRejoined', { player, players })  // 重新加入
socket.on('gameStart', { players, startTime, endTime })
socket.on('locationUpdate', { playerId, latitude, longitude })
socket.on('playerCaught', { catcherId, caughtId, catchCount })
socket.on('itemUsed', { playerId, itemId, effect })
socket.on('gameEnd', { winner, reason, endTime })
```

---

## 📝 更新日志

### v1.4.4 (2026-03-23)
- ✅ 掉线检测优化：2秒显示掉线，10秒踢出对局
- ✅ 被踢出玩家可重新加入，恢复角色和积分
- ✅ 道具只保留隐身，删除加速和雷达
- ✅ 倒计时跳动问题修复

### v1.4.1 (2026-03-23)
- ✅ 阵营掉线胜负逻辑：猫全掉线鼠胜，鼠全掉线猫胜

### v1.3.0 (2026-03-23)
- ✅ 老鼠被抓后变成猫
- ✅ 抓人时前端传递位置，解决云托管多实例问题
- ✅ 版本号接口 `/api/version`
- ✅ 掉线检测改为基于位置上报

### v1.0.0 (2026-03-18)
- ✅ 基础游戏功能
- ✅ 微信云托管部署
- ✅ 扫码抓人
- ✅ 道具系统

---

## ⚠️ 注意事项

### 开发环境
```bash
# 小程序
git pull origin main

# 后端
git pull origin main
pm2 restart cat-mouse-game
```

### 微信开发者工具
- ✅ 勾选「不校验合法域名」
- ✅ 清除缓存后重新编译

### Git 提交规范
- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新

### 数据持久化
- 当前：内存缓存（NodeCache）
- 建议：生产环境使用 Redis/MySQL

---

## 📞 联系方式

- **服务器**：118.178.85.214
- **域名**：campus-link.fit
- **工作目录**：/home/transplanted

---

**最后更新**：2026-03-23 16:20