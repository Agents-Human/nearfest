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
  poolMax:setting(environment,'DATABASE_POOL_MAX',2,1,100),
  idleTimeoutMillis:setting(environment,'DATABASE_IDLE_TIMEOUT_MS',5000,100,60000),
  startupTimeoutMillis:setting(environment,'DATABASE_STARTUP_TIMEOUT_MS',30000,0,300000),
 };
}
export async function openDatabase(connectionString,options={}){
 const config=databaseConfig(connectionString),namespace=options.schema||config.namespace;
 if(!/^[a-z_][a-z0-9_]*$/.test(namespace))throw Error('Invalid database schema.');
 return retryDatabaseStartup(()=>connectDatabase(config,namespace),{timeoutMillis:config.startupTimeoutMillis});
}
async function connectDatabase(config,namespace){
 const shared={connectionString:config.connectionString,connectionTimeoutMillis:10000,idleTimeoutMillis:config.idleTimeoutMillis,application_name:'nearfest',options:'-c search_path='+namespace};
 // Per process: two query connections by default, plus at most one sponsor lock.
 const pool=new Pool({...shared,max:config.poolMax,types:parsers});
 pool.on('error',error=>console.error('PostgreSQL connection error:',error.message));
 const lockPool=new Pool({...shared,max:1,idleTimeoutMillis:1000});
 lockPool.on('error',error=>console.error('PostgreSQL lock connection error:',error.message));
 const context=new AsyncLocalStorage();
 const query=(sql,params=[])=>{
  const active=context.getStore();if(!active)return pool.query(sql,params);
  const result=active.pending.then(()=>active.client.query(sql,params));
  active.pending=result.catch(()=>{});return result;
 };
 async function transaction(fn){
  if(context.getStore())return fn();
  const client=await pool.connect(),active={client,pending:Promise.resolve()};
  try{
   await client.query('BEGIN');
   // Preserve SQLite's serialized read/modify/write semantics across app processes.
   await client.query("SELECT pg_advisory_xact_lock(hashtext(current_schema()), 1)");
   const value=await context.run(active,fn);
   await active.pending;
   await client.query('COMMIT');return value;
  }catch(error){await active.pending;await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 async function withLock(key,fn){
  const client=await lockPool.connect();
  try{await client.query('SELECT pg_advisory_lock(hashtext(current_schema()),hashtext($1))',[key]);return await fn();}
  finally{try{await client.query('SELECT pg_advisory_unlock(hashtext(current_schema()),hashtext($1))',[key]);}finally{client.release();}}
 }
 const db={query,transaction,withLock,
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
  });
  return db;
 }catch(error){await Promise.all([pool.end(),lockPool.end()]);throw error;}
}
