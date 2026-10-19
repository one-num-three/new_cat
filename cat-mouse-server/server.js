// /home/transplanted/cat-mouse-server/server.js
if (process.env.NODE_ENV === 'production') {
  throw new Error('Legacy server is disabled in production. Use npm start (v2/server.js).');
}
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');
const fs = require('fs');
const path = require('path');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 轻量健康检查：部署平台可用它判断容器是否已就绪
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'cat-mouse-server', time: new Date().toISOString() });
});

// 任务点/题库是实验功能，发布版默认关闭，避免把非核心资源带入最小镜像。
const ENABLE_TASKS = process.env.ENABLE_TASKS === 'true';
let questionBank = null;
if (ENABLE_TASKS) {
  try {
    const questionPath = path.join(__dirname, '趣味问题数据库.json');
    const questionData = fs.readFileSync(questionPath, 'utf-8');
    questionBank = JSON.parse(questionData);
    console.log('[题库] 加载成功，共', questionBank.questions.length, '道题目');
  } catch (err) {
    console.error('[题库] 加载失败:', err);
  }
}

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

    const maxPlayers = (room.settings.catCount || 1) + (room.settings.mouseCount || 5);
    if (room.players.length >= maxPlayers) {
      return res.status(400).json({ success: false, message: '房间人数已满' });
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
    
    // 获取谜底模式：默认'different'（不同谜底）
    const riddleMode = room.settings.riddleMode || 'different';
    
    // 如果是统一谜底，先生成一个
    let sharedRiddle = null;
    if (riddleMode === 'same') {
      sharedRiddle = generateRiddle();
      console.log('[谜底] 统一模式，共享谜底:', sharedRiddle);
    }
    
    // 分配猫角色
    for (let i = 0; i < Math.min(catCount, shuffled.length); i++) {
      shuffled[i].role = 'cat';
      // MVP 只保留一次性隐身，避免前端展示尚未接通的技能
      shuffled[i].items = { invisible: 0, invisibleCount: 1 };
      shuffled[i].score = 20;
      shuffled[i].catchCount = 0;
      // 分配谜底
      shuffled[i].taskRiddle = riddleMode === 'same' ? sharedRiddle : generateRiddle();
    }
    
    // 分配鼠角色
    for (let i = catCount; i < catCount + Math.min(mouseCount, shuffled.length - catCount); i++) {
      shuffled[i].role = 'mouse';
      shuffled[i].items = { invisible: 0, invisibleCount: 1 };
      shuffled[i].score = 0;
      shuffled[i].isCaught = false;
      // 分配谜底
      shuffled[i].taskRiddle = riddleMode === 'same' ? sharedRiddle : generateRiddle();
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
    
    console.log('[游戏开始] roomId:', roomId, '猫:', catCount, '鼠:', mouseCount, '谜底模式:', riddleMode);
    
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

// 生成4位不重复数字谜底
function generateRiddle() {
  const digits = [];
  while (digits.length < 4) {
    const digit = Math.floor(Math.random() * 10);
    if (!digits.includes(digit)) {
      digits.push(digit);
    }
  }
  return digits.join('');
}

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
    room.winner = 'mouse';
    room.winReason = 'time_up';
    room.endTime = room.endTime || now;
    roomCache.set(gameId, room);
    io.to(`room_${gameId}`).emit('gameEnd', {
      status: 'ended',
      winner: room.winner,
      winReason: room.winReason,
      endTime: room.endTime
    });
  }
  
  // 更新任务点状态
  const taskPoint = updateTaskPoint(room);
  const game = gameCache.get(gameId) || {};
  if (taskPoint !== room.taskPoint) {
    roomCache.set(gameId, room);
  }
  
  res.json({
    success: true,
    status: room.status,
    playerRole: req.query.playerRole || null, // 实际应从 token 获取
    players: room.players,
    // 兼容前端状态页：没有独立持久化层时直接返回房间快照
    allPlayers: room.players,
    events: game.events || [],
    goldenShields: room.goldenShields || [],
    bombardZones: room.bombardZones || [],
    winReason: room.winReason || null,
    countdown,
    settings: room.settings,
    taskPoint: taskPoint
  });
});

// 重新加入：保留原玩家身份和积分，适用于短暂掉线后的恢复
app.post('/api/game/room/:roomId/rejoin', (req, res) => {
  try {
    const { roomId } = req.params;
    const { playerId } = req.body;
    const room = roomCache.get(roomId);
    if (!room) return res.status(404).json({ success: false, message: '房间不存在' });
    const player = room.players.find(p => p.id === playerId);
    if (!player) return res.status(404).json({ success: false, message: '玩家不存在' });

    player.isOffline = false;
    player.lastUpdate = Date.now();
    roomCache.set(roomId, room);
    io.to(`room_${roomId}`).emit('playerRejoined', { player, players: room.players });
    res.json({ success: true, player, players: room.players });
  } catch (error) {
    console.error('[重新加入失败]', error);
    res.status(500).json({ success: false, message: '重新加入失败' });
  }
});

// 主动离开/标记掉线：不删除玩家数据，便于短暂断线后恢复
app.post('/api/game/:gameId/leave', (req, res) => {
  try {
    const { gameId } = req.params;
    const { playerId } = req.body;
    const room = roomCache.get(gameId);
    if (!room) return res.status(404).json({ success: false, message: '游戏不存在' });
    const player = room.players.find(p => p.id === playerId);
    if (!player) return res.status(404).json({ success: false, message: '玩家不存在' });

    player.isOffline = true;
    player.lastUpdate = Date.now();
    roomCache.set(gameId, room);
    io.to(`room_${gameId}`).emit('playerLeft', { playerId, players: room.players });
    res.json({ success: true, message: '已离开游戏' });
  } catch (error) {
    console.error('[离开游戏失败]', error);
    res.status(500).json({ success: false, message: '离开失败' });
  }
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
      room.winReason = 'all_mice_caught';
      room.endTime = Date.now();
      roomCache.set(gameId, room);
      
      io.to(`room_${gameId}`).emit('gameEnd', {
        status: 'ended',
        winner: 'cat',
        winReason: room.winReason,
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
    
    // 检查道具数量（MVP 仅支持一次性隐身）
    if (itemId !== 'invisible' || !player.items || (player.items.invisibleCount || 0) <= 0) {
      return res.status(400).json({ success: false, message: '道具不足' });
    }

    const itemPrice = 15;
    if ((player.score || 0) < itemPrice) {
      return res.status(400).json({ success: false, message: '积分不足' });
    }
    player.score -= itemPrice;
    
    let effect = null;
    
    switch (itemId) {
      case 'invisible': // 隐身 - 15 秒内对其他玩家隐藏
        player.items.invisibleCount--;
        player.items.invisible = Date.now() + 15 * 1000;
        effect = { type: 'invisible', duration: 15, target: playerId };
        io.to(`room_${gameId}`).emit('itemUsed', {
          playerId,
          itemId,
          effect
        });
        break;
        
      default:
        return res.status(400).json({ success: false, message: '未知道具' });
    }
    
    console.log('[使用道具]', playerId, '使用了', itemId);
    
    res.json({
      success: true,
      message: '道具使用成功',
      itemId,
      effect,
      remainingScore: player.score
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
    room.winner = winner === 'cat' ? 'cat' : 'mouse';
    room.winReason = 'manual';
    roomCache.set(gameId, room);
    
    // 通知所有玩家游戏结束
    io.to(`room_${gameId}`).emit('gameEnd', {
      status: 'ended',
      endTime: room.endTime,
      winner: room.winner,
      winReason: room.winReason
    });
    
    console.log('[游戏结束] roomId:', gameId, '获胜者:', winner);
    
    res.json({
      success: true,
      message: '游戏已结束',
      result: { winner: room.winner, endTime: room.endTime }
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

// ========== 任务系统 ==========

// 获取玩家的任务谜底
app.get('/api/game/:gameId/task/riddle/:playerId', (req, res) => {
  try {
    if (!ENABLE_TASKS) {
      return res.status(404).json({ success: false, message: '任务功能未启用' });
    }
    const { gameId, playerId } = req.params;
    const room = roomCache.get(gameId);
    
    if (!room) {
      return res.status(404).json({ success: false, message: '游戏不存在' });
    }
    
    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return res.status(404).json({ success: false, message: '玩家不存在' });
    }
    
    // 返回玩家的谜底（游戏开始时已分配）
    if (player.taskRiddle) {
      return res.json({
        success: true,
        riddle: player.taskRiddle
      });
    }
    
    // 如果没有谜底（游戏未开始或其他情况），生成一个临时的
    const riddle = generateRiddle();
    player.taskRiddle = riddle;
    roomCache.set(gameId, room);
    
    res.json({
      success: true,
      riddle: riddle
    });
  } catch (error) {
    console.error('[获取谜底失败]', error);
    res.status(500).json({ success: false, message: '获取谜底失败' });
  }
});

// 获取趣味问答题目
app.get('/api/game/:gameId/task/quiz/:playerId', (req, res) => {
  try {
    if (!ENABLE_TASKS) {
      return res.status(404).json({ success: false, message: '任务功能未启用' });
    }
    const { gameId, playerId } = req.params;
    const room = roomCache.get(gameId);
    
    if (!room) {
      return res.status(404).json({ success: false, message: '游戏不存在' });
    }
    
    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return res.status(404).json({ success: false, message: '玩家不存在' });
    }
    
    // 检查题库是否加载
    if (!questionBank || !questionBank.questions) {
      return res.status(500).json({ success: false, message: '题库未加载' });
    }
    
    // 如果玩家已有题目，返回已有的（保证同一局游戏题目不变）
    if (player.quizQuestions && player.quizQuestions.length === 5) {
      return res.json({
        success: true,
        questions: player.quizQuestions
      });
    }
    
    // 随机选择5道不同的题目
    const allQuestions = questionBank.questions;
    const selectedQuestions = [];
    const usedIndices = new Set();
    
    while (selectedQuestions.length < 5 && selectedQuestions.length < allQuestions.length) {
      const randomIndex = Math.floor(Math.random() * allQuestions.length);
      if (!usedIndices.has(randomIndex)) {
        usedIndices.add(randomIndex);
        const q = allQuestions[randomIndex];
        // 不返回正确答案给前端
        selectedQuestions.push({
          id: q.id,
          category: q.category,
          categoryName: q.categoryName,
          categoryIcon: q.categoryIcon,
          question: q.question,
          options: q.options,
          answer: q.answer, // 前端需要知道答案来判断对错
          explanation: q.explanation
        });
      }
    }
    
    // 保存到玩家数据
    player.quizQuestions = selectedQuestions;
    roomCache.set(gameId, room);
    
    console.log('[问答] 为玩家', playerId, '生成5道题目');
    
    res.json({
      success: true,
      questions: selectedQuestions
    });
  } catch (error) {
    console.error('[获取题目失败]', error);
    res.status(500).json({ success: false, message: '获取题目失败' });
  }
});

// 生成任务点
function generateTaskPoint(room) {
  const now = Date.now();
  const players = room.players.filter(p => !p.isOffline);
  
  // 计算所有在线玩家的几何中心
  const activePlayers = players.filter(p => p.latitude && p.longitude);
  if (activePlayers.length === 0) return null;
  
  const sumLat = activePlayers.reduce((sum, p) => sum + p.latitude, 0);
  const sumLng = activePlayers.reduce((sum, p) => sum + p.longitude, 0);
  const centerLat = sumLat / activePlayers.length;
  const centerLng = sumLng / activePlayers.length;
  
  // 计算猫和鼠的数量
  const catCount = players.filter(p => p.role === 'cat').length;
  const mouseCount = players.filter(p => p.role === 'mouse' && !p.isCaught).length;
  
  // 计算领取名额：猫50%最少1个，鼠30%最少1个
  const catSlots = Math.max(1, Math.ceil(catCount * 0.5));
  const mouseSlots = Math.max(1, Math.ceil(mouseCount * 0.3));
  
  // 随机选择任务类型：'guessNumber' 或 'quiz'
  const taskTypes = ['guessNumber', 'quiz'];
  const taskType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
  
  return {
    id: `task_${now}`,
    center: { latitude: centerLat, longitude: centerLng },
    radius: 25,
    status: 'active',
    createdAt: now,
    expiresAt: now + 3 * 60 * 1000, // 3分钟后消失
    taskType: taskType, // 任务类型
    reward: taskType === 'guessNumber' ? 50 : 50, // 基础奖励
    // 领取名额
    catSlots: catSlots,
    mouseSlots: mouseSlots,
    // 已领取记录
    catClaimed: 0,
    mouseClaimed: 0,
    claimedBy: [] // 记录谁已领取，防止重复
  };
}

// 获取游戏状态时更新任务点
function updateTaskPoint(room) {
  if (!ENABLE_TASKS) return null;
  const now = Date.now();
  
  // 如果没有任务点，开局10秒后生成
  if (!room.taskPoint && room.startTime && now - room.startTime > 10000) {
    room.taskPoint = generateTaskPoint(room);
    if (room.taskPoint) {
      console.log('[任务点] 生成:', room.taskPoint.id);
    }
  }
  
  // 检查任务点是否过期或两边都领完
  if (room.taskPoint && room.taskPoint.status === 'active') {
    const task = room.taskPoint;
    const expired = now >= task.expiresAt;
    const catFull = task.catClaimed >= task.catSlots;
    const mouseFull = task.mouseClaimed >= task.mouseSlots;
    
    if (expired) {
      console.log('[任务点] 过期消失:', task.id);
      room.taskPoint = null;
    } else if (catFull && mouseFull) {
      console.log('[任务点] 全部领完消失:', task.id);
      room.taskPoint = null;
    }
  }
  
  return room.taskPoint;
}

// 完成任务（猜数字游戏）
app.post('/api/game/:gameId/task/complete', (req, res) => {
  try {
    if (!ENABLE_TASKS) {
      return res.status(404).json({ success: false, message: '任务功能未启用' });
    }
    const { gameId } = req.params;
    const { playerId, taskType, attempts, timeUsed, reward } = req.body;
    const room = roomCache.get(gameId);
    
    if (!room) {
      return res.status(404).json({ success: false, message: '游戏不存在' });
    }
    
    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return res.status(404).json({ success: false, message: '玩家不存在' });
    }
    
    // 检查任务点是否存在
    const task = room.taskPoint;
    if (!task || task.status !== 'active') {
      return res.status(400).json({ success: false, message: '任务点已消失' });
    }
    
    // 检查是否已领取过
    if (task.claimedBy && task.claimedBy.includes(playerId)) {
      return res.status(400).json({ success: false, message: '你已经领取过了' });
    }
    
    // 检查名额
    if (player.role === 'cat') {
      if (task.catClaimed >= task.catSlots) {
        return res.status(400).json({ success: false, message: '猫的领取名额已用完' });
      }
    } else {
      if (task.mouseClaimed >= task.mouseSlots) {
        return res.status(400).json({ success: false, message: '鼠的领取名额已用完' });
      }
    }
    
    // 计算奖励积分
    let taskReward = reward || 50;
    if (taskType === 'guessNumber') {
      if (attempts <= 5) {
        taskReward = 100;
      } else if (attempts <= 10) {
        taskReward = 75;
      } else {
        taskReward = 50;
      }
    }
    
    // 更新领取记录
    task.claimedBy = task.claimedBy || [];
    task.claimedBy.push(playerId);
    
    if (player.role === 'cat') {
      task.catClaimed++;
    } else {
      task.mouseClaimed++;
    }
    
    // 增加玩家积分
    player.score = (player.score || 0) + taskReward;
    roomCache.set(gameId, room);
    
    console.log(`[任务完成] ${player.nickname}(${player.role}) 领取奖励，剩余名额 猫:${task.catSlots - task.catClaimed} 鼠:${task.mouseSlots - task.mouseClaimed}`);
    
    // 广播任务完成事件
    io.to(`room_${gameId}`).emit('taskCompleted', {
      playerId,
      playerName: player.nickname,
      playerRole: player.role,
      taskType,
      reward: taskReward,
      // 剩余名额
      catRemaining: task.catSlots - task.catClaimed,
      mouseRemaining: task.mouseSlots - task.mouseClaimed
    });
    
    res.json({
      success: true,
      message: '任务完成',
      reward: taskReward,
      remainingScore: player.score,
      // 返回剩余名额
      catRemaining: task.catSlots - task.catClaimed,
      mouseRemaining: task.mouseSlots - task.mouseClaimed
    });
  } catch (error) {
    console.error('[任务完成失败]', error);
    res.status(500).json({ success: false, message: '任务完成失败' });
  }
});

// ========== 服务启动配置 ==========
// 云托管/容器平台通常在入口网关终止 HTTPS，因此应用默认只监听 HTTP。
// 只有显式提供三份证书路径时，才在进程内启用 HTTPS。
const https = require('https');
const sslPaths = {
  key: process.env.SSL_KEY_PATH,
  cert: process.env.SSL_CERT_PATH,
  ca: process.env.SSL_CA_PATH
};
const useHttps = Boolean(
  sslPaths.key && sslPaths.cert && sslPaths.ca &&
  fs.existsSync(sslPaths.key) && fs.existsSync(sslPaths.cert) && fs.existsSync(sslPaths.ca)
);

const primaryServer = useHttps
  ? https.createServer({
      key: fs.readFileSync(sslPaths.key),
      cert: fs.readFileSync(sslPaths.cert),
      ca: fs.readFileSync(sslPaths.ca)
    }, app)
  : http.createServer(app);

const io = new Server(primaryServer, {
  cors: { origin: process.env.CORS_ORIGIN || '*', methods: ['GET', 'POST', 'PUT'] }
});

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
const PORT = Number(process.env.PORT || 4000);

primaryServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🐱🐭 猫鼠游戏服务器已启动：${useHttps ? 'HTTPS' : 'HTTP'} ${PORT}`);
});
