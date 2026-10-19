// Run only on the deployed host. Creates one short-lived session and room, then removes both.
const { Store, hash } = require('/opt/cat-mouse/release-20261011b/v2/store');
const { Service } = require('/opt/cat-mouse/release-20261011b/v2/service');
const WebSocket = require('/opt/cat-mouse/release-20261011b/node_modules/ws');

(async () => {
  if (!process.env.DATABASE_URL) throw Error('DATABASE_URL_REQUIRED');
  const store = new Store({ url: process.env.DATABASE_URL });
  let session, room;
  try {
    await store.init();
    session = await store.createSession();
    room = await new Service(store).create(session.id, {
      total: 6,
      venue: { lat: 32.0584, lng: 118.7968, radiusM: 200, confirmed: true },
      nickname: 'gateway-probe'
    });
    const result = await new Promise((resolve, reject) => {
      const ws = new WebSocket(`wss://seu-link.fit/catmouse/api/v2/live?room=${room.roomId}`, {
        headers: { Authorization: `Bearer ${session.token}` }, handshakeTimeout: 5000
      });
      const timeout = setTimeout(() => { ws.terminate(); reject(Error('WS_TIMEOUT')); }, 5000);
      ws.on('message', raw => {
        const message = JSON.parse(raw.toString());
        if (message.type === 'SNAPSHOT') {
          clearTimeout(timeout);
          ws.close();
          resolve({ type: message.type, roomMatches: message.payload.roomId === room.roomId,
            visiblePositions: message.payload.visiblePositions.length });
        }
      });
      ws.on('error', error => { clearTimeout(timeout); reject(error); });
      ws.on('close', () => clearTimeout(timeout));
    });
    if (!result.roomMatches) throw Error('WRONG_ROOM');
    console.log(JSON.stringify(result));
  } finally {
    if (room) await store.query('DELETE FROM rooms WHERE id=$1', [room.roomId]);
    if (session) await store.query('DELETE FROM sessions WHERE token_hash=$1', [hash(session.token)]);
    await store.close();
  }
})().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
