const express = require('express');
const http = require('node:http');
const crypto = require('node:crypto');
const { WebSocketServer } = require('ws');
const { Store } = require('./store');
const { Service } = require('./service');
async function createServer(options = {}) {
  const env = options.env || process.env;
  if (env.NODE_ENV === 'production' && !env.DATABASE_URL) throw new Error('DATABASE_URL_REQUIRED');
  const localTest = env.NODE_ENV === 'test' && env.ENABLE_LOCAL_TEST_IDENTITIES === 'true';
  if (localTest && env.HOST && !['127.0.0.1','localhost','::1'].includes(env.HOST)) throw new Error('LOCAL_TEST_MUST_BIND_LOOPBACK');
  const store = new Store({ url: env.DATABASE_URL, dataDir: env.DATA_DIR || './data' }); await store.init();
  const service = new Service(store, { localTest, now: options.now }); await service.recover();
  const app = express(); app.disable('x-powered-by'); app.use(express.json({ limit: '16kb' }));
  app.use((req,res,next)=>{req.requestId=crypto.randomUUID();res.set('X-Request-Id',req.requestId);const started=Date.now();res.on('finish',()=>{if(env.NODE_ENV==='test' || res.statusCode<400 && (req.method==='GET' || req.path.endsWith('/location')))return;console.log(JSON.stringify({requestId:req.requestId,method:req.method,path:req.path,status:res.statusCode,elapsedMs:Date.now()-started}));});next();});
  app.get('/health', (_, res) => res.json({ ok: true }));
  app.get('/ready', async (_, res) => { try { await store.query('SELECT 1'); res.json({ ready: true }); } catch { res.status(503).json({ ready: false }); } });
  app.get('/api/version', (_, res) => res.json({ version:'0.3.2',rulesVersion:'pilot-0.3',supportedRuleVersions:['pilot-0.2','pilot-0.3'],capabilities:{mapCalibration:true,customTeams:true,multiVenueMaps:true} }));
  const route = fn => async (req, res) => { try { res.json(await fn(req)); } catch (e) { const raw = e.code || e.message || 'INTERNAL',code=/^[A-Z_]+$/.test(raw)?raw:'INTERNAL'; res.status(code === 'UNAUTHENTICATED' ? 401 : code === 'FORBIDDEN' || code === 'NOT_MEMBER' ? 403 : code === 'INTERNAL' ? 500 : 400).json({ error: code }); } };
  const auth = async req => { const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1]; const id = await store.session(token); if (!id) { const e = new Error('UNAUTHENTICATED'); e.code = 'UNAUTHENTICATED'; throw e; } service.touch(id); return id; };
  app.post('/api/v2/session/test', route(async req => { if (!localTest) throw new Error('FORBIDDEN'); return store.createSession(); }));
  app.post('/api/v2/session/wechat', route(async req => {
    if (!env.WECHAT_APP_ID || !env.WECHAT_APP_SECRET || typeof req.body?.code !== 'string') throw new Error('LOGIN_UNAVAILABLE');
    const q = new URLSearchParams({ appid: env.WECHAT_APP_ID, secret: env.WECHAT_APP_SECRET, js_code: req.body.code, grant_type: 'authorization_code' });
    const r = await fetch('https://api.weixin.qq.com/sns/jscode2session?' + q, { signal: AbortSignal.timeout(5000) });
    const data = await r.json(); if (!r.ok || !data.openid || data.errcode) throw new Error('LOGIN_FAILED');
    // One persisted internal identity per openid, never derived from the display nickname.
    const { createHash } = require('node:crypto'); const h = createHash('sha256').update(env.WECHAT_APP_ID + ':' + data.openid).digest('hex');
    return store.createSession(`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`);
  }));
  app.post('/api/v2/rooms', route(async req => service.create(await auth(req), req.body)));
  app.post('/api/v2/rooms/:id/join', route(async req => service.join(req.params.id, await auth(req), req.body?.nickname)));
  app.get('/api/v2/rooms/:id', route(async req => service.read(req.params.id, await auth(req))));
  app.put('/api/v2/rooms/:id/calibration',route(async req=>service.calibrate(req.params.id,await auth(req),req.body)));
  app.post('/api/v2/rooms/:id/location', route(async req => service.location(req.params.id, await auth(req), req.body)));
  app.post('/api/v2/rooms/:id/ready', route(async req => service.ready(req.params.id, await auth(req), req.body?.ready)));
  app.post('/api/v2/rooms/:id/start', route(async req => service.start(req.params.id, await auth(req))));
  app.post('/api/v2/rooms/:id/token', route(async req => {
    const data = await service.token(req.params.id, await auth(req));
    const png = await require('qrcode').toBuffer(JSON.stringify({ matchId: data.matchId, token: data.token }), { type: 'png', margin: 2, width: 280 });
    return { ...data, qrPngBase64: png.toString('base64') };
  }));
  app.post('/api/v2/rooms/:id/capture', route(async req => service.capture(req.params.id, await auth(req), req.body)));
  app.post('/api/v2/rooms/:id/pause', route(async req => service.pause(req.params.id, await auth(req), req.body?.reason)));
  app.post('/api/v2/rooms/:id/resume', route(async req => service.resume(req.params.id, await auth(req))));
  app.post('/api/v2/rooms/:id/cancel', route(async req => service.cancel(req.params.id, await auth(req))));
  app.post('/api/v2/rooms/:id/leave', route(async req => service.leave(req.params.id, await auth(req))));
  app.get('/api/v2/matches/:id/result', route(async req => {
    const actor=await auth(req), r=await store.query('SELECT room_id,result FROM match_results WHERE match_id=$1',[req.params.id]);
    if(!r.rows[0]) throw Error('RESULT_NOT_FOUND');
    const room=await store.room(r.rows[0].room_id); if(!room.state.members.some(p=>p.id===actor)) throw Error('NOT_MEMBER');
    return r.rows[0].result;
  }));
  app.use((req,res)=>res.status(404).json({error:'NOT_FOUND'}));
  const server = http.createServer(app), wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', async (req, socket, head) => {
    try {
      const url = new URL(req.url, 'http://localhost'); if (url.pathname !== '/api/v2/live') throw Error();
      const token=/^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
      const actor = await store.session(token), roomId = url.searchParams.get('room');
      if (!actor || !roomId) throw Error(); await service.read(roomId, actor);
      wss.handleUpgrade(req, socket, head, ws => { ws.actor = actor; ws.roomId = roomId; ws.token=token; wss.emit('connection', ws); });
    } catch { socket.destroy(); }
  });
  wss.on('connection', ws => { service.touch(ws.actor); ws.on('message', raw => { if(raw.toString()==='PING'){service.touch(ws.actor);ws.send('PONG');} }); ws.send(JSON.stringify({ type: 'CONNECTED' })); });
  let pushing=false;
  const timer = setInterval(async () => {
    if(pushing)return;pushing=true;
    try {
    for (const ws of wss.clients) {
      if (ws.readyState !== 1) continue;
      if (ws.bufferedAmount > 65536) { ws.close(1013, 'snapshot required'); continue; }
      try { if(await store.session(ws.token)!==ws.actor){ws.close(1008,'session expired');continue;} ws.send(JSON.stringify({ type: 'SNAPSHOT', payload: await service.read(ws.roomId, ws.actor) })); } catch { ws.close(); }
    }
    } finally { pushing=false; }
  }, 1000); timer.unref();
  let ticking = false;
  const clock = setInterval(async () => {
    if (ticking) return; ticking = true;
    try { const rows = await store.query("SELECT id,owner_id FROM rooms WHERE state->'match' IS NOT NULL AND state->'match'->>'phase' NOT IN ('FINISHED','CANCELLED')"); for (const room of rows.rows) await service.read(room.id, room.owner_id); }
    catch (e) { console.error('clock error', e.code || e.message); }
    finally { ticking = false; }
  }, 1000); clock.unref();
  return { app, server, store, service, close: async () => { clearInterval(timer); clearInterval(clock); for (const ws of wss.clients) ws.terminate(); await new Promise(resolve => server.close(resolve)); await store.close(); } };
}
if (require.main === module) createServer().then(({ server }) => server.listen(process.env.PORT || 4000, process.env.HOST || '127.0.0.1', () => console.log('cat-mouse v2 ready'))).catch(e => { console.error('startup failed', e.code || (/^[A-Z_]+$/.test(e.message)?e.message:'INTERNAL')); process.exitCode = 1; });
module.exports = { createServer };
