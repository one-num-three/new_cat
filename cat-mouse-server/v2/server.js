const express = require('express');
const http = require('node:http');
const crypto = require('node:crypto');
const { WebSocketServer } = require('ws');
const { Store, isUuid } = require('./store');
const { Service } = require('./service');
const maps=require('./map-catalog'),qr=require('../shared/qr-protocol');
const tracks=require('./tracks');
async function createServer(options = {}) {
  const env = options.env || process.env;
  if (env.NODE_ENV === 'production' && !env.DATABASE_URL) throw new Error('DATABASE_URL_REQUIRED');
  const localTest = env.NODE_ENV === 'test' && env.ENABLE_LOCAL_TEST_IDENTITIES === 'true';
  if (localTest && env.HOST && !['127.0.0.1','localhost','::1'].includes(env.HOST)) throw new Error('LOCAL_TEST_MUST_BIND_LOOPBACK');
  const store = new Store({ url: env.DATABASE_URL, dataDir: env.DATA_DIR || './data' }); await store.init();
  const service = new Service(store, { localTest, now: options.now }); await service.recover();await tracks.purge(store,service.now());await store.purgeExpired(service.now());
  const app = express(); app.disable('x-powered-by'); app.set('trust proxy', 'loopback'); app.use(express.json({ limit: '16kb' }));
  app.use((req,res,next)=>{req.requestId=crypto.randomUUID();res.set('X-Request-Id',req.requestId);if(req.path.startsWith('/api/')){res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');}const started=Date.now();res.on('finish',()=>{if(env.NODE_ENV==='test' || res.statusCode<400 && (req.method==='GET' || req.path.endsWith('/location')))return;console.log(JSON.stringify({requestId:req.requestId,method:req.method,path:req.path,status:res.statusCode,elapsedMs:Date.now()-started}));});next();});
  const buckets=new Map(),inviteQrCache=new Map();
  const rateLimit=(key,limit,windowMs)=>{const now=service.now(),b=buckets.get(key);if(!b||now>=b.resetAt){buckets.set(key,{count:1,resetAt:now+windowMs});return;}if(++b.count>limit){const e=new Error('RATE_LIMITED');e.code='RATE_LIMITED';throw e;}};
  app.get('/health', (_, res) => res.json({ ok: true }));
  app.get('/ready', async (_, res) => { try { await store.query('SELECT 1'); res.json({ ready: true }); } catch { res.status(503).json({ ready: false }); } });
  app.get('/api/version', (_, res) => res.json({ version:'0.6.1',rulesVersion:'pilot-0.3',supportedRuleVersions:['pilot-0.2','pilot-0.3'],capabilities:{nativeMapVenues:true,mapCalibration:true,customTeams:true,multiVenueMaps:true,polygonVenues:true,mapCatalog:true,roomInvites:true,createCommands:true,captureProtocol:'capture-v1',lateJoin:'reinforce-v2',dynamicCaptureTarget:'joined-mice-60-v1',roundReadiness:'fresh-v1',snapshotViewer:true,matchBoundLocation:true,mouseTeamVision:'vision-share-v1',trackExport:'tracks-v1',trackHighlights:'track-highlights-v1'} }));
  app.get('/api/v2/maps',(_,res)=>res.json(maps.list()));
  const route = fn => async (req, res) => { try { res.json(await fn(req)); } catch (e) { const raw = e.code || e.message || 'INTERNAL',code=/^[A-Z0-9_]+$/.test(raw)?raw:'INTERNAL'; if(code==='INTERNAL'&&env.NODE_ENV!=='test')console.error(JSON.stringify({requestId:req.requestId,error:e?.code||e?.name||'Error',message:String(e?.message||'').slice(0,160)})); res.status(code === 'UNAUTHENTICATED' ? 401 : code === 'FORBIDDEN' || code === 'NOT_MEMBER' ? 403 : code === 'RATE_LIMITED' ? 429 : code === 'INTERNAL' ? 500 : 400).json({ error: code }); } };
  const auth = async req => { const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1]; const id = await store.session(token); if (!id) { const e = new Error('UNAUTHENTICATED'); e.code = 'UNAUTHENTICATED'; throw e; } service.touch(id); return id; };
  app.post('/api/v2/session/test', route(async req => { if (!localTest) throw new Error('FORBIDDEN'); return store.createSession(); }));
  app.post('/api/v2/session/wechat', route(async req => {
    rateLimit('wx:' + (req.ip || 'unknown'), 20, 60000);
    if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET || typeof req.body?.code !== 'string' || !/^[A-Za-z0-9_-]{4,128}$/.test(req.body.code)) throw new Error('LOGIN_UNAVAILABLE');
    const q = new URLSearchParams({ appid: env.WECHAT_APP_ID, secret: env.WECHAT_APP_SECRET, js_code: req.body.code, grant_type: 'authorization_code' });
    const r = await fetch('https://api.weixin.qq.com/sns/jscode2session?' + q, { signal: AbortSignal.timeout(5000) });
    const data = await r.json(); if (!r.ok || !data.openid || data.errcode) throw new Error('LOGIN_FAILED');
    // One persisted internal identity per openid, never derived from the display nickname.
    const h = env.IDENTITY_HMAC_SECRET
      ? crypto.createHmac('sha256', env.IDENTITY_HMAC_SECRET).update(env.WECHAT_APP_ID + ':' + data.openid).digest('hex')
      : crypto.createHash('sha256').update(env.WECHAT_APP_ID + ':' + data.openid).digest('hex');
    return store.createSession(`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`);
  }));
  app.post('/api/v2/session/logout', route(async req => {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    if (token) await store.deleteSession(token);
    return { loggedOut: true };
  }));
  app.post('/api/v2/rooms', route(async req => { const actor = await auth(req); rateLimit('create:' + actor, 15, 60000); return service.create(actor, req.body); }));
  app.post('/api/v2/rooms/:id/join', route(async req => service.join(req.params.id, await auth(req), req.body?.nickname)));
  app.get('/api/v2/rooms/:id', route(async req => service.read(req.params.id, await auth(req))));
  app.get('/api/v2/rooms/:id/invite',route(async req=>{
    const actor=await auth(req);rateLimit('invite:'+actor,30,60000);
    const s=await service.read(req.params.id,actor);
    let b64=inviteQrCache.get(s.code);
    if(!b64){const png=await require('qrcode').toBuffer(JSON.stringify(qr.invite(s.code)),{type:'png',margin:3,width:360});b64=png.toString('base64');if(inviteQrCache.size>=128)inviteQrCache.delete(inviteQrCache.keys().next().value);inviteQrCache.set(s.code,b64);}
    const live=s.match&&!['FINISHED','CANCELLED'].includes(s.match.phase),availableSlots=Math.max(0,(live?60:s.rules.total)-s.roster.length);
    return {roomId:s.roomId,code:s.code,path:'/pages/index/index?roomCode='+s.code,qrPngBase64:b64,scanInsideApp:true,availableSlots,canNewPlayerJoin:availableSlots>0,lateJoin:!!live,joinPolicy:s.match?.joinPolicy||'reinforce-v2'};
  }));
  app.put('/api/v2/rooms/:id/calibration',route(async req=>service.calibrate(req.params.id,await auth(req),req.body)));
  app.put('/api/v2/rooms/:id/venue',route(async req=>service.setVenue(req.params.id,await auth(req),req.body)));
  app.put('/api/v2/rooms/:id/settings',route(async req=>service.setSettings(req.params.id,await auth(req),req.body)));
  app.get('/api/v2/matches/:id/tracks',route(async req=>service.exportTracks(req.params.id,await auth(req),req.query.scope||'self')));
  app.post('/api/v2/rooms/:id/location', route(async req => service.location(req.params.id, await auth(req), req.body)));
  app.post('/api/v2/rooms/:id/ready', route(async req => service.ready(req.params.id, await auth(req), req.body?.ready)));
  app.post('/api/v2/rooms/:id/start', route(async req => service.start(req.params.id, await auth(req))));
  app.post('/api/v2/rooms/:id/token', route(async req => {
    const actor = await auth(req); rateLimit('token:' + actor, 30, 60000);
    const data = await service.token(req.params.id, actor);
    const png = await require('qrcode').toBuffer(JSON.stringify(qr.capture(data)), { type: 'png', margin: 3, width: 360 });
    return { ...data,serverTime:service.now(),qrPngBase64: png.toString('base64') };
  }));
  app.post('/api/v2/rooms/:id/capture', route(async req => service.capture(req.params.id, await auth(req), req.body)));
  app.post('/api/v2/rooms/:id/pause', route(async req => service.pause(req.params.id, await auth(req), req.body?.reason)));
  app.post('/api/v2/rooms/:id/resume', route(async req => service.resume(req.params.id, await auth(req))));
  app.post('/api/v2/rooms/:id/cancel', route(async req => service.cancel(req.params.id, await auth(req))));
  app.post('/api/v2/rooms/:id/kick', route(async req => service.kick(req.params.id, await auth(req), req.body?.playerId)));
  app.post('/api/v2/rooms/:id/leave', route(async req => service.leave(req.params.id, await auth(req))));
  app.get('/api/v2/matches/:id/result', route(async req => {
    const actor=await auth(req);
    if(!isUuid(req.params.id))throw Error('RESULT_NOT_FOUND');
    const r=await store.query('SELECT room_id,result FROM match_results WHERE match_id=$1',[req.params.id]);
    if(!r.rows[0]) throw Error('RESULT_NOT_FOUND');
    if(!r.rows[0].result?.participants?.some(p=>p.id===actor)) throw Error('FORBIDDEN');
    return r.rows[0].result;
  }));
  app.use((req,res)=>res.status(404).json({error:'NOT_FOUND'}));
  const server = http.createServer(app), wss = new WebSocketServer({ noServer: true, maxPayload: 1024 });
  server.on('upgrade', async (req, socket, head) => {
    try {
      const origin = req.headers.origin;
      if (origin && !/^https:\/\/servicewechat\.com(?:\/|$)|^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$|^https:\/\/seu-link\.fit(?::\d+)?$/i.test(origin)) throw Error();
      const url = new URL(req.url, 'http://localhost'); if (url.pathname !== '/api/v2/live') throw Error();
      const token=/^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
      const actor = await store.session(token), roomId = url.searchParams.get('room');
      if (!actor || !roomId) throw Error();
      const existing = [...wss.clients].filter(c => c.actor === actor && c.readyState === 1);
      while (existing.length >= 3) { try { existing.shift().close(1008, 'too many connections'); } catch {} }
      await service.read(roomId, actor);
      wss.handleUpgrade(req, socket, head, ws => { ws.actor = actor; ws.roomId = roomId; ws.token=token; wss.emit('connection', ws); });
    } catch { socket.destroy(); }
  });
  wss.on('connection', ws => { service.touch(ws.actor); ws.on('message', raw => { if(raw.length<=16&&raw.toString()==='PING'){service.touch(ws.actor);ws.send('PONG');} }); ws.send(JSON.stringify({ type: 'CONNECTED' })); });
  let pushing=false;
  const timer = setInterval(async () => {
    if(pushing)return;pushing=true;
    try {
      const byRoom=new Map();
      for (const ws of wss.clients) {
        if (ws.readyState !== 1) continue;
        if (ws.bufferedAmount > 65536) { ws.close(1013, 'snapshot required'); continue; }
        try {
          if(await store.session(ws.token)!==ws.actor){ws.close(1008,'session expired');continue;}
          if(!byRoom.has(ws.roomId))byRoom.set(ws.roomId,[]);
          byRoom.get(ws.roomId).push(ws);
        } catch { ws.close(); }
      }
      for (const [roomId, clients] of byRoom) {
        try {
          let room = await store.room(roomId, store.db, false);
          if (!room) { for (const ws of clients) ws.close(); continue; }
          if (service.needsTick(room)) await service.mutate(roomId, clients[0].actor, r => { room = r; return null; });
          for (const ws of clients) {
            try {
              if (!room.state.members.some(p => p.id === ws.actor)) { ws.close(); continue; }
              ws.send(JSON.stringify({ type: 'SNAPSHOT', payload: service.view(room, ws.actor) }));
            } catch { ws.close(); }
          }
        } catch { for (const ws of clients) ws.close(); }
      }
    } finally { pushing=false; }
  }, 1000); timer.unref();
  let ticking = false,lastTrackPurge=service.now();
  const clock = setInterval(async () => {
    if (ticking) return; ticking = true;
    try {
      const rows = await store.query("SELECT id,owner_id FROM rooms WHERE state->'match' IS NOT NULL AND state->'match'->>'phase' NOT IN ('FINISHED','CANCELLED')");
      for (const room of rows.rows) await service.advanceRoom(room.id, room.owner_id);
      const now = service.now();
      for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
      if(now-lastTrackPurge>=3600000){await tracks.purge(store,now);await store.purgeExpired(now);service.pruneMemory();lastTrackPurge=now;}
    }
    catch (e) { console.error('clock error', e.code || e.message); }
    finally { ticking = false; }
  }, 1000); clock.unref();
  return { app, server, store, service, close: async () => { clearInterval(timer); clearInterval(clock); for (const ws of wss.clients) ws.terminate(); await new Promise(resolve => server.close(resolve)); await store.close(); } };
}
if (require.main === module) createServer().then(({ server }) => server.listen(process.env.PORT || 4000, process.env.HOST || '127.0.0.1', () => console.log('cat-mouse v2 ready'))).catch(e => { console.error('startup failed', e.code || (/^[A-Z_]+$/.test(e.message)?e.message:'INTERNAL')); process.exitCode = 1; });
module.exports = { createServer };
