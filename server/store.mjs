import {openDatabase} from './database.mjs';
import { UNIT, transition } from './domain.mjs';
export async function openStore(connectionString=process.env.DATABASE_URL,options={}) {
  const db = await openDatabase(connectionString,options);
  const profiles=new Map();
  const user = async (id,{lock=false}={}) => {const row=await db.prepare('SELECT * FROM users WHERE id=$1'+(lock?' FOR UPDATE':'')).get(id);if(row)profiles.set(id,row);return row;};
  const loadUsers=async ids=>{const unique=[...new Set(ids)].filter(id=>id&&!id.startsWith('bot:'));if(unique.length)for(const row of (await db.query('SELECT * FROM users WHERE id=ANY($1::text[])',[unique])).rows)profiles.set(row.id,row);};
  const updateName=async(id,name)=>{await db.prepare('UPDATE users SET name=$1 WHERE id=$2').run(name,id);await db.afterCommit(()=>{if(profiles.has(id))profiles.set(id,{...profiles.get(id),name});});};
  const bet = async id => { const row = (await db.prepare('SELECT json FROM bets WHERE id=$1'+(db.inTransaction()?' FOR UPDATE':'')).get(id)); return row ? JSON.parse(row.json) : null; };
  const save = async b => db.transaction(async()=>{await db.prepare('INSERT INTO bets(id,mode,json) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(b.id,b.mode,JSON.stringify(b));await store.jobs?.scheduleBet(b);});
  const all = async () => (await db.prepare('SELECT json FROM bets ORDER BY created_order DESC LIMIT 1000').all()).map(r => JSON.parse(r.json));
  const transaction = db.transaction;
  async function ensureUser(id, name, kind) { (await db.prepare('INSERT INTO users(id,name,balance,credit,kind) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING').run(id, name, '0', '0', kind)); return (await user(id)); }
  function debit(id,value){if(BigInt(value)>0n)throw Error('Stakes require a NEAR testnet wallet deposit.');}

  async function move(id, actor, action, now) {
    return (await transaction(async () => {
      const original = (await bet(id)); if (!original || original.mode !== 'practice') throw Error('Practice room not found.');
      const next = transition(original, actor, action, now);
      debit(actor === 'oracle' ? original.creator : actor, next.debit);
      for (const [who, n] of next.credits) { const u = (await user(who,{lock:true})); if (!u) throw Error('Player not found.'); (await db.prepare('UPDATE users SET credit=$1 WHERE id=$2').run((BigInt(u.credit) + BigInt(n)).toString(), who)); }
      (await save(next.bet)); return next.bet;
    }));
  }
  async function create(b) { return (await transaction(async () => { debit(b.creator, b.stake); (await save(b)); return b; })); }
  function collect(){throw Error('Collect NEAR testnet rewards through your wallet.');}

  const store={ db, user, cachedUser:id=>profiles.get(id),loadUsers,hydrateRooms:async rooms=>{await loadUsers(rooms.flatMap(room=>room.players.map(player=>player.id)));await store.loadNear?.(rooms.map(room=>room.id));},updateName,bet, save, all, transaction, ensureUser, move, create, collect, reserveNear:()=>{throw Error('Confirm a NEAR testnet deposit first.');} };
  return store;
}
