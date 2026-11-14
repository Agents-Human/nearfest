import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openStore,testSchema} from './helpers/store.mjs';
import {migrateSqlite} from '../scripts/migrate-sqlite.mjs';
import {openDatabase} from '../server/database.mjs';
import {createArcadeRooms} from '../server/arcade/rooms.mjs';

test('PostgreSQL transactions roll back and concurrent read/modify/write operations retain every update',async()=>{
 const store=await openStore(':memory:');
 try{
  await store.ensureUser('player','Player','practice');
  await assert.rejects(store.transaction(async()=>{
   await store.db.prepare('UPDATE users SET credit=$1 WHERE id=$2').run('99','player');
   throw Error('abort');
  }),/abort/);
  assert.equal((await store.user('player')).credit,'0');
  await Promise.all(Array.from({length:12},()=>store.transaction(async()=>{
   const user=await store.user('player');
   await store.db.prepare('UPDATE users SET credit=$1 WHERE id=$2').run((BigInt(user.credit)+1n).toString(),'player');
  })));
  assert.equal((await store.user('player')).credit,'12');
 }finally{await store.db.close();}
});

test('concurrent arcade joins and ready actions retain every seat and ready state',async()=>{
 const store=await openStore(':memory:');
 try{
  const rooms=await createArcadeRooms(store),players=await Promise.all(['host','friend','other'].map(id=>store.ensureUser(id,id,'practice')));
  const room=await rooms.create({game_id:'pocket-racers',entry:'0'},players[0]);
  await Promise.all(players.slice(1).map(user=>rooms.action(room.id,user,{type:'join'})));
  await Promise.all(players.map(user=>rooms.action(room.id,user,{type:'ready',ready:true})));
  const result=await rooms.get(room.id,players[0]);
  assert.equal(result.players.length,3);assert(result.players.every(p=>p.ready));
 }finally{await store.db.close();}
});

test('SQLite import keeps WAL records, money precision, timestamps, room order and generated ID sequences',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'nearfest-import-')),sourcePath=join(directory,'legacy.sqlite'),source=new DatabaseSync(sourcePath),schema=testSchema();let db;
 try{
  source.exec(`PRAGMA journal_mode=WAL;
   CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,balance TEXT,credit TEXT,kind TEXT);
   CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id TEXT,expires INTEGER);
   CREATE TABLE messages(id INTEGER PRIMARY KEY AUTOINCREMENT,bet_id TEXT,user_id TEXT,text TEXT,created_at INTEGER);
   CREATE TABLE arcade_rooms(id TEXT PRIMARY KEY,json TEXT);
   CREATE TABLE faucet_claims(id TEXT PRIMARY KEY,user_id TEXT,ip_hash TEXT,created INTEGER,status TEXT,tx_hash TEXT,signed_tx TEXT);
  `);
  const amount='123456789012345678901234567890';
  source.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('player','Player',amount,'0','wallet');
  source.prepare('INSERT INTO sessions VALUES(?,?,?)').run('token','player',1900000000000);
  source.prepare('INSERT INTO messages VALUES(?,?,?,?,?)').run(42,'room','player','Hello',1800000000000);
  source.prepare('INSERT INTO arcade_rooms VALUES(?,?)').run('first','{"id":"first"}');
  source.prepare('INSERT INTO arcade_rooms VALUES(?,?)').run('second','{"id":"second"}');
  source.prepare('INSERT INTO faucet_claims VALUES(?,?,?,?,?,?,?)').run('claim','player','ip',1800000000000,'pending','tx','signed');
  const counts=await migrateSqlite(sourcePath,process.env.TEST_DATABASE_URL,{schema});
  assert.equal(counts.users,1);assert.equal(counts.arcade_rooms,2);
  db=await openDatabase(process.env.TEST_DATABASE_URL,{schema});
  assert.equal((await db.prepare('SELECT balance FROM users').get()).balance,amount);
  assert.equal((await db.prepare('SELECT expires FROM sessions').get()).expires,1900000000000);
  assert.deepEqual((await db.prepare('SELECT id FROM arcade_rooms ORDER BY created_order DESC').all()).map(r=>r.id),['second','first']);
  assert.equal((await db.prepare('SELECT amount FROM faucet_claims').get()).amount,'1000000000000000000000000');
  const inserted=await db.query('INSERT INTO messages(bet_id,user_id,text,created_at) VALUES($1,$2,$3,$4) RETURNING id',['room','player','Next',1800000000001]);
  assert.equal(inserted.rows[0].id,43);
  await assert.rejects(migrateSqlite(sourcePath,process.env.TEST_DATABASE_URL,{schema}),/already contains data/);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM messages').get()).n,2);
  assert.equal(source.prepare('SELECT count(*) AS n FROM messages').get().n,1);
 }finally{source.close();if(db)await db.close();await rm(directory,{recursive:true,force:true});}
});

test('a failed import rolls back all copied rows',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'nearfest-import-fail-')),file=join(directory,'bad.sqlite'),source=new DatabaseSync(file),schema=testSchema();let db;
 try{
  source.exec("CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT,balance TEXT,credit TEXT,kind TEXT); INSERT INTO users VALUES('good','Name','0','0','practice'); INSERT INTO users VALUES('bad',NULL,'0','0','practice');");
  await assert.rejects(migrateSqlite(file,process.env.TEST_DATABASE_URL,{schema}),/null value/);
  db=await openDatabase(process.env.TEST_DATABASE_URL,{schema});
  assert.equal((await db.prepare('SELECT count(*) AS n FROM users').get()).n,0);
 }finally{source.close();if(db)await db.close();await rm(directory,{recursive:true,force:true});}
});
