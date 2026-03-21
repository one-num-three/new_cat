# 猫鼠游戏后端服务器 🐱🐭

## 快速开始

```bash
# 安装依赖
npm install

# 启动服务器
npm start

# 开发模式
npm run dev
```

## API 文档

服务器地址：`http://118.178.85.214:3004`

### 用户系统

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/user/login` | POST | 微信登录 |
| `/api/user/profile` | GET | 获取用户信息 |
| `/api/user/profile` | PUT | 更新用户信息 |

### 房间管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/game/room` | POST | 创建房间 |
| `/api/game/room/:id` | GET | 获取房间信息 |
| `/api/game/room/:id` | POST | 加入房间 |
| `/api/game/room/:id/start` | POST | 开始游戏 |

### 游戏进行

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/game/:id/status` | GET | 获取游戏状态 |
| `/api/game/:id/location` | POST | 更新位置 |
| `/api/game/:id/item` | POST | 使用道具 |
| `/api/game/:id/end` | POST | 结束游戏 |

### 游戏历史

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/game/history/:userId` | GET | 获取游戏历史 |

## 测试示例

### 创建房间
```bash
curl -X POST http://localhost:3004/api/game/room \
  -H "Content-Type: application/json" \
  -d '{"catCount":1,"mouseCount":5,"gameDuration":600,"mapRange":1000}'
```

### 加入房间
```bash
curl -X POST http://localhost:3004/api/game/room/123456 \
  -H "Content-Type: application/json" \
  -d '{"playerId":"player_001","nickname":"测试玩家"}'
```

### 开始游戏
```bash
curl -X POST http://localhost:3004/api/game/room/123456/start \
  -H "Content-Type: application/json" \
  -d '{"playerId":"player_001"}'
```

## 数据存储

当前使用内存存储（Map），重启后数据会丢失。生产环境应使用数据库（如 MongoDB/MySQL）。

## 部署

使用 PM2 进行生产部署：

```bash
npm install -g pm2
pm2 start server.js --name cat-mouse-api
pm2 save
pm2 startup
```
