# 扫码抓住功能说明 📷🐭

**更新时间**: 2026-03-18  
**版本**: v0.1.0-alpha

---

## 🎮 游戏玩法

### 核心机制

**猫抓老鼠** 不再是自动碰撞检测，而是通过**扫码**实现：

1. 🐭 **老鼠**：生成个人二维码，用于被猫扫描
2. 🐱 **猫**：使用扫码功能，扫描老鼠的二维码
3. ✅ **抓住**：扫码成功后，老鼠状态变为"被抓住"
4. 🏆 **胜利**：猫抓住所有老鼠即获胜

---

## 📱 使用流程

### 老鼠方

1. **进入游戏**
   - 加入房间，游戏开始
   - 角色分配为"老鼠"

2. **生成二维码**
   - 点击地图页左下角"🐭 我的二维码"按钮
   - 系统生成包含游戏信息的二维码

3. **展示二维码**
   - 向附近的猫展示二维码
   - 或保存到相册发送给猫

4. **被抓住后**
   - 状态变为"已抓住"
   - 无法再次被扫
   - 等待游戏结束

### 猫方

1. **进入游戏**
   - 加入房间，游戏开始
   - 角色分配为"猫"

2. **扫码抓人**
   - 点击地图页左下角"📷 扫码抓人"按钮
   - 使用摄像头扫描老鼠的二维码
   - 也可从相册选择二维码图片

3. **抓住成功**
   - 系统提示抓住结果
   - 显示已抓住数量和剩余数量
   - 抓住所有老鼠后游戏自动结束

---

## 🔧 技术实现

### 二维码数据格式

```json
{
  "gameId": "游戏 ID",
  "playerId": "玩家 ID",
  "role": "mouse",
  "nickname": "玩家昵称"
}
```

### API 接口

**扫码抓住**
```http
POST /api/game/:gameId/catch
Content-Type: application/json

{
  "catcherId": "猫的 ID",
  "caughtId": "老鼠的 ID"
}
```

**响应示例**
```json
{
  "success": true,
  "message": "抓住成功",
  "catchCount": 1,
  "remaining": 2
}
```

### 距离验证（可选）

服务器支持距离验证，防止远程扫码作弊：

```javascript
// 检查猫鼠距离（10 米内有效）
if (distance > 10) {
  return res.status(400).json({ 
    success: false, 
    message: '距离太远，无法抓住' 
  });
}
```

---

## 📂 相关文件

### 前端文件

| 文件 | 说明 |
|------|------|
| `pages/map/map.js` | 地图页（扫码按钮逻辑） |
| `pages/map/map.wxml` | 地图页 UI |
| `pages/qrcode/qrcode.js` | 二维码展示页 |
| `pages/qrcode/qrcode.wxml` | 二维码页面 UI |
| `utils/api.js` | API 封装（catchPlayer） |

### 后端文件

| 文件 | 说明 |
|------|------|
| `cat-mouse-server/server.js` | 服务器（/api/game/:id/catch 接口） |

---

## 🧪 测试方法

### 单机测试（模拟）

```bash
# 1. 创建房间
curl -X POST http://localhost:3004/api/game/room \
  -H "Content-Type: application/json" \
  -d '{"catCount":1,"mouseCount":1,"gameDuration":600}'

# 2. 猫加入
curl -X POST http://localhost:3004/api/game/room/:id \
  -H "Content-Type: application/json" \
  -d '{"playerId":"cat_001"}'

# 3. 鼠加入
curl -X POST http://localhost:3004/api/game/room/:id \
  -H "Content-Type: application/json" \
  -d '{"playerId":"mouse_001"}'

# 4. 开始游戏
curl -X POST http://localhost:3004/api/game/room/:id/start \
  -H "Content-Type: application/json" \
  -d '{"playerId":"cat_001"}'

# 5. 扫码抓住
curl -X POST http://localhost:3004/api/game/:id/catch \
  -H "Content-Type: application/json" \
  -d '{"catcherId":"cat_id","caughtId":"mouse_id"}'
```

### 真机测试

1. **准备两台设备**
   - 设备 A：登录微信，打开小程序
   - 设备 B：登录另一个微信账号

2. **创建游戏**
   - 设备 A 创建房间，选择 1 猫 1 鼠
   - 设备 B 通过房间号加入

3. **开始游戏**
   - 设备 A 点击开始游戏
   - 确认角色分配（A 猫 B 鼠）

4. **测试扫码**
   - 设备 B 点击"我的二维码"
   - 设备 A 点击"扫码抓人"
   - 扫描设备 B 的二维码
   - 验证抓住成功提示

---

## ⚠️ 注意事项

### 安全验证

1. **身份验证**
   - 只有猫可以抓人
   - 只能抓老鼠角色

2. **游戏状态验证**
   - 游戏未开始时无法抓人
   - 游戏结束后无法抓人

3. **重复抓住验证**
   - 已抓住的老鼠无法再次被扫

4. **距离验证（可选）**
   - 默认启用 10 米限制
   - 可在服务器代码中调整或关闭

### 用户体验

1. **二维码有效期**
   - 游戏期间有效
   - 游戏结束后失效

2. **扫码反馈**
   - 成功：显示抓住数量和剩余数量
   - 失败：显示具体原因（距离远/已抓住等）

3. **游戏结束**
   - 抓住最后一只老鼠后自动结束
   - 显示胜利/失败提示

---

## 🔄 后续优化

### 功能增强

- [ ] 二维码离线生成（无需网络）
- [ ] 扫码音效和动画
- [ ] 抓住排行榜
- [ ] 防作弊机制（位置 + 时间戳）

### 体验优化

- [ ] 二维码刷新功能
- [ ] 扫码历史记录
- [ ] 被抓瞬间的特效
- [ ] 投降/认输功能

---

**开发者**: AI Assistant  
**最后更新**: 2026-03-18 14:45
