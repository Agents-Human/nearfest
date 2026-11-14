import {AsyncLocalStorage} from 'node:async_hooks';
import {Pool, types} from 'pg';
import {schema as initialSchema} from './schema.mjs';
import {retryDatabaseStartup} from './database-startup.mjs';

// PostgreSQL returns BIGINT as text. Preserve numeric API timestamps/counts without
// rounding values outside JavaScript's safe integer range. NEAR amounts are TEXT.
const parsers={getTypeParser(oid,format){if(oid===20&&format!=='binary')return value=>{const n=Number(value);return Number.isSafeInteger(n)?n:value;};return types.getTypeParser(oid,format);}};
function setting(environment,name,fallback,min,max){
 const value=environment[name];
 if(value===undefined||value==='')return fallback;
 if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<min||Number(value)>max)throw Error(name+' must be an integer between '+min+' and '+max+'.');
 return Number(value);
}
export function databaseConfig(connectionString=process.env.DATABASE_URL,environment=process.env){
 if(!connectionString||!/^postgres(ql)?:\/\//.test(connectionString))throw Error('Set DATABASE_URL to a PostgreSQL connection URL. See .env.example.');
 const namespace=environment.DATABASE_SCHEMA||'public';
 if(!/^[a-z_][a-z0-9_]*$/.test(namespace))throw Error('Invalid DATABASE_SCHEMA.');
 return {connectionString,namespace,
  poolMax:setting(environment,'DATABASE_POOL_MAX',5,1,100),
  connectionTimeoutMillis:setting(environment,'DATABASE_CONNECTION_TIMEOUT_MS',10000,100,60000),
  idleTimeoutMillis:setting(environment,'DATABASE_IDLE_TIMEOUT_MS',5000,100,60000),
  lockPoolMax:setting(environment,'DATABASE_LOCK_POOL_MAX',4,1,50),
  lockWaitMillis:setting(environment,'DATABASE_LOCK_WAIT_MS',90000,1000,600000),
  startupTimeoutMillis:setting(environment,'DATABASE_STARTUP_TIMEOUT_MS',30000,0,300000),
 };
}
export async function openDatabase(connectionString,options={}){
 const config=databaseConfig(connectionString),namespace=options.schema||config.namespace;
 if(!/^[a-z_][a-z0-9_]*$/.test(namespace))throw Error('Invalid database schema.');
 return retryDatabaseStartup(()=>connectDatabase(config,namespace),{timeoutMillis:config.startupTimeoutMillis});
}
async function connectDatabase(config,namespace){
 const shared={connectionString:config.connectionString,connectionTimeoutMillis:config.connectionTimeoutMillis,idleTimeoutMillis:config.idleTimeoutMillis,application_name:'nearfest',options:'-c search_path='+namespace+' -c lock_timeout=5000 -c idle_in_transaction_session_timeout=15000'};
 // Per process: a few query connections, plus a separate small pool for advisory locks.
 const pool=new Pool({...shared,max:config.poolMax,types:parsers});
 pool.on('error',error=>console.error('PostgreSQL connection error:',error.message));
 // Advisory locks are held across NEAR broadcasts (several seconds). They get their own small pool so a
 // slow signer never starves queries, and different accounts can sign in parallel.
 const lockPool=new Pool({...shared,max:config.lockPoolMax??4,idleTimeoutMillis:1000,connectionTimeoutMillis:config.lockWaitMillis??90000});
 lockPool.on('error',error=>console.error('PostgreSQL lock connection error:',error.message));
 const context=new AsyncLocalStorage();
 const query=(sql,params=[])=>{
  const active=context.getStore();if(!active)return pool.query(sql,params);
  const result=active.pending.then(()=>active.client.query(sql,params));
  active.pending=result.catch(()=>{});return result;
 };
 function transaction(fn,options={}){
  if(context.getStore())return fn();
  return runTransaction(fn,options);
 }
 async function runTransaction(fn,{key}={}){
  const client=await pool.connect(),active={client,pending:Promise.resolve(),afterCommit:[]};
  let value,releaseError;
  try{
   await client.query('BEGIN');
   if(key)await client.query('SELECT pg_advisory_xact_lock(hashtext(current_schema()),hashtext($1))',[key]);
   value=await context.run(active,fn);await active.pending;
   await client.query('COMMIT');
  }catch(error){await active.pending;try{await client.query('ROLLBACK');}catch(rollbackError){releaseError=rollbackError;}throw error;}finally{client.release(releaseError);}
  for(const callback of active.afterCommit)try{await callback();}catch(error){console.error('Post-commit notification failed:',error.message);}
  return value;
 }
 // Same-key callers in this process queue in memory instead of each holding a connection while they wait.
 const localLocks=new Map();
 async function withLock(key,fn){
  const previous=localLocks.get(key)||Promise.resolve();let release;
  const current=new Promise(resolve=>{release=resolve;}),tail=previous.then(()=>current);
  localLocks.set(key,tail);
  try{await previous;return await withSharedLock(key,fn);}
  finally{release();if(localLocks.get(key)===tail)localLocks.delete(key);}
 }
 async function withSharedLock(key,fn){
  const deadline=Date.now()+(config.lockWaitMillis??90000);
  const client=await lockPool.connect();let locked=false,releaseError;
  try{
   // Poll with try-lock so waiting on another replica never trips lock_timeout or pins a blocked statement.
   while(!locked){
    locked=(await client.query('SELECT pg_try_advisory_lock(hashtext(current_schema()),hashtext($1)) AS locked',[key])).rows[0].locked;
    if(!locked){if(Date.now()>=deadline)throw Error('This account is busy finishing another action. Try again in a moment.');await new Promise(resolve=>setTimeout(resolve,200));}
   }
   return await fn();
  }catch(error){if(!locked&&error.code)releaseError=error;throw error;}
  finally{try{if(locked)await client.query('SELECT pg_advisory_unlock(hashtext(current_schema()),hashtext($1))',[key]);}catch(error){releaseError=error;}finally{client.release(releaseError);}}
 }
 const db={query,transaction,withLock,namespace,inTransaction:()=>Boolean(context.getStore()),
  afterCommit:callback=>{const active=context.getStore();if(active){active.afterCommit.push(callback);return;}return callback();},
  connectionStats:()=>({queries:{total:pool.totalCount,idle:pool.idleCount,waiting:pool.waitingCount},locks:{total:lockPool.totalCount,idle:lockPool.idleCount,waiting:lockPool.waitingCount}}),
  exec:sql=>query(sql),
  prepare(sql){return {all:async(...values)=>(await query(sql,values)).rows,get:async(...values)=>(await query(sql,values)).rows[0],run:async(...values)=>({changes:(await query(sql,values)).rowCount})};},
  close:()=>Promise.all([pool.end(),lockPool.end()]),
 };
 try{
  await query('CREATE SCHEMA IF NOT EXISTS '+namespace);
  await transaction(async()=>{
   await query('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
   if(!(await db.prepare('SELECT version FROM schema_migrations WHERE version=1').get())){
    await query(initialSchema);
    await query('INSERT INTO schema_migrations(version) VALUES(1)');
   }
   if(!(await db.prepare('SELECT version FROM schema_migrations WHERE version=2').get())){
    await query(`
     CREATE INDEX skill_rooms_active ON skill_rooms((json::jsonb->>'status')) WHERE json::jsonb->>'status' IN ('lobby','playing');
     CREATE INDEX multiplayer_rooms_active ON multiplayer_rooms((json::jsonb->>'status')) WHERE json::jsonb->>'status' IN ('lobby','playing');
     CREATE INDEX arcade_rooms_active ON arcade_rooms((json::jsonb->>'status')) WHERE json::jsonb->>'status' IN ('lobby','playing');
     CREATE INDEX near_intents_pending ON near_intents(created) WHERE complete=0;
     CREATE INDEX near_rooms_pending ON near_rooms((json::jsonb->>'status')) WHERE json::jsonb->>'status' NOT IN ('settled','refunded');
     CREATE INDEX faucet_claims_pending ON faucet_claims(created) WHERE status='pending';
     CREATE INDEX bets_active ON bets((json::jsonb->>'status')) WHERE json::jsonb->>'status' IN ('open','matched','proposed','disputed');
     CREATE INDEX prepared_expires ON prepared(expires);
    `);
    await query('INSERT INTO schema_migrations(version) VALUES(2)');
   }
   if(!(await db.prepare('SELECT version FROM schema_migrations WHERE version=3').get())){
    await query(`
     CREATE TABLE wallet_auth_challenges(id TEXT PRIMARY KEY,json TEXT NOT NULL,expires BIGINT NOT NULL);
     CREATE INDEX wallet_auth_challenges_expires ON wallet_auth_challenges(expires);
    `);
    await query('INSERT INTO schema_migrations(version) VALUES(3)');
   }
   if(!(await db.prepare('SELECT version FROM schema_migrations WHERE version=4').get())){
    await query(`
     CREATE INDEX arcade_room_players ON arcade_rooms USING gin((json::jsonb->'players'));
     CREATE INDEX skill_room_players ON skill_rooms USING gin((json::jsonb->'players'));
     CREATE INDEX multiplayer_room_players ON multiplayer_rooms USING gin((json::jsonb->'players'));
     INSERT INTO near_payouts(room_id,user_id,amount,kind,created)
      SELECT r.id,p->>'account_id',p->>'amount',CASE WHEN r.json::jsonb->>'status'='refunded' THEN 'refund' ELSE 'reward' END,r.updated
      FROM near_rooms r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.json::jsonb->'payouts','[]'::jsonb)) p
      WHERE r.json::jsonb->>'status' IN ('settled','refunded') AND (p->>'amount')::numeric>0
      ON CONFLICT(room_id,user_id) DO NOTHING;
    `);
    await query('INSERT INTO schema_migrations(version) VALUES(4)');
   }
   if(!(await db.prepare('SELECT version FROM schema_migrations WHERE version=5').get())){
    await query(`
     CREATE TABLE managed_accounts(user_id TEXT PRIMARY KEY REFERENCES users(id),username TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,encrypted_key TEXT NOT NULL,created BIGINT NOT NULL,funded_at BIGINT);
     CREATE TABLE managed_transactions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),tx_hash TEXT NOT NULL,signed_tx TEXT NOT NULL,status TEXT NOT NULL,result TEXT,created BIGINT NOT NULL);
     CREATE INDEX managed_transactions_pending ON managed_transactions(user_id,created) WHERE status='pending';
    `);
    await query('INSERT INTO schema_migrations(version) VALUES(5)');
   }
  },{key:'schema-migrations'});
  return db;
 }catch(error){await Promise.all([pool.end(),lockPool.end()]);throw error;}
}
