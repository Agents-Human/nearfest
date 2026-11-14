import test from 'node:test';
import assert from 'node:assert/strict';
import {databaseConfig} from '../server/database.mjs';
import {retryDatabaseStartup} from '../server/database-startup.mjs';

test('connection limits default to a small per-process budget and reject invalid overrides',()=>{
 const url='postgresql://user:password@localhost/app';
 const defaults=databaseConfig(url,{});
 assert.equal(defaults.poolMax,2);assert.equal(defaults.idleTimeoutMillis,5000);
 assert.equal(databaseConfig(url,{DATABASE_POOL_MAX:'1'}).poolMax,1);
 for(const value of ['0','-1','2.5','ten','101'])assert.throws(()=>databaseConfig(url,{DATABASE_POOL_MAX:value}),/DATABASE_POOL_MAX/);
});

test('startup waits for exhausted connection slots and succeeds when one becomes available',async()=>{
 let time=0,calls=0,warnings=0;const pauses=[],error=Object.assign(Error('connection slots full'),{code:'53300'});
 const result=await retryDatabaseStartup(async()=>{if(++calls<3)throw error;return 'ready';},{timeoutMillis:5000,now:()=>time,wait:async ms=>{pauses.push(ms);time+=ms;},onRetry:()=>warnings++});
 assert.equal(result,'ready');assert.equal(calls,3);assert.deepEqual(pauses,[500,1000]);assert.equal(warnings,1);
});

test('a persistent capacity error stops retrying at the configured deadline',async()=>{
 let time=0,calls=0;const error=Object.assign(Error('full'),{code:'53300'});
 await assert.rejects(retryDatabaseStartup(async()=>{calls++;throw error;},{timeoutMillis:1200,now:()=>time,wait:async ms=>{time+=ms;},onRetry:()=>{}}),e=>e===error);
 assert.equal(time,1200);assert.equal(calls,3);
});

test('startup never retries invalid credentials or untrusted certificates',async()=>{
 for(const code of ['28P01','SELF_SIGNED_CERT_IN_CHAIN']){
  let calls=0;const error=Object.assign(Error('invalid configuration'),{code});
  await assert.rejects(retryDatabaseStartup(async()=>{calls++;throw error;},{wait:async()=>assert.fail('must not retry')}),e=>e===error);
  assert.equal(calls,1);
 }
});
