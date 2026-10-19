// Read-only baseline audit. Creates disposable rooms ONLY in a local child process.
// Install the backend lockfile dependencies in a temporary directory and pass it as arg 1.
// Usage: node audit-baseline.cjs <temporary-dependency-directory> [output.json]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const dependencyDir = process.argv[2];
if (!dependencyDir) throw new Error('Provide a temporary directory with backend dependencies installed.');
const bootstrap = `
const http = require('node:http');
const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function(port, host, callback) {
  return listen.call(this, 0, '127.0.0.1', () => {
    process.send({ port: this.address().port });
    if (callback) callback();
  });
};
require(process.env.BASELINE_SERVER);
`;
const child = spawn(process.execPath, ['-e', bootstrap], {
  cwd: root,
  windowsHide: true,
  env: { ...process.env, NODE_PATH: path.join(dependencyDir, 'node_modules'),
    BASELINE_SERVER: path.join(root, 'cat-mouse-server/server.js'), ENABLE_TASKS: 'false',
    SSL_KEY_PATH: '', SSL_CERT_PATH: '', SSL_CA_PATH: '' },
  stdio: ['ignore', 'pipe', 'pipe', 'ipc']
});
let errors = '';
child.stdout.resume();
child.stderr.on('data', chunk => { errors += chunk; });
const findings = [];
const record = (id, name, observed) => findings.push({ id, name, reproduced: true, observed });
(async () => {
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Local server timeout: ' + errors)), 10000);
    child.once('message', message => { clearTimeout(timer); resolve(message.port); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error('Child exited: ' + code + errors)); });
  });
  const request = async (method, route, body) => {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, {
      method, headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000)
    });
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch { data = { text }; }
    return { status: response.status, data, bytes: Buffer.byteLength(text) };
  };
  const room = async (count = 2, settings = {}) => {
    const created = await request('POST', '/api/game/room', { catCount: 1, mouseCount: count - 1 || 1, ...settings });
    const id = created.data.roomId;
    for (let n = 0; n < count; n++) {
      assert.equal((await request('POST', `/api/game/room/${id}`, { playerId: `p${n}`, nickname: `audit-${n}` })).status, 200);
    }
    return id;
  };
  const start = async id => (await request('POST', `/api/game/room/${id}/start`, {})).data.players;
  const roles = players => ({ cat: players.find(p => p.role === 'cat'), mouse: players.find(p => p.role === 'mouse') });
  const status = async id => request('GET', `/api/game/${id}/status`);
  const health = await request('GET', '/health'); assert.equal(health.status, 200);

  const settingsId = await room();
  const changed = await request('PUT', `/api/game/room/${settingsId}/settings`, { settings: { gameDuration: 900, visionRange: 777, riddleMode: 'same' } });
  assert.equal(changed.data.settings.gameDuration, 900);
  record('R01', 'Anonymous settings update accepted', { httpStatus: changed.status, duration: changed.data.settings.gameDuration });
  assert.equal(changed.data.settings.visionRange, undefined);
  assert.equal(changed.data.settings.riddleMode, undefined);
  record('R02', 'Vision and riddle settings silently discarded', changed.data.settings);

  const soloId = await room(1);
  const solo = await start(soloId);
  assert.equal(solo.length, 1); assert.equal(solo[0].role, 'cat');
  record('R03', 'Anonymous start with one cat and no mouse accepted', { players: solo.length, roles: solo.map(p => p.role) });

  const fullId = await room();
  const repeat = await request('POST', `/api/game/room/${fullId}`, { playerId: 'p0' });
  assert.equal(repeat.status, 400);
  record('R04', 'Existing player retry rejected when room is full', repeat.data);

  const itemId = await room();
  const itemRoles = roles(await start(itemId));
  const use1 = await request('POST', `/api/game/${itemId}/item`, { playerId: itemRoles.cat.id, itemId: 'invisible' });
  const use2 = await request('POST', `/api/game/${itemId}/item`, { playerId: itemRoles.cat.id, itemId: 'invisible' });
  const afterItem = (await status(itemId)).data.players.find(p => p.id === itemRoles.cat.id);
  assert.equal(use1.status, 200); assert.equal(use2.status, 200);
  assert.equal(afterItem.score, 20); assert.equal(afterItem.items.invisibleCount, 1); assert.equal(afterItem.items.invisible, 0);
  record('R05', 'Item success is not persisted and can be repeated', { first: use1.data, second: use2.data, storedScore: afterItem.score, storedItems: afterItem.items });
  const mouseItem = await request('POST', `/api/game/${itemId}/item`, { playerId: itemRoles.mouse.id, itemId: 'invisible' });
  assert.equal(mouseItem.status, 400);
  record('R06', 'Mouse cannot afford the only enabled item', mouseItem.data);

  const catchId = await room();
  const catchRoles = roles(await start(catchId));
  const caught = await request('POST', `/api/game/${catchId}/catch`, { catcherId: catchRoles.cat.id, caughtId: catchRoles.mouse.id });
  assert.equal(caught.status, 200);
  record('R07', 'Capture without authentication, QR proof or either location succeeds', caught.data);
  const ended = (await status(catchId)).data;
  assert.equal(ended.status, 'ended'); assert.equal(ended.winner, undefined); assert.equal(ended.events.length, 0);
  record('R08', 'Status omits winner and capture history after terminal capture', { status: ended.status, winnerPresent: Object.hasOwn(ended, 'winner'), winReason: ended.winReason, events: ended.events });
  const restarted = await start(catchId);
  assert.equal((await status(catchId)).data.status, 'playing');
  record('R09', 'Finished match can be started again without state guard', { roles: restarted.map(p => p.role), status: 'playing' });
  const forgedEnd = await request('POST', `/api/game/${catchId}/end`, { winner: 'mouse' });
  assert.equal(forgedEnd.data.result.winner, 'mouse');
  record('R10', 'Anonymous caller can choose winner and overwrite result', forgedEnd.data);

  const locId = await room();
  const locRoles = roles(await start(locId));
  for (const [player, lat, lng] of [[locRoles.cat, 31, 118], [locRoles.mouse, 33, 119]]) {
    assert.equal((await request('POST', `/api/game/${locId}/location`, { playerId: player.id, latitude: lat, longitude: lng })).status, 200);
  }
  const publicSnapshot = (await status(locId)).data;
  assert.equal(publicSnapshot.players.length, 2); assert.equal(publicSnapshot.allPlayers.length, 2);
  assert.ok(publicSnapshot.players.every(p => p.latitude && p.taskRiddle));
  record('R11', 'Anonymous status exposes distant opponents, roles and hidden riddle', { positions: publicSnapshot.players.map(p => ({ role: p.role, latitude: p.latitude, longitude: p.longitude })), duplicateAllPlayers: true, riddleVisible: true });
  const far = await request('POST', `/api/game/${locId}/catch`, { catcherId: locRoles.cat.id, caughtId: locRoles.mouse.id });
  assert.equal(far.status, 400);
  await request('POST', `/api/game/${locId}/location`, { playerId: locRoles.mouse.id, latitude: 31, longitude: 118 });
  const spoofed = await request('POST', `/api/game/${locId}/catch`, { catcherId: locRoles.cat.id, caughtId: locRoles.mouse.id });
  assert.equal(spoofed.status, 200);
  record('R12', 'Caller can overwrite another player location and bypass distance', { beforeSpoofStatus: far.status, afterSpoofStatus: spoofed.status });

  const deadlineId = await room(2, { gameDuration: 0.05 });
  const deadlineRoles = roles(await start(deadlineId));
  await new Promise(resolve => setTimeout(resolve, 100));
  const late = await request('POST', `/api/game/${deadlineId}/catch`, { catcherId: deadlineRoles.cat.id, caughtId: deadlineRoles.mouse.id });
  assert.equal(late.status, 200);
  record('R13', 'Capture after deadline accepted if status has not been read', { durationSeconds: 0.05, waitedMs: 100, result: late.data });
  // Exact edge tested by setting an accepted fractional duration; same floor branch applies in the last second of an integer-duration match.
  const floorId = await room(2, { gameDuration: 0.8 }); await start(floorId);
  const early = (await status(floorId)).data;
  assert.equal(early.status, 'ended');
  record('R14', 'Floor countdown ends match during its final partial second', { durationSeconds: 0.8, immediateStatus: early.status, countdown: early.countdown });

  const ownerId = await room(2, { mouseCount: 2 });
  const stolen = await request('POST', `/api/game/room/${ownerId}`, { playerId: 'intruder', isOwner: true });
  assert.equal(stolen.status, 200);
  const ownerRoom = (await request('GET', `/api/game/room/${ownerId}`)).data;
  assert.equal(ownerRoom.ownerId, 'intruder');
  record('R15', 'Join request can replace host', { ownerId: ownerRoom.ownerId, hostFlags: ownerRoom.players.filter(p => p.isOwner).length });

  const version = await request('GET', '/api/version'); assert.equal(version.status, 404);
  record('R16', 'Home version endpoint is missing', { httpStatus: version.status });

  const sizes = [];
  for (const count of [6, 12, 20]) {
    const id = await room(count); const players = await start(id);
    for (const p of players) await request('POST', `/api/game/${id}/location`, { playerId: p.id, latitude: 32.0584, longitude: 118.7968 });
    const snapshot = await status(id);
    sizes.push({ players: count, statusBodyBytes: snapshot.bytes, pollingBodyMbps100Online: +(snapshot.bytes * 0.5 * 100 * 8 / 1e6).toFixed(3) });
  }
  const source = fs.readFileSync(path.join(root, 'cat-mouse-server/server.js'));
  const result = { baselineDate: '2026-10-08', nodeVersion: process.version,
    serverSha256: crypto.createHash('sha256').update(source).digest('hex'),
    scope: 'Disposable localhost-only HTTP audit, tasks disabled, no production service, no true devices or load test',
    checks: findings, payloadSamples: sizes };
  if (process.argv[3]) fs.writeFileSync(path.resolve(process.argv[3]), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  child.kill();
});
