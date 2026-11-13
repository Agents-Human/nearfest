import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { UNIT, transition } from './domain.mjs';
export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,balance TEXT NOT NULL,credit TEXT NOT NULL,kind TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS bets(id TEXT PRIMARY KEY,mode TEXT NOT NULL,json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,bet_id TEXT NOT NULL,user_id TEXT NOT NULL,text TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS reactions(bet_id TEXT NOT NULL,user_id TEXT NOT NULL,emoji TEXT NOT NULL,PRIMARY KEY(bet_id,user_id));
    CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,target TEXT NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(user_id,target));
    CREATE TABLE IF NOT EXISTS prepared(request_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,json TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS room_media(bet_id TEXT PRIMARY KEY,cover TEXT,stream_json TEXT,updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS evidence(bet_id TEXT PRIMARY KEY,hash TEXT NOT NULL,json TEXT NOT NULL);
  `);
  const user = id => db.prepare('SELECT * FROM users WHERE id=?').get(id);
  const bet = id => { const row = db.prepare('SELECT json FROM bets WHERE id=?').get(id); return row ? JSON.parse(row.json) : null; };
  const save = b => db.prepare('INSERT INTO bets VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(b.id, b.mode, JSON.stringify(b));
  const all = () => db.prepare('SELECT json FROM bets ORDER BY rowid DESC LIMIT 1000').all().map(r => JSON.parse(r.json));
  const transaction = fn => { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  function ensureUser(id, name, kind) { db.prepare('INSERT OR IGNORE INTO users VALUES(?,?,?,?,?)').run(id, name, kind === 'practice' ? (1000n * UNIT).toString() : '0', '0', kind); return user(id); }
  function debit(id, value) { const u = user(id); if (!u || BigInt(u.balance) < BigInt(value)) throw Error('Not enough FUN in your practice balance. Collect any available winnings first.'); db.prepare('UPDATE users SET balance=? WHERE id=?').run((BigInt(u.balance) - BigInt(value)).toString(), id); }
  function move(id, actor, action, now) {
    return transaction(() => {
      const original = bet(id); if (!original || original.mode !== 'practice') throw Error('Practice room not found.');
      const next = transition(original, actor, action, now);
      debit(actor === 'oracle' ? original.creator : actor, next.debit);
      for (const [who, n] of next.credits) { const u = user(who); if (!u) throw Error('Player not found.'); db.prepare('UPDATE users SET credit=? WHERE id=?').run((BigInt(u.credit) + BigInt(n)).toString(), who); }
      save(next.bet); return next.bet;
    });
  }
  function create(b) { return transaction(() => { debit(b.creator, b.stake); save(b); return b; }); }
  function collect(id) { return transaction(() => { const u = user(id); if (!u || BigInt(u.credit) <= 0n) throw Error('No winnings to collect yet.'); db.prepare('UPDATE users SET balance=?,credit=? WHERE id=?').run((BigInt(u.balance) + BigInt(u.credit)).toString(), '0', id); return user(id); }); }
  return { db, user, bet, save, all, transaction, ensureUser, move, create, collect };
}
