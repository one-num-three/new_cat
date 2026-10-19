const crypto = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { Pool } = require('pg');
class Store {
  constructor({ url, dataDir }) { this.url = url; this.dataDir = dataDir; this.embedded = !url; this.queue = Promise.resolve(); }
  async init() {
    this.db = this.embedded ? new PGlite(this.dataDir || './data') : new Pool({ connectionString: this.url, max: 8 });
    await this.query('CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id UUID NOT NULL, expires_at BIGINT NOT NULL)');
    await this.query('CREATE TABLE IF NOT EXISTS rooms (id UUID PRIMARY KEY, code TEXT UNIQUE NOT NULL, owner_id UUID NOT NULL, state JSONB NOT NULL)');
    await this.query('CREATE TABLE IF NOT EXISTS events (match_id UUID NOT NULL, seq INTEGER NOT NULL, kind TEXT NOT NULL, payload JSONB NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY(match_id, seq))');
    await this.query('CREATE TABLE IF NOT EXISTS commands (match_id UUID NOT NULL, actor_id UUID NOT NULL, command_id UUID NOT NULL, result JSONB NOT NULL, PRIMARY KEY(match_id, actor_id, command_id))');
    await this.query('CREATE TABLE IF NOT EXISTS match_results (match_id UUID PRIMARY KEY, room_id UUID NOT NULL, result JSONB NOT NULL)');
  }
  query(sql, params = []) { return this.db.query(sql, params); }
  async tx(fn) {
    const run = async () => {
      const db = this.embedded ? this.db : await this.db.connect();
      try { await db.query('BEGIN'); const result = await fn(db); await db.query('COMMIT'); return result; }
      catch (e) { await db.query('ROLLBACK'); throw e; }
      finally { if (!this.embedded) db.release(); }
    };
    if (!this.embedded) return run();
    const task = this.queue.then(run); this.queue = task.catch(() => {}); return task;
  }
  async createSession(userId) {
    const id = userId || crypto.randomUUID(), token = crypto.randomBytes(32).toString('base64url');
    await this.query('INSERT INTO sessions VALUES ($1,$2,$3)', [hash(token), id, Date.now() + 30 * 86400000]);
    return { id, token };
  }
  async session(token) {
    if (!token) return null;
    const r = await this.query('SELECT user_id FROM sessions WHERE token_hash=$1 AND expires_at>$2', [hash(token), Date.now()]);
    return r.rows[0]?.user_id || null;
  }
  async room(idOrCode, db = this.db, lock = false) {
    const r = await db.query(`SELECT * FROM rooms WHERE ${idOrCode.length === 36 ? 'id' : 'code'}=$1${lock && !this.embedded ? ' FOR UPDATE' : ''}`, [idOrCode]);
    return r.rows[0] || null;
  }
  save(db, room) { return db.query('UPDATE rooms SET state=$2 WHERE id=$1', [room.id, JSON.stringify(room.state)]); }
  async close() { await this.db.close?.(); await this.db.end?.(); }
}
function hash(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
module.exports = { Store, hash };
