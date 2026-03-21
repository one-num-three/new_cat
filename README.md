# 🐱🐭 猫鼠游戏小程序 - 开发文档

> 线下实景追逐游戏 · 线上实时定位

---

## 📋 项目概述

猫鼠游戏是一款基于地理位置的线下实景追逐游戏小程序。玩家分为猫和鼠两个阵营，猫需要抓住老鼠，老鼠需要躲避追捕。

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
4. 抓住成功！

**积分规则**：
- 抓住老鼠：5 分 + 老鼠当前积分的一半

**道具商店**（每个 15 积分）：
| 道具 | 效果 | 策略 |
|------|------|------|
| ⚡ 加速 | 30秒移动速度提升 | 快速追击老鼠 |
| 👻 隐身 | 15秒对其他玩家隐藏 | 悄悄接近老鼠 |
| 📡 雷达 | 显示所有玩家位置 | 掌握全局位置 |

---

#### 🐭 老鼠（Mouse）
**目标**：躲避猫的追捕，存活到游戏结束

**初始状态**：
- 积分：0 分
- 道具：无（猫才有道具）

**躲避技巧**：
1. 保持移动，不要停留
2. 利用地图障碍物遮挡
3. 注意周围环境

**积分规则**：
- 每存活 1 分钟：+3 分
- 存活越久，积分越高！

**被抓住**：
- 显示「你已被抓住」
- 可以观战其他玩家
- 游戏结束结算积分

---

#### 🎭 揭秘身份
- 游戏开始后可设置延迟公开身份（默认 3 分钟）
- 揭秘前：不知道自己和其他人的角色
- 揭秘后：显示猫/老鼠身份

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
│   └── qrcode/       # 二维码页
├── utils/
│   └── api.js        # API 调用封装
└── app.js            # 小程序入口
```

### 后端（Node.js + Express + Socket.IO）
```
猫鼠服务器 (cat-mouse-server/)
└── server.js         # 主服务器（HTTPS + HTTP 双端口）
```

### 数据存储
- **NodeCache** - 内存缓存（房间、游戏、用户数据）
- **生产环境建议**：Redis

---

## 🌐 服务器配置

### 🚨 当前部署状态（重要！）

| 阶段 | 环境 | 地址 | 状态 |
|------|------|------|------|
| **当前** | 微信云托管 | `https://mousecat-235685-9-1412623736.sh.run.tcloudbase.com` | ✅ 运行中（有冷启动延迟） |
| **备案后** | 阿里云 HTTPS | `https://campus-link.fit:4000` | ⏳ 等待域名备案 |

**部署流程：**
1. **现在**：使用微信云托管（免备案，即开即用）
2. **等待**：域名 `campus-link.fit` 备案完成
3. **切换**：备案后切换到阿里云服务器（无冷启动，更稳定）

### 端口分配（阿里云服务器 118.178.85.214）

| 端口 | 协议 | 地址 | 用途 | 状态 |
|------|------|------|------|------|
| 4000 | HTTPS | `https://campus-link.fit:4000` | 生产环境（备案后用） | ⏳ 待备案 |
| 4001 | HTTP | `http://118.178.85.214:4001` | 开发测试（备用） | ✅ 正常 |

### 为什么现在用微信云托管？

- 微信云托管**免备案**，可以立即使用
- 阿里云 HTTPS 域名**需要备案**，备案中...
- 备案完成后切回阿里云，解决冷启动问题

---

## ⚠️ 重要：微信环境差异

| 环境 | 域名校验 | HTTP IP | HTTPS 域名 | 说明 |
|------|----------|---------|-----------|------|
| 开发者工具模拟器 | ❌ 可关闭 | ✅ | ❌ 证书问题 | 开发用 |
| 真机调试 | ❌ 可关闭 | ✅ | ⚠️ 可能失败 | 测试用 |
| 预览版 | ✅ 强制 | ❌ | ✅ 需备案 | 体验用 |
| 正式版 | ✅ 强制 | ❌ | ✅ 需备案 | 上线用 |

**结论：**
- 开发和测试：用 HTTP IP + 真机调试
- 上线发布：用 HTTPS 域名（备案后）

---

## 🌐 服务器配置（详细）

### 端口分配

| 端口 | 协议 | 地址 | 用途 |
|------|------|------|------|
| **4000** | HTTPS | `https://campus-link.fit:4000` | 生产环境 |
| **4001** | HTTP | `http://118.178.85.214:4001` | 开发测试 |
| 4002 | - | - | 备用 |

### SSL 证书
- **证书类型**：ZeroSSL ECC
- **证书域名**：campus-link.fit
- **证书路径**：`/home/admin/.acme.sh/campus-link.fit_ecc/`
- **自动续期**：acme.sh 定时任务

### 服务器进程
```bash
# 查看进程
ps aux | grep cat-mouse-server

# 重启服务器
pkill -f "cat-mouse-server/server.js"
cd /home/transplanted/cat-mouse-server && node server.js &

# 查看端口
netstat -tlnp | grep 4000
```

---

## 📱 小程序配置

### 服务器地址
```javascript
// app.js
serverUrl: 'https://campus-link.fit:4000'  // 生产
serverUrl: 'http://118.178.85.214:4001'    // 开发
```

### 开发模式配置
微信开发者工具 → 详情 → 本地设置：
- ✅ **不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书**

### 微信公众平台配置（备案后）
1. 登录 https://mp.weixin.qq.com
2. 开发 → 开发管理 → 开发设置
3. 服务器域名 → request 合法域名：
   ```
   https://campus-link.fit
   ```

---

## 🎮 游戏流程

### 1. 创建房间
```
首页 → 创建游戏 → 设置参数 → 进入等待房间
```

### 2. 等待玩家
- 显示房间号（4 位数字）
- 显示玩家列表（昵称、头像）
- **不提前暴露身份**
- 房主可修改游戏设置

### 3. 开始游戏
- 房主点击"开始游戏"
- 系统分配角色（猫/鼠）
- 跳转到地图页

### 4. 游戏进行
- **猫**：扫码抓老鼠
- **鼠**：躲避、使用道具
- **揭秘身份**：到达设定时间后公开

### 5. 游戏结束
- 时间到或所有老鼠被抓
- 显示结果

---

## ⚙️ 游戏设置

| 设置项 | 范围 | 默认值 |
|--------|------|--------|
| 🐱 猫的数量 | 1-5 只 | 1 只 |
| 🐭 老鼠数量 | 3-20 只 | 5 只 |
| ⏱️ 游戏时长 | 5-30 分钟 | 10 分钟 |
| 📍 活动范围 | 0.5-5 km | 1 km |
| 🎭 揭秘身份时间 | 0-10 分钟 | 3 分钟 |

---

## 🏆 积分系统

### 初始积分
| 角色 | 初始积分 |
|------|----------|
| 🐱 猫 | 20 分 |
| 🐭 老鼠 | 0 分 |

### 获得积分
| 行为 | 积分 | 说明 |
|------|------|------|
| 🐱 抓住老鼠 | 5 + 老鼠积分/2 | 猫获得奖励 |
| 🐭 存活 1 分钟 | +3 分 | 老鼠存活奖励 |

### 道具价格
| 道具 | 价格 | 效果 |
|------|------|------|
| ⚡ 加速 | 15 分 | 30秒速度提升 |
| 👻 隐身 | 15 分 | 15秒隐藏位置 |
| 📡 雷达 | 15 分 | 显示所有玩家位置 |

**策略提示：**
- 猫：尽快抓住老鼠，获得高额积分奖励
- 老鼠：尽量存活，每分钟自动获得积分

---

## 📡 API 接口

### 房间管理
```javascript
// 创建房间
POST /api/game/room
{ catCount, mouseCount, gameDuration, mapRange, revealTime }

// 加入房间
POST /api/game/room/:roomId
{ playerId, nickname, isOwner }

// 获取房间信息
GET /api/game/room/:roomId

// 更新房间设置（房主）
PUT /api/game/room/:roomId/settings
{ playerId, settings }

// 开始游戏（房主）
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

// 扫码抓住（猫专用）
POST /api/game/:gameId/catch
{ catcherId, caughtId }

// 使用道具
POST /api/game/:gameId/item
{ playerId, itemId, targetId }

// 结束游戏
POST /api/game/:gameId/end
{ winner }
```

### WebSocket 事件
```javascript
// 客户端 → 服务器
socket.emit('joinRoom', roomId)
socket.emit('leaveRoom', roomId)

// 服务器 → 客户端
socket.on('playerJoined', { player, players })
socket.on('gameStart', { players, startTime, endTime })
socket.on('locationUpdate', { playerId, latitude, longitude })
socket.on('playerCaught', { catcherId, caughtId, catchCount })
socket.on('itemUsed', { playerId, itemId, effect })
socket.on('gameEnd', { winner, endTime })
socket.on('settingsUpdated', { settings })
```

---

## ⚠️ 注意事项

### 1. 开发环境
- ✅ **真机调试**：可关闭域名校验，使用 HTTP 4001 端口
- ❌ **预览版**：需要备案 + 配置域名
- ❌ **正式版**：需要备案 + 审核

### 2. 域名备案
- 当前状态：**备案中**
- 备案前使用：`http://118.178.85.214:4001`
- 备案后使用：`https://campus-link.fit:4000`

### 3. 阿里云安全组
确保开放以下端口：
```
4000/TCP  - HTTPS 生产
4001/TCP  - HTTP 开发
```

### 4. 位置权限
小程序需要以下权限：
- `scope.userLocation` - 位置权限
- `requiredPrivateInfos` - 隐私信息声明
- `requiredBackgroundModes` - 后台定位

### 5. 地图手势
- 单指滑动：移动地图
- 双指捏合：缩放地图
- 双指旋转：旋转方向
- 右侧按钮：+/−缩放、📍定位

### 6. 测试阶段
- ✅ 允许 1 人开始游戏（方便测试）
- 生产环境建议恢复"至少 2 人"限制

### 7. 数据持久化
- 当前：内存缓存（服务器重启数据丢失）
- 建议：生产环境使用 Redis

### 8. Git 提交规范
```bash
# 小程序
cd cat-mouse-miniprogram
git add -A
git commit -m "feat/fix/docs: 描述"
git push origin main

# 服务器
cd /home/transplanted
git add cat-mouse-server/server.js
git commit -m "feat/fix/docs: 描述"
git push origin master
```

---

## 🐛 常见问题

### Q1: ERR_CONNECTION_RESET（2026-03-18 重大发现）
**现象：**
- 真机调试/预览版报错 `net::ERR_CONNECTION_RESET`
- 模拟器正常，真机失败
- IP 地址 HTTP 正常，域名 HTTPS 失败

**原因分析：**
1. **微信要求 HTTPS 域名必须备案**
   - 未备案域名无法通过微信 HTTPS 校验
   - 浏览器可以访问，微信不行

2. **证书链问题**
   - Node.js 需要完整的证书链（fullchain.cer）
   - 只配服务器证书不够

3. **非标准端口问题**
   - 4000 端口 HTTPS 不被微信信任
   - 443 标准端口需要备案

**解决方案：**
```javascript
// 开发阶段（推荐）
serverUrl: 'http://118.178.85.214:4001'

// 生产阶段（备案后）
serverUrl: 'https://campus-link.fit'
```

**关键结论：**
- 开发用 HTTP IP ✅
- 上线用 HTTPS 域名（备案后）✅
- 不要试图在开发阶段用未备案的 HTTPS 域名 ❌

### Q2: ERR_CERT_COMMON_NAME_INVALID
**原因**：证书域名不匹配
**解决**：使用域名访问，不用 IP

### Q3: request:fail 网络错误
**原因**：微信开发者工具域名校验
**解决**：
- 开发者工具：勾选"不校验合法域名..."
- 真机调试：关闭域名校验

### Q4: appLaunch with non-empty page stack
**原因**：小程序缓存问题
**解决**：清除缓存 → 重新编译

### Q5: 地图无法移动缩放
**原因**：WXSS pointer-events 配置
**解决**：确保地图控件 pointer-events: auto

---

## 📊 当前状态

| 模块 | 状态 | 备注 |
|------|------|------|
| 创建房间 | ✅ 完成 | 4 位数字房间号 |
| 等待房间 | ✅ 完成 | 不提前暴露身份 |
| 游戏设置 | ✅ 完成 | 房主可修改 |
| 地图定位 | ✅ 完成 | 支持手势操作 |
| 扫码抓住 | ✅ 完成 | 猫专用 |
| 道具系统 | ✅ 完成 | 加速/隐身/雷达 |
| HTTPS | ✅ 完成 | 证书已配置 |
| 备案 | ⏳ 进行中 | 备案后可用预览版 |

---

## ☁️ 微信云托管部署（2026-03-19）

### 部署信息

| 配置项 | 值 |
|--------|-----|
| **服务名称** | mousecat |
| **云环境 ID** | prod-2g2i6z425323d612 |
| **公网域名** | https://mousecat-235685-9-1412623736.sh.run.tcloudbase.com |
| **内网域名** | crnzsjsl.mousecat.9dmswf0u.ha78zs55.com |
| **服务规格** | 1核1G |

### 代码仓库

| 项目 | 地址 |
|------|------|
| 后端服务 | https://github.com/one-num-three/cat-mouse-server |
| 小程序 | 本地 Git（从服务器同步） |

### 关键技术点

#### 1. 使用 `wx.cloud.callContainer` 调用云托管

云托管服务无需配置域名白名单，使用微信私有协议通信：

```javascript
wx.cloud.callContainer({
  config: { env: 'prod-2g2i6z425323d612' },
  path: '/api/game/room',
  header: { 'X-WX-SERVICE': 'mousecat' },
  method: 'POST',
  data: {}
});
```

#### 2. 云开发初始化

`app.js` 中初始化云开发：

```javascript
wx.cloud.init({
  env: 'prod-2g2i6z425323d612',
  traceUser: true
});
```

#### 3. 环境切换

修改 `app.js` 中的 `env` 即可切换环境：

```javascript
globalData: {
  env: 'cloud',  // 'dev' 使用阿里云，'cloud' 使用微信云托管
}
```

### 部署步骤记录

1. **创建 Dockerfile** - 适配云托管环境（端口 80）
2. **调整 server.js** - 移除 HTTPS，使用环境变量 PORT
3. **创建 GitHub 仓库** - https://github.com/one-num-three/cat-mouse-server
4. **云托管从 GitHub 部署** - 选择代码库，自动构建
5. **修改小程序 API** - 使用 `wx.cloud.callContainer` 替代 `wx.request`
6. **初始化云开发** - `app.js` 中调用 `wx.cloud.init()`

### 数据库信息（云托管）

| 配置项 | 值 |
|--------|-----|
| 数据库类型 | MySQL |
| 账号 | root |
| 密码 | S7gfNYxT |

> ⚠️ 当前服务使用内存缓存（NodeCache），数据库暂未使用。生产环境建议改用 MySQL 或 Redis。

### 注意事项

- **默认域名**：`*.run.tcloudbase.com` 仅用于测试，正式上线需绑定自定义域名
- **冷启动**：服务长时间未使用会有冷启动延迟，可设置「最小实例数」为 1 避免休眠
- **数据持久化**：容器重启数据会丢失，需要使用云托管的 MySQL/Redis

---

## 📝 更新日志

### 2026-03-19
- ✅ 部署到微信云托管（免备案）
- ✅ 创建 GitHub 仓库：cat-mouse-server
- ✅ 小程序支持 `wx.cloud.callContainer` API
- ✅ 云开发初始化配置
- ✅ 修复 `getApp()` 未初始化问题
- ✅ 测试通过：创建房间功能正常

### 2026-03-18
- ✅ 添加房间等待页面（不提前暴露身份）
- ✅ 添加游戏设置（猫/鼠数量、时长、范围、揭秘时间）
- ✅ 配置 HTTPS（复用 campus-link.fit 证书）
- ✅ 启动 HTTP 4001 端口（开发测试用）
- ✅ 优化地图手势操作（滑动、缩放、旋转）
- ✅ 添加地图控制按钮（+/−、📍）
- ✅ 允许 1 人开始游戏（测试阶段）
- ✅ 房间号改为 4 位数字

---

## 📞 联系方式

- **服务器**：118.178.85.214
- **域名**：campus-link.fit
- **工作目录**：/home/transplanted
- **云托管域名**：https://mousecat-235685-9-1412623736.sh.run.tcloudbase.com

---

**最后更新**：2026-03-19 20:25
