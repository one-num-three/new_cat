# 猫鼠游戏后端 API - 开发完成报告 🐱🐭

**完成时间**: 2026-03-18  
**版本**: v0.1.0-alpha  
**服务器**: http://118.178.85.214:3004

---

## ✅ 已完成功能

### 1. 后端服务器架构

**技术栈**:
- Node.js + Express (REST API)
- Socket.IO (WebSocket 实时通信)
- NodeCache (内存缓存)
- PM2 (进程管理)

**文件结构**:
```
cat-mouse-server/
├── server.js          # 主服务器文件
├── package.json       # 依赖配置
├── README.md          # 使用说明
└── .gitignore        # Git 忽略文件
```

---

### 2. API 接口清单

#### 用户系统

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/user/login` | POST | 微信登录（模拟） |
| `/api/user/profile` | GET | 获取用户信息 |
| `/api/user/profile` | PUT | 更新用户信息 |

#### 房间管理

| 接口 | 方法 | 请求参数 | 响应 |
|------|------|----------|------|
| `/api/game/room` | POST | `{catCount, mouseCount, gameDuration, mapRange}` | `{success, roomId, gameId}` |
| `/api/game/room/:id` | GET | - | `{success, id, status, players[]}` |
| `/api/game/room/:id` | POST | `{playerId, nickname}` | `{success, player, gameId}` |
| `/api/game/room/:id/start` | POST | `{playerId}` | `{success, players[]}` |

#### 游戏进行

| 接口 | 方法 | 请求参数 | 响应 |
|------|------|----------|------|
| `/api/game/:id/status` | GET | - | `{success, status, countdown, players[]}` |
| `/api/game/:id/location` | POST | `{playerId, latitude, longitude}` | `{success}` |
| `/api/game/:id/item` | POST | `{playerId, itemId, targetId}` | `{success, effect}` |
| `/api/game/:id/end` | POST | `{winner}` | `{success, result}` |

#### 游戏历史

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/game/history/:userId` | GET | 获取用户游戏历史 |

---

### 3. 核心功能实现

#### 位置更新与碰撞检测
- 使用 Haversine 公式计算 GPS 距离
- 猫鼠距离 < 10 米触发抓住事件
- 自动判定游戏结束（全抓/时间到）

```javascript
// 距离计算
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
```

#### 道具系统

| 道具 | 效果 | 持续时间 | 初始数量 |
|------|------|----------|----------|
| 加速 ⚡ | 移动速度提升 | 30 秒 | 猫×1 |
| 隐身 👻 | 不广播位置 | 15 秒 | 0 |
| 雷达 📡 | 显示所有玩家位置 | 一次性 | 鼠×1 |

#### 角色分配
- 按房间配置的猫鼠数量分配
- 猫优先分配，剩余为老鼠
- 游戏开始时随机分配

#### WebSocket 实时事件

```javascript
// 客户端监听事件
socket.on('playerJoined', (data) => { ... })     // 新玩家加入
socket.on('gameStart', (data) => { ... })        // 游戏开始
socket.on('locationUpdate', (data) => { ... })   // 位置更新
socket.on('itemUsed', (data) => { ... })         // 道具使用
socket.on('playerCaught', (data) => { ... })     // 抓住玩家
socket.on('gameEnd', (data) => { ... })          // 游戏结束
```

---

### 4. 前端适配

#### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `utils/api.js` | 更新 API 调用格式，匹配服务器响应 |
| `pages/map/map.js` | 实现真实 GPS 定位和后台位置更新 |
| `pages/room/room.js` | 优化创建/加入/开始逻辑 |

#### 位置权限配置

`app.json` 已配置：
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

## 🧪 测试结果

### API 测试

```bash
# 创建房间
$ curl -X POST http://localhost:3004/api/game/room \
  -H "Content-Type: application/json" \
  -d '{"catCount":1,"mouseCount":3,"gameDuration":600,"mapRange":1000}'

✅ 响应：{"success":true,"roomId":"2E4A150E","gameId":"2E4A150E"}

# 加入房间
$ curl -X POST http://localhost:3004/api/game/room/2E4A150E \
  -H "Content-Type: application/json" \
  -d '{"playerId":"player_001","nickname":"测试玩家"}'

✅ 响应：{"success":true,"player":{...}}

# 开始游戏
$ curl -X POST http://localhost:3004/api/game/room/2E4A150E/start \
  -H "Content-Type: application/json" \
  -d '{"playerId":"player_001"}'

✅ 响应：{"success":true,"players":[{role:"cat",...},{role:"mouse",...}]}

# 获取状态
$ curl http://localhost:3004/api/game/2E4A150E/status

✅ 响应：{"success":true,"status":"playing","countdown":596,"players":[...]}

# 更新位置
$ curl -X POST http://localhost:3004/api/game/2E4A150E/location \
  -H "Content-Type: application/json" \
  -d '{"playerId":"xxx","latitude":32.0584,"longitude":118.7968}'

✅ 响应：{"success":true}

# 使用道具
$ curl -X POST http://localhost:3004/api/game/2E4A150E/item \
  -H "Content-Type: application/json" \
  -d '{"playerId":"xxx","itemId":"radar","targetId":null}'

✅ 响应：{"success":true,"effect":{"type":"radar","players":[...]}}

# 游戏历史
$ curl http://localhost:3004/api/game/history/player_001

✅ 响应：{"success":true,"history":[{gameId:"...",result:"win",...}]}
```

---

## 📊 开发状态

| 模块 | 功能 | 状态 |
|------|------|------|
| **后端 API** | 房间管理 | ✅ 100% |
| **后端 API** | 游戏状态 | ✅ 100% |
| **后端 API** | 位置更新 | ✅ 100% |
| **后端 API** | 道具系统 | ✅ 100% |
| **后端 API** | 游戏历史 | ✅ 100% |
| **前端** | API 对接 | ✅ 100% |
| **前端** | 真实定位 | ✅ 100% |
| **前端** | 历史展示 | ⏳ 待实现 |

---

## 🚀 部署说明

### 服务器部署

```bash
# 已使用 PM2 部署
pm2 list
# 进程名：cat-mouse-game
# 端口：3004
# 状态：online
```

### 重启服务

```bash
pm2 restart cat-mouse-game
```

### 查看日志

```bash
pm2 logs cat-mouse-game --lines 50
```

---

## 📝 下一步工作

### 待实现功能

1. **游戏历史展示页面** - 前端 UI 开发
2. **WebSocket 前端集成** - 实时事件处理
3. **道具 UI 交互完善** - 使用动画和提示
4. **排行榜系统** - 统计获胜次数
5. **数据库持久化** - 替换内存存储

### 优化建议

1. 使用 Redis 替代 NodeCache（生产环境）
2. 添加 JWT 认证
3. 实现微信真实登录
4. 添加反作弊机制
5. 优化位置上报频率（根据速度动态调整）

---

## 📞 测试方法

### 真机测试流程

1. 微信开发者工具 → 真机预览
2. 扫码打开小程序
3. 创建/加入房间
4. 授权位置权限
5. 实际移动测试位置更新

### 多设备测试

1. 设备 A 创建房间（猫）
2. 设备 B 加入房间（鼠）
3. 开始游戏
4. 双方移动测试碰撞检测

---

**开发者**: AI Assistant  
**最后更新**: 2026-03-18 14:15
