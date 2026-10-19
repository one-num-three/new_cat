const crypto = require('node:crypto');
const registration=require('../shared/geo-registration');
const venueImages=require('../shared/venue-images.js');
const { preset, targetFor, distance } = require('./rules');
const { hash } = require('./store');
const fail = code => { const e = new Error(code); e.code = code; throw e; };
const positionKey=(roomId,actor)=>roomId+':'+actor;
const terminal = m => m && ['FINISHED', 'CANCELLED'].includes(m.phase);
class Service {
  constructor(store, options = {}) { this.store = store; this.positions = new Map(); this.outside = new Map(); this.lastSeen = new Map(); this.localTest = !!options.localTest; this.now = options.now || Date.now; }
  touch(actor) { this.lastSeen.set(actor,this.now()); }
  async recover() {
    const rooms = await this.store.query('SELECT * FROM rooms');
    for (const room of rooms.rows) if (room.state.match && !terminal(room.state.match)) {
      const s = room.state, m = s.match;
      m.resumePhase = m.phase === 'PAUSED' ? m.resumePhase : m.phase;
      m.remainingMs = m.phase === 'PAUSED' ? m.remainingMs : Math.max(0, m.endsAt - (m.lastTickAt || this.now()));
      m.phase = 'PAUSED'; m.pauseReason = 'server_restart'; m.pausedAt = this.now(); m.tokens = {};
      s.version++; await this.store.query('UPDATE rooms SET state=$2 WHERE id=$1', [room.id, JSON.stringify(s)]);
    }
  }
  async create(actor, input) {
    const keys = Object.keys(input || {}); if (keys.some(k => !['total', 'cats', 'mice', 'venue', 'nickname', 'mapId'].includes(k))) fail('INVALID_CONFIG');
    const custom = keys.includes('cats') || keys.includes('mice');
    const rules = preset(input.total, this.localTest, custom ? {cats:input.cats,mice:input.mice} : undefined);
    const v = input.venue;
    if (!v || !v.confirmed || !Number.isFinite(v.lat) || !Number.isFinite(v.lng) || Math.abs(v.lat)>90 || Math.abs(v.lng)>180 || !Number.isInteger(v.radiusM) || v.radiusM < 100 || v.radiusM > 500) fail('INVALID_VENUE');
    if(input.mapId!==undefined&&v.mapId!==undefined&&input.mapId!==v.mapId)fail('INVALID_VENUE_MAP');
    const mapId=input.mapId??v.mapId??'xuanwu-v4',image=venueImages.find(x=>x.id===mapId);if(!image)fail('INVALID_VENUE_MAP');
    const bounds=image.gcjBounds;if(bounds&&(v.lng<bounds[0]||v.lat<bounds[1]||v.lng>bounds[2]||v.lat>bounds[3]))fail('VENUE_MAP_MISMATCH');
    const state = { version: 1, rules, venue: { lat: v.lat, lng: v.lng, radiusM: v.radiusM, confirmed: true, mapId }, members: [{ id: actor, nickname: name(input.nickname), ready: false }], match: null, history: [] };
    for(let attempt=0;attempt<3;attempt++) {
      const id = crypto.randomUUID(), code = crypto.randomBytes(5).toString('hex').toUpperCase();
      try { await this.store.query('INSERT INTO rooms VALUES ($1,$2,$3,$4)', [id, code, actor, JSON.stringify(state)]); return { roomId: id, code }; }
      catch(e) { if(e.code!=='23505' && !/duplicate key/i.test(e.message)) throw e; }
    }
    fail('ROOM_CODE_EXHAUSTED');
  }
  async mutate(id, actor, fn) {
    let completed;
    const result = await this.store.tx(async db => {
      const room = await this.store.room(id, db, true); if (!room) fail('ROOM_NOT_FOUND');
      const member = room.state.members.find(p => p.id === actor); if (!member) fail('NOT_MEMBER');
      const wasTerminal = terminal(room.state.match);
      await this.tick(room, db);
      const out = await fn(room, db, member);
      await this.store.save(db, room);
      if (terminal(room.state.match)) {
        if (!wasTerminal) completed = {match:room.state.match,roomId:room.id};
        const finished = room.state.match;
        await db.query('INSERT INTO match_results VALUES ($1,$2,$3) ON CONFLICT (match_id) DO NOTHING', [finished.id, room.id, JSON.stringify({ matchId:finished.id, outcome:finished.outcome, reason:finished.reason, endedAt:finished.endedAt, captured:finished.captured, target:finished.target, rulesVersion:room.state.rules.version })]);
      }
      return out;
    });
    if (completed) this.clearPositions(completed.match,completed.roomId);
    return result;
  }
  async calibrate(id,actor,input){return this.mutate(id,actor,async room=>{
    if(room.owner_id!==actor)fail('FORBIDDEN');
    if(!input||Object.keys(input).some(k=>!['commandId','expectedVersion','imageId','imageSha256','crs','points'].includes(k))||!validUuid(input.commandId))fail('INVALID_CALIBRATION');
    if(input.imageId!==(room.state.venue.mapId||'xuanwu-v4'))fail('CALIBRATION_IMAGE_OR_CRS');
    const digest=hash(JSON.stringify({expectedVersion:input.expectedVersion,imageId:input.imageId,imageSha256:input.imageSha256,crs:input.crs,points:input.points}));
    const prior=(room.state.calibrationCommands||[]).find(x=>x.id===input.commandId);
    if(prior){if(prior.digest!==digest)fail('COMMAND_CONFLICT');return prior.result;}
    if(room.state.match&&!terminal(room.state.match))fail('IN_PROGRESS');
    if(input.expectedVersion!==room.state.version)fail('VERSION_CONFLICT');
    const model=registration.compile(input);
    if(!registration.project(room.state.venue,model,input.imageId))fail('CALIBRATION_VENUE_MISMATCH');
    room.state.mapCalibration={...model,id:crypto.randomUUID(),createdAt:this.now()};room.state.version++;
    // Geometry changes before the next match must be acknowledged by everyone.
    room.state.members.forEach(p=>{p.ready=false;});
    const result={version:room.state.version,mapCalibration:room.state.mapCalibration};
    room.state.calibrationCommands=[...(room.state.calibrationCommands||[]),{id:input.commandId,digest,result}].slice(-16);
    return result;
  });}
  async join(id, actor, nickname) {
    return this.store.tx(async db => {
      const room = await this.store.room(id, db, true); if (!room) fail('ROOM_NOT_FOUND');
      let member = room.state.members.find(p => p.id === actor);
      if (!member) {
        if (room.state.match && !terminal(room.state.match)) fail('IN_PROGRESS');
        if (room.state.members.length >= room.state.rules.total) fail('ROOM_FULL');
        member = { id: actor, nickname: name(nickname), ready: false }; room.state.members.push(member); room.state.version++;
        await this.store.save(db, room);
      }
      return { roomId: room.id, memberId: member.id };
    });
  }
  async read(id, actor) {
    return this.mutate(id, actor, room => this.view(room, actor));
  }
  view(room, actor) {
    const s = room.state, m = s.match, me = m?.participants.find(p => p.id === actor);
    const roster = s.members.map(p => ({ id: p.id, nickname: p.nickname, ready: p.ready, role: m?.participants.find(x => x.id === p.id)?.role || null, status: m?.participants.find(x => x.id === p.id)?.status || null, presence: this.now()-(this.lastSeen.get(p.id)||0)<=15000?'online':'reconnecting' }));
    const base = { protocolVersion: 2, serverTime: this.now(), roomId: room.id, code: room.code, owner: room.owner_id === actor, version: s.version, venue: s.venue, rules: s.rules, mapCalibration:s.mapCalibration||null, roster, match: m ? { id: m.id, phase: m.phase, endsAt: m.endsAt, remainingMs: m.phase === 'PAUSED' ? m.remainingMs : Math.max(0, m.endsAt - this.now()), pauseReason: m.pauseReason || null, target: m.target, captured: m.captured, outcome: m.outcome || null, reason: m.reason || null, eventSeq: m.eventSeq, myRole: me?.role, myStatus: me?.status } : null, visiblePositions: [], intel: [], nearbyCat: false, events: [] };
    if (!m) return base;
    base.events = m.publicEvents.slice(-12);
    if (terminal(m) || m.phase === 'PAUSED' || !me || me.status !== 'active') return base;
    const mine = this.fresh(actor,room.id), now = this.now();
    if (mine) base.visiblePositions.push({ id: actor, ...coordinate(mine) });
    for (const p of m.participants) {
      if (p.id === actor || p.status !== 'active') continue;
      const pos = this.fresh(p.id,room.id); if (!pos) continue;
      if (p.role === me.role) base.visiblePositions.push({ id: p.id, ...coordinate(pos) });
      else if (me.role === 'mouse' && m.phase === 'CHASING' && mine && distance(mine, pos) <= 120) base.nearbyCat = true;
    }
    if (me.role === 'cat' && m.phase === 'CHASING') base.intel = m.intel || [];
    return base;
  }
  fresh(id,roomId) { const p = this.positions.get(positionKey(roomId,id)); return p && this.now() - p.receivedAt <= 5000 ? p : null; }
  async ready(id, actor, ready) { return this.mutate(id, actor, room => { if (room.state.match && !terminal(room.state.match)) fail('IN_PROGRESS'); if (ready && !this.fresh(actor,room.id)) fail('LOCATION_REQUIRED'); room.state.members.find(p => p.id === actor).ready = !!ready; room.state.version++; return this.view(room, actor); }); }
  async location(id, actor, input) {
    return this.mutate(id, actor, async (room, db) => {
      this.touch(actor);
      const { lat, lng, accuracy, sampledAt, sampleSeq, coordinateSystem } = input || {};
      if (room.state.match && !terminal(room.state.match) && room.state.match.participants.find(p=>p.id===actor)?.status==='captured') fail('CAPTURED');
      if (![lat, lng, accuracy, sampledAt, sampleSeq].every(Number.isFinite) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || accuracy < 0 || accuracy > 25 || !Number.isInteger(sampleSeq) || coordinateSystem !== 'gcj02' || Math.abs(this.now() - sampledAt) > 10000) fail('INVALID_LOCATION');
      const prev = this.positions.get(positionKey(room.id,actor)); if (prev && sampleSeq <= prev.sampleSeq && this.now()-prev.receivedAt<=5000) fail('STALE_LOCATION');
      if (prev && distance(prev, { lat, lng }) > Math.max(100, (sampledAt - prev.sampledAt) / 1000 * 20 + 50)) fail('LOCATION_JUMP');
      if (distance(room.state.venue, { lat, lng }) > room.state.venue.radiusM + 50) {
        const previous=this.outside.get(positionKey(room.id,actor)), o=previous?{firstAt:previous.firstAt,count:previous.count+1}:{firstAt:this.now(),count:1}; this.outside.set(positionKey(room.id,actor),o);
        const m=room.state.match;
        if(o.count>=3 && this.now()-o.firstAt>=10000 && m && !terminal(m) && m.phase!=='PAUSED') {
          m.resumePhase=m.phase; m.remainingMs=Math.max(0,m.endsAt-this.now()); m.phase='PAUSED'; m.pausedAt=this.now(); m.pauseReason='outside_venue'; m.tokens={}; room.state.version++; await this.event(db,m,'PAUSE',{reason:'outside_venue'});
        }
        return {accepted:false,warning:'OUTSIDE_VENUE'};
      }
      this.outside.delete(positionKey(room.id,actor));
      this.positions.set(positionKey(room.id,actor), { lat, lng, accuracy, sampledAt, sampleSeq, receivedAt: this.now() });
      const m=room.state.match;
      if(m?.phase==='CHASING' && (!m.intel || m.intel.length===0) && m.participants.filter(p=>p.role==='mouse' && p.status==='active').every(p=>this.fresh(p.id,room.id))) { m.intelBucket=-1; this.refreshIntel(room); }
      return { accepted: true };
    });
  }
  async start(id, actor) { return this.mutate(id, actor, async (room, db) => {
    if (room.owner_id !== actor) fail('FORBIDDEN'); const s = room.state;
    if (s.match && !terminal(s.match)) fail('IN_PROGRESS');
    if (s.members.length !== s.rules.total || s.members.some(p => !p.ready || !this.fresh(p.id,room.id))) fail('NOT_READY');
    const shuffled = [...s.members];
    for (let i = shuffled.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
    const previousCats=new Set(s.match?.participants.filter(p=>p.role==='cat').map(p=>p.id)||[]);
    const rotated=[...shuffled.filter(p=>!previousCats.has(p.id)),...shuffled.filter(p=>previousCats.has(p.id))];
    const now = this.now(), m = { id: crypto.randomUUID(), phase: 'HIDING', endsAt: now + s.rules.hidingMs, lastTickAt:now, participants: rotated.map((p, i) => ({ id: p.id, role: i < s.rules.cats ? 'cat' : 'mouse', status: 'active' })), target: targetFor(s.rules.mice), captured: 0, eventSeq: 0, publicEvents: [], tokens: {}, usedTokens: {}, pauseUsedMs: 0 };
    s.match = m; s.history.push(m.id); s.version++; await this.event(db, m, 'START', { phase: m.phase }); return this.view(room, actor);
  }); }
  async event(db, m, kind, payload) { m.eventSeq++; const e = { seq: m.eventSeq, kind, payload, at: this.now() }; m.publicEvents.push(e); await db.query('INSERT INTO events VALUES ($1,$2,$3,$4,$5)', [m.id, e.seq, kind, JSON.stringify(payload), e.at]); }
  async tick(room, db) {
    const m = room.state.match; if (!m || terminal(m)) return;
    if (m.phase === 'PAUSED') { if (m.pauseReason !== 'server_restart' && m.pauseUsedMs + this.now() - m.pausedAt >= room.state.rules.pauseBudgetMs) await this.cancelInside(room, db, 'pause_budget'); return; }
    m.lastTickAt=this.now();
    if (m.phase === 'CHASING' && this.now() >= m.endsAt) { m.phase = 'FINISHED'; m.outcome = 'mouse_win'; m.reason = 'deadline'; m.endedAt = this.now(); m.tokens = {}; room.state.version++; await this.event(db, m, 'RESULT', { outcome: m.outcome, reason: m.reason }); return; }
    if (m.participants.some(p => p.status === 'active' && (!this.positions.get(positionKey(room.id,p.id)) || this.now() - this.positions.get(positionKey(room.id,p.id)).receivedAt > 30000 || this.now()-(this.lastSeen.get(p.id)||0)>30000))) {
      m.resumePhase=m.phase; m.remainingMs=Math.max(0,m.endsAt-this.now()); m.phase='PAUSED'; m.pausedAt=this.now(); m.pauseReason='lost_position'; m.tokens={}; room.state.version++;
      await this.event(db,m,'PAUSE',{reason:'lost_position'}); return;
    }
    if (m.phase === 'CHASING') this.refreshIntel(room);
    if (this.now() < m.endsAt) return;
    if (m.phase === 'HIDING') { m.phase = 'CHASING'; m.endsAt += room.state.rules.chasingMs; room.state.version++; this.refreshIntel(room); await this.event(db, m, 'CHASING', {}); }
  }
  refreshIntel(room) {
    const m = room.state.match, bucket = Math.floor(this.now() / room.state.rules.intelMs);
    if (m.intelBucket === bucket) return;
    m.intelBucket = bucket; m.intel = [];
    for (const p of m.participants.filter(x => x.role === 'mouse' && x.status === 'active')) {
      const pos = this.fresh(p.id,room.id); if (!pos) continue;
      const latStep = 50 / 111320, lngStep = 50 / (111320 * Math.cos(pos.lat * Math.PI / 180));
      m.intel.push({ id: p.id, cellLat: Math.floor(pos.lat / latStep) * latStep, cellLng: Math.floor(pos.lng / lngStep) * lngStep, radiusM: 50, sampledWindow: bucket, expiresAt: (bucket + 1) * room.state.rules.intelMs });
    }
    room.state.version++;
  }
  async token(id, actor) { return this.mutate(id, actor, room => {
    const m = room.state.match, p = m?.participants.find(p => p.id === actor);
    if (!m || m.phase !== 'CHASING' || this.now()>=m.endsAt || p?.role !== 'mouse' || p.status !== 'active') fail('TOKEN_UNAVAILABLE');
    for (const [key, value] of Object.entries(m.tokens)) if (value.target === actor || value.expiresAt <= this.now()) delete m.tokens[key];
    const token = crypto.randomBytes(24).toString('base64url'); m.tokens[hash(token)] = { target: actor, expiresAt: this.now() + room.state.rules.tokenMs };
    return { matchId: m.id, token, expiresAt: m.tokens[hash(token)].expiresAt };
  }); }
  async capture(id, actor, input) { return this.mutate(id, actor, async (room, db) => {
    const m = room.state.match; if (!m) fail('NO_MATCH');
    const commandId = input?.commandId; if (!validUuid(commandId)) fail('INVALID_COMMAND');
    const prior = await db.query('SELECT result FROM commands WHERE match_id=$1 AND actor_id=$2 AND command_id=$3', [m.id, actor, commandId]);
    if (prior.rows[0]) return prior.rows[0].result;
    if (input.matchId !== m.id || typeof input.token !== 'string') fail('INVALID_TOKEN');
    if (m.phase !== 'CHASING' || this.now()>=m.endsAt) fail('NOT_CHASING');
    const cat = m.participants.find(p => p.id === actor); if (cat?.role !== 'cat' || cat.status !== 'active') fail('FORBIDDEN');
    const tokenHash=hash(input.token);
    if (m.usedTokens[tokenHash]) fail('ALREADY_CAPTURED');
    const proof = m.tokens[tokenHash]; if (!proof || proof.expiresAt <= this.now()) fail('INVALID_TOKEN');
    const mouse = m.participants.find(p => p.id === proof.target); if (mouse?.status !== 'active') fail('ALREADY_CAPTURED');
    const a = this.fresh(actor,room.id), b = this.fresh(mouse.id,room.id); if (!a || !b || a.accuracy > 25 || b.accuracy > 25 || distance(a, b) > 50) fail('LOCATION_REQUIRED');
    delete m.tokens[tokenHash]; m.usedTokens[tokenHash]=mouse.id; mouse.status = 'captured'; m.captured++; room.state.version++;
    await this.event(db, m, 'CAPTURE', { catId: actor, mouseId: mouse.id, captured: m.captured });
    if (m.captured >= m.target) { m.phase = 'FINISHED'; m.outcome = 'cat_win'; m.reason = 'capture_target'; m.endedAt = this.now(); m.tokens = {}; await this.event(db, m, 'RESULT', { outcome: m.outcome, reason: m.reason }); }
    const result = { accepted: true, matchId: m.id, captured: m.captured, outcome: m.outcome || null };
    await db.query('INSERT INTO commands VALUES ($1,$2,$3,$4)', [m.id, actor, commandId, JSON.stringify(result)]); return result;
  }); }
  async pause(id, actor, reason) { return this.mutate(id, actor, async (room, db) => {
    const m = room.state.match; if (!m || terminal(m) || m.phase!=='PAUSED' && this.now()>=m.endsAt) fail('NO_ACTIVE_MATCH');
    if (room.owner_id !== actor && reason !== 'emergency' && reason !== 'leave') fail('FORBIDDEN');
    if (m.phase === 'PAUSED') return this.view(room, actor);
    m.resumePhase = m.phase; m.remainingMs = Math.max(0, m.endsAt - this.now()); m.phase = 'PAUSED'; m.pausedAt = this.now(); m.pauseReason = reason || 'host'; m.tokens = {}; room.state.version++; await this.event(db, m, 'PAUSE', { reason: m.pauseReason }); return this.view(room, actor);
  }); }
  async resume(id, actor) { return this.mutate(id, actor, async (room, db) => {
    if (room.owner_id !== actor) fail('FORBIDDEN'); const m = room.state.match; if (m?.phase !== 'PAUSED') fail('NOT_PAUSED');
    m.pauseUsedMs += this.now() - m.pausedAt;
    if (m.pauseUsedMs > room.state.rules.pauseBudgetMs) return this.cancelInside(room, db, 'pause_budget');
    if (m.participants.some(p => p.status === 'active' && !this.fresh(p.id,room.id))) fail('LOCATION_REQUIRED');
    m.phase = m.resumePhase; m.endsAt = this.now() + m.remainingMs; m.lastTickAt=this.now(); m.pauseReason = null; room.state.version++; await this.event(db, m, 'RESUME', {}); return this.view(room, actor);
  }); }
  async cancelInside(room, db, reason) { const m = room.state.match; m.phase = 'CANCELLED'; m.outcome = 'cancelled'; m.reason = reason; m.endedAt = this.now(); m.tokens = {}; room.state.version++; await this.event(db, m, 'RESULT', { outcome: 'cancelled', reason }); return { matchId: m.id, outcome: 'cancelled' }; }
  async cancel(id, actor) { return this.mutate(id, actor, async (room, db) => { if (room.owner_id !== actor) fail('FORBIDDEN'); if (!room.state.match || terminal(room.state.match)) fail('NO_ACTIVE_MATCH'); return this.cancelInside(room, db, 'host_cancel'); }); }
  async leave(id, actor) { let leavingRoomId;const result=await this.mutate(id, actor, async (room, db) => { leavingRoomId=room.id;const m = room.state.match; if (m && !terminal(m)) { if (m.phase !== 'PAUSED') { m.resumePhase = m.phase; m.remainingMs = Math.max(0, m.endsAt - this.now()); m.phase = 'PAUSED'; m.pausedAt = this.now(); m.pauseReason = 'leave'; m.tokens = {}; room.state.version++; await this.event(db, m, 'PAUSE', { reason: 'leave' }); } } else { room.state.members = room.state.members.filter(p => p.id !== actor); room.state.version++; } return { left: true }; }); this.positions.delete(positionKey(leavingRoomId,actor));this.outside.delete(positionKey(leavingRoomId,actor));return result; }
  clearPositions(m,roomId) { for (const p of m.participants) { this.positions.delete(positionKey(roomId,p.id)); this.outside.delete(positionKey(roomId,p.id)); } }
}
function validUuid(x) { return typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(x); }
function name(x) { const s = String(x || '').trim(); if (!s || s.length > 20) fail('INVALID_NAME'); return s; }
function coordinate(p) { return { lat: p.lat, lng: p.lng, accuracy: p.accuracy, receivedAt: p.receivedAt }; }
module.exports = { Service };
