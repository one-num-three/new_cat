// /home/transplanted/cat-mouse-server/server.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 缓存存储（生产环境建议用 Redis）
const roomCache = new NodeCache({ stdTTL: 3600 }); // 房间数据 1 小时过期
const gameCache = new NodeCache({ stdTTL: 3600 });  // 游戏数据 1 小时过期
const userCache = new NodeCache({ stdTTL: 86400 }); // 用户数据 24 小时过期

// ========== 用户相关 ==========

// 微信登录（简化版，实际需对接微信 API）
app.post('/api/user/login', async (req, res) => {
  try {
    const { code } = req.body;
    console.log('[登录] code:', code);
    
    // TODO: 实际项目中需要调用微信 API 换取 openid
    // const response = await axios.get(`https://api.weixin.qq.com/sns/jscode2session?appid=${APP_ID}&secret=${APP_SECRET}&js_code=${code}&grant_type=authorization_code`);
    
    // 模拟登录 - 生成临时用户
    const userId = uuidv4();
    const token = `token_${userId}_${Date.now()}`;
    
    const userInfo = {
      id: userId,
      nickname: `玩家${Math.floor(Math.random() * 10000)}`,
      avatarUrl: '',
      createdAt: new Date().toISOString()
    };
    
    userCache.set(userId, userInfo);
    userCache.set(token, userId);
    
    console.log('[登录成功] userId:', userId);
    res.json({
      success: true,
      token,
      userInfo
    });
  } catch (error) {
    console.error('[登录失败]', error);
    res.status(500).json({ success: false, message: '登录失败' });
  }
});

// 获取用户信息
app.get('/api/user/profile', (req, res) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ success: false, message: '未登录' });
  }
  
  const userId = userCache.get(token);
  if (!userId) {
    return res.status(401).json({ success: false, message: '登录已过期' });
  }
  
  const userInfo = userCache.get(userId);
  res.json({ success: true, userInfo });
});

// ========== 房间相关 ==========

// 创建房间
app.post('/api/game/room', (req, res) => {
  try {
    const { catCount = 1, mouseCount = 5, gameDuration = 600, mapRange = 1000, revealTime = 180 } = req.body;
    // 生成 4 位数字房间号
    const roomId = Math.floor(1000 + Math.random() * 9000).toString();
    
    const room = {
      id: roomId,
      status: 'waiting', // waiting, playing, ended
      settings: { catCount, mouseCount, gameDuration, mapRange, revealTime },
      players: [],
      createdAt: new Date().toISOString(),
      ownerId: null
    };
    
    roomCache.set(roomId, room);
    console.log('[创建房间] roomId:', roomId);
    
    res.json({
      success: true,
      roomId,
      gameId: roomId, // 房间 ID 即游戏 ID
      message: '房间创建成功'
    });
  } catch (error) {
    console.error('[创建房间失败]', error);
    res.status(500).json({ success: false, message: '创建失败' });
  }
});

// 加入房间
app.post('/api/game/room/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;
    const { playerId: reqPlayerId, nickname, isOwner } = req.body;
    const room = roomCache.get(roomId);
    
    if (!room) {
      return res.status(404).json({ success: false, message: '房间不存在' });
    }
    
    if (room.status !== 'waiting') {
      return res.status(400).json({ success: false, message: '游戏已开始' });
    }
    
    // 使用传入的 playerId 或生成新的
    const playerId = reqPlayerId || uuidv4().substring(0, 8);
    
    // 检查玩家是否已存在
    const existingPlayer = room.players.find(p => p.id === playerId);
    if (existingPlayer) {
      return res.json({
        success: true,
        gameId: roomId,
        player: existingPlayer,
        players: room.players,
        message: '已在房间中'
      });
    }
    
    // 第一个加入的玩家自动成为房主
    const isFirstPlayer = room.players.length === 0;
    
    const player = {
      id: playerId,
      nickname: nickname || `玩家${Math.floor(Math.random() * 10000)}`,
      role: null, // 游戏开始时分配
      latitude: null,
      longitude: null,
      joinedAt: new Date().toISOString(),
      isOwner: isFirstPlayer || isOwner || false
    };
    
    // 如果是房主加入（第一个玩家或显式指定），设置 ownerId
    if (isFirstPlayer || isOwner) {
      room.ownerId = playerId;
      player.isOwner = true;
    }
    
    room.players.push(player);
    roomCache.set(roomId, room);
    
    // 通知房间内其他玩家
    io.to(`room_${roomId}`).emit('playerJoined', { player, players: room.players });
    
    console.log('[加入房间] roomId:', roomId, 'playerId:', playerId, 'isOwner:', isOwner);
    
    res.json({
      success: true,
      gameId: roomId,
      player,
      players: room.players,
      message: '加入成功'
    });
  } catch (error) {
    console.error('[加入房间失败]', error);
    res.status(500).json({ success: false, message: '加入失败' });
  }
});

// 获取房间信息
app.get('/api/game/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = roomCache.get(roomId);
  
  if (!room) {
    return res.status(404).json({ success: false, message: '房间不存在' });
  }
  
  res.json({
    success: true,
    ...room
  });
});

// 更新房间设置（房主专用）
app.put('/api/game/room/:roomId/settings', (req, res) => {
  try {
    const { roomId } = req.params;
    const { playerId, settings } = req.body;
    const room = roomCache.get(roomId);
    
    if (!room) {
      return res.status(404).json({ success: false, message: '房间不存在' });
    }
    
    // 验证房主权限
    if (room.ownerId && playerId && room.ownerId !== playerId) {
      return res.status(403).json({ success: false, message: '只有房主可以修改设置' });
    }
    
    if (room.status !== 'waiting') {
      return res.status(400).json({ success: false, message: '游戏已开始，无法修改设置' });
    }
    
    // 更新设置
    if (settings) {
      if (settings.catCount) room.settings.catCount = settings.catCount;
      if (settings.mouseCount) room.settings.mouseCount = settings.mouseCount;
      if (settings.gameDuration) room.settings.gameDuration = settings.gameDuration;
      if (settings.mapRange) room.settings.mapRange = settings.mapRange;
      if (settings.revealTime !== undefined) room.settings.revealTime = settings.revealTime;
      
      roomCache.set(roomId, room);
      
      // 通知房间内所有玩家设置已更新
      io.to(`room_${roomId}`).emit('settingsUpdated', { settings: room.settings });
      
      console.log('[更新房间设置] roomId:', roomId, 'settings:', room.settings);
    }
    
    res.json({
      success: true,
      settings: room.settings,
      message: '设置已更新'
    });
  } catch (error) {
    console.error('[更新房间设置失败]', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 开始游戏
app.post('/api/game/room/:roomId/start', (req, res) => {
  try {
    const { roomId } = req.params;
    const { playerId } = req.body;
    const room = roomCache.get(roomId);
    
    if (!room) {
      return res.status(404).json({ success: false, message: '房间不存在' });
    }
    
    // 验证房主权限
    if (room.ownerId && playerId && room.ownerId !== playerId) {
      return res.status(403).json({ success: false, message: '只有房主可以开始游戏' });
    }
    
    if (room.players.length < 1) {
      return res.status(400).json({ success: false, message: '至少需要 1 名玩家' });
    }
    
    // 按配置分配角色
    const { catCount, mouseCount } = room.settings;
    const shuffled = [...room.players].sort(() => Math.random() - 0.5);
    
    // 分配猫角色
    for (let i = 0; i < Math.min(catCount, shuffled.length); i++) {
      shuffled[i].role = 'cat';
      shuffled[i].items = { speed: 1, invisible: 0, radar: 0 }; // 猫初始 1 个加速
      shuffled[i].catchCount = 0;
    }
    
    // 分配鼠角色
    for (let i = catCount; i < catCount + Math.min(mouseCount, shuffled.length - catCount); i++) {
      shuffled[i].role = 'mouse';
      shuffled[i].items = { speed: 0, invisible: 0, radar: 1 }; // 老鼠初始 1 个雷达
      shuffled[i].isCaught = false;
    }
    
    room.status = 'playing';
    room.startTime = Date.now();
    room.endTime = room.startTime + room.settings.gameDuration * 1000;
    
    roomCache.set(roomId, room);
    
    // 初始化游戏状态
    gameCache.set(roomId, {
      status: 'playing',
      countdown: room.settings.gameDuration,
      events: [],
      winner: null
    });
    
    // 通知所有玩家游戏开始
    io.to(`room_${roomId}`).emit('gameStart', {
      players: room.players,
      startTime: room.startTime,
      endTime: room.endTime
    });
    
    console.log('[游戏开始] roomId:', roomId, '猫:', catCount, '鼠:', mouseCount);
    
    res.json({
      success: true,
      message: '游戏开始',
      players: room.players
    });
  } catch (error) {
    console.error('[开始游戏失败]', error);
    res.status(500).json({ success: false, message: '开始失败' });
  }
});

// ========== 游戏相关 ==========

// 获取游戏状态
app.get('/api/game/:gameId/status', (req, res) => {
  const { gameId } = req.params;
  const room = roomCache.get(gameId);
  
  if (!room) {
    return res.status(404).json({ success: false, message: '游戏不存在' });
  }
  
  const now = Date.now();
  const countdown = room.endTime ? Math.max(0, Math.floor((room.endTime - now) / 1000)) : 0;
  
  // 检查游戏是否结束
  if (room.status === 'playing' && countdown <= 0) {
    room.status = 'ended';
    roomCache.set(gameId, room);
  }
  
  res.json({
    success: true,
    status: room.status,
    playerRole: req.query.playerRole || null, // 实际应从 token 获取
    players: room.players,
    countdown,
    settings: room.settings
  });
});

// 计算两点距离（Haversine 公式）- 用于附近玩家检测
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半径（米）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// 更新位置
app.post('/api/game/:gameId/location', (req, res) => {
  try {
    const { gameId } = req.params;
    const { latitude, longitude, playerId } = req.body;
    const room = roomCache.get(gameId);
    
    if (!room) {
      return res.status(404).json({ success: false, message: '游戏不存在' });
    }
    
    if (room.status !== 'playing') {
      return res.status(400).json({ success: false, message: '游戏未进行中' });
    }
    
    // 更新玩家位置
    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.latitude = latitude;
      player.longitude = longitude;
      player.lastUpdate = Date.now();
      
      roomCache.set(gameId, room);
      
      // 广播位置更新给其他玩家（如果是隐身状态则不广播）
      if (!player.items || player.items.invisible <= 0) {
        io.to(`room_${gameId}`).emit('locationUpdate', {
          playerId,
          latitude,
          longitude
        });
      }
    }
    
    res.json({ success: true, message: '位置已更新' });
  } catch (error) {
    console.error('[更新位置失败]', error);
    res.status(500).json({ success: false, message: '更新失败' });
  }
});

// 扫码抓住老鼠（猫专用）
app.post('/api/game/:gameId/catch', (req, res) => {
  try {
    const { gameId } = req.params;
    const { catcherId, caughtId } = req.body; // 扫码后获取的信息
    const room = roomCache.get(gameId);
    
    if (!room) {
      return res.status(404).json({ success: false, message: '游戏不存在' });
    }
    
    if (room.status !== 'playing') {
      return res.status(400).json({ success: false, message: '游戏未进行中' });
    }
    
    // 验证猫的身份
    const cat = room.players.find(p => p.id === catcherId);
    if (!cat || cat.role !== 'cat') {
      return res.status(403).json({ success: false, message: '只有猫可以抓人' });
    }
    
    // 验证老鼠身份
    const mouse = room.players.find(p => p.id === caughtId);
    if (!mouse || mouse.role !== 'mouse') {
      return res.status(400).json({ success: false, message: '目标不是老鼠' });
    }
    
    // 检查是否已抓住
    if (mouse.isCaught) {
      return res.status(400).json({ success: false, message: '该老鼠已被抓住' });
    }
    
    // 检查距离（可选：限制扫码距离，如 5 米内）
    if (cat.latitude && cat.longitude && mouse.latitude && mouse.longitude) {
      const distance = calculateDistance(
        cat.latitude, cat.longitude,
        mouse.latitude, mouse.longitude
      );
      
      if (distance > 10) {
        return res.status(400).json({ 
          success: false, 
          message: '距离太远，无法抓住' 
        });
      }
    }
    
    // 更新抓住状态
    mouse.isCaught = true;
    cat.catchCount = (cat.catchCount || 0) + 1;
    roomCache.set(gameId, room);
    
    // 广播抓住事件
    io.to(`room_${gameId}`).emit('playerCaught', {
      catcherId: cat.id,
      catcherName: cat.nickname,
      caughtId: mouse.id,
      caughtName: mouse.nickname,
      catchCount: cat.catchCount
    });
    
    console.log(`[扫码抓住] ${cat.nickname} 抓住了 ${mouse.nickname}`);
    
    // 检查游戏是否结束（所有老鼠被抓住）
    const caughtMice = room.players.filter(p => p.role === 'mouse' && p.isCaught).length;
    const totalMice = room.players.filter(p => p.role === 'mouse').length;
    
    if (caughtMice === totalMice) {
      room.status = 'ended';
      room.winner = 'cat';
      room.endTime = Date.now();
      roomCache.set(gameId, room);
      
      io.to(`room_${gameId}`).emit('gameEnd', {
        status: 'ended',
        winner: 'cat',
        endTime: room.endTime
      });
      
      console.log('[游戏结束] 猫获胜！');
    }
    
    res.json({
      success: true,
      message: '抓住成功',
      catchCount: cat.catchCount,
      remaining: totalMice - caughtMice
    });
  } catch (error) {
    console.error('[扫码抓住失败]', error);
    res.status(500).json({ success: false, message: '抓住失败' });
  }
});

// 使用道具
app.post('/api/game/:gameId/item', (req, res) => {
  try {
    const { gameId } = req.params;
    const { itemId, targetId, playerId } = req.body;
    const room = roomCache.get(gameId);
    
    if (!room) {
      return res.status(404).json({ success: false, message: '游戏不存在' });
    }
    
    if (room.status !== 'playing') {
      return res.status(400).json({ success: false, message: '游戏未进行中' });
    }
    
    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return res.status(404).json({ success: false, message: '玩家不存在' });
    }
    
    // 检查道具数量
    if (!player.items || player.items[itemId] <= 0) {
      return res.status(400).json({ success: false, message: '道具不足' });
    }
    
    let effect = null;
    
    switch (itemId) {
      case 'speed': // 加速 - 30 秒内移动速度提升
        player.items.speed--;
        effect = { type: 'speed', duration: 30, target: playerId };
        io.to(`room_${gameId}`).emit('itemUsed', {
          playerId,
          itemId,
          effect
        });
        break;
        
      case 'invisible': // 隐身 - 15 秒内对其他玩家隐藏
        player.items.invisible--;
        effect = { type: 'invisible', duration: 15, target: playerId };
        io.to(`room_${gameId}`).emit('itemUsed', {
          playerId,
          itemId,
          effect
        });
        break;
        
      case 'radar': // 雷达 - 显示所有玩家位置
        player.items.radar--;
        const otherPlayers = room.players
          .filter(p => p.id !== playerId && p.latitude && p.longitude)
          .map(p => ({
            id: p.id,
            nickname: p.nickname,
            role: p.role,
            latitude: p.latitude,
            longitude: p.longitude
          }));
        effect = { type: 'radar', players: otherPlayers };
        res.json({
          success: true,
          message: '道具使用成功',
          itemId,
          effect
        });
        return;
        
      default:
        return res.status(400).json({ success: false, message: '未知道具' });
    }
    
    console.log('[使用道具]', playerId, '使用了', itemId);
    
    res.json({
      success: true,
      message: '道具使用成功',
      itemId,
      effect
    });
  } catch (error) {
    console.error('[使用道具失败]', error);
    res.status(500).json({ success: false, message: '使用失败' });
  }
});

// 结束游戏
app.post('/api/game/:gameId/end', (req, res) => {
  try {
    const { gameId } = req.params;
    const { winner } = req.body; // 'cat' or 'mouse'
    const room = roomCache.get(gameId);
    
    if (!room) {
      return res.status(404).json({ success: false, message: '游戏不存在' });
    }
    
    room.status = 'ended';
    room.endTime = Date.now();
    room.winner = winner;
    roomCache.set(gameId, room);
    
    // 通知所有玩家游戏结束
    io.to(`room_${gameId}`).emit('gameEnd', {
      status: 'ended',
      endTime: room.endTime,
      winner
    });
    
    console.log('[游戏结束] roomId:', gameId, '获胜者:', winner);
    
    res.json({
      success: true,
      message: '游戏已结束',
      result: { winner, endTime: room.endTime }
    });
  } catch (error) {
    console.error('[结束游戏失败]', error);
    res.status(500).json({ success: false, message: '结束失败' });
  }
});

// 获取游戏历史
app.get('/api/game/history/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const history = [];
    
    // 遍历所有房间查找该用户参与的游戏
    roomCache.keys().forEach(key => {
      const room = roomCache.get(key);
      if (room && room.status === 'ended') {
        const player = room.players.find(p => p.id === userId);
        if (player) {
          history.push({
            gameId: room.id,
            roomId: room.id,
            role: player.role,
            result: room.winner === player.role ? 'win' : 'lose',
            winner: room.winner,
            endedAt: room.endTime,
            settings: room.settings,
            catchCount: player.catchCount || 0,
            isCaught: player.isCaught || false
          });
        }
      }
    });
    
    // 按结束时间倒序排列
    history.sort((a, b) => b.endedAt - a.endedAt);
    
    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('[获取历史失败]', error);
    res.status(500).json({ success: false, message: '获取失败' });
  }
});

// ========== HTTPS 配置 ==========
const fs = require('fs');
const https = require('https');

// SSL 证书路径（复用 campus-link.fit 证书）
const SSL_OPTIONS = {
  key: fs.readFileSync('/home/admin/.acme.sh/campus-link.fit_ecc/campus-link.fit.key'),
  cert: fs.readFileSync('/home/admin/.acme.sh/campus-link.fit_ecc/campus-link.fit.cer'),
  ca: fs.readFileSync('/home/admin/.acme.sh/campus-link.fit_ecc/ca.cer')
};

// 创建 HTTPS 服务器
const httpsServer = https.createServer(SSL_OPTIONS, app);
const io = new Server(httpsServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// 创建 HTTP 服务器（开发用）
const httpServer = http.createServer(app);

// ========== WebSocket 连接 ==========
io.on('connection', (socket) => {
  console.log('[WebSocket] 用户连接:', socket.id);
  
  // 加入房间频道
  socket.on('joinRoom', (roomId) => {
    socket.join(`room_${roomId}`);
    console.log(`[WebSocket] 用户 ${socket.id} 加入房间 ${roomId}`);
  });
  
  // 离开房间
  socket.on('leaveRoom', (roomId) => {
    socket.leave(`room_${roomId}`);
    console.log(`[WebSocket] 用户 ${socket.id} 离开房间 ${roomId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('[WebSocket] 用户断开:', socket.id);
  });
});

// 启动服务器
const PORT = process.env.PORT || 4000;
const HTTP_PORT = process.env.HTTP_PORT || 4001;

// HTTPS 服务器（生产用）
httpsServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🐱🐭 猫鼠游戏 HTTPS 服务器启动在端口 ${PORT}`);
  console.log(`🔒 HTTPS 地址：https://campus-link.fit:${PORT}`);
});

// HTTP 服务器（开发测试用）
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`🐱🐭 猫鼠游戏 HTTP 服务器启动在端口 ${HTTP_PORT}`);
  console.log(`⚠️ HTTP 地址：http://118.178.85.214:${HTTP_PORT}`);
});
