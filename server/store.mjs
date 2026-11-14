import {openDatabase} from './database.mjs';
import { UNIT, transition } from './domain.mjs';
export async function openStore(connectionString=process.env.DATABASE_URL,options={}) {
  const db = await openDatabase(connectionString,options);
  const user = async id => (await db.prepare('SELECT * FROM users WHERE id=$1').get(id));
  const bet = async id => { const row = (await db.prepare('SELECT json FROM bets WHERE id=$1').get(id)); return row ? JSON.parse(row.json) : null; };
  const save = async b => (await db.prepare('INSERT INTO bets(id,mode,json) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(b.id, b.mode, JSON.stringify(b)));
  const all = async () => (await db.prepare('SELECT json FROM bets ORDER BY created_order DESC LIMIT 1000').all()).map(r => JSON.parse(r.json));
  const transaction = db.transaction;
  async function ensureUser(id, name, kind) { (await db.prepare('INSERT INTO users(id,name,balance,credit,kind) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING').run(id, name, '0', '0', kind)); return (await user(id)); }
  function debit(id,value){if(BigInt(value)>0n)throw Error('Stakes require a NEAR testnet wallet deposit.');}

  async function move(id, actor, action, now) {
    return (await transaction(async () => {
      const original = (await bet(id)); if (!original || original.mode !== 'practice') throw Error('Practice room not found.');
      const next = transition(original, actor, action, now);
      debit(actor === 'oracle' ? original.creator : actor, next.debit);
      for (const [who, n] of next.credits) { const u = (await user(who)); if (!u) throw Error('Player not found.'); (await db.prepare('UPDATE users SET credit=$1 WHERE id=$2').run((BigInt(u.credit) + BigInt(n)).toString(), who)); }
      (await save(next.bet)); return next.bet;
    }));
  }
  async function create(b) { return (await transaction(async () => { debit(b.creator, b.stake); (await save(b)); return b; })); }
  function collect(){throw Error('Collect NEAR testnet rewards through your wallet.');}

  return { db, user, bet, save, all, transaction, ensureUser, move, create, collect, reserveNear:()=>{throw Error('Confirm a NEAR testnet deposit first.');} };
}
