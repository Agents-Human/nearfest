import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {openStore} from './helpers/store.mjs';
import {createJobQueue,roomDeadline} from '../server/job-queue.mjs';

test('job deadlines follow the active player clock and ignore finished rooms',()=>{
 assert.equal(roomDeadline('board',{status:'playing',starts_at:3000,clock_at:4000,clocks:[100,200],board:{turn:1}}),4200);
 assert.equal(roomDeadline('quiz',{status:'playing',ends_at:9000}),9000);
 assert.equal(roomDeadline('arcade',{status:'lobby',expires_at:10000}),10000);
 assert.equal(roomDeadline('arcade',{status:'playing'}),null);
 assert.equal(roomDeadline('board',{status:'finished'}),null);
});

test('durable jobs deduplicate and roll back with the domain transaction',async()=>{
 const store=await openStore(':memory:');let queue;
 try{
  queue=await createJobQueue(store,{pollingIntervalSeconds:.5,paymentPollingIntervalSeconds:.5});
  const first=await queue.schedule('example','one',Date.now()+60000,{value:1});
  const second=await queue.schedule('example','one',Date.now()+70000,{value:2});
  assert.equal(first,second);
  const job=await queue.boss.getJobById('maintenance',first);assert.equal(job.data.value,2);
  let rolledBack;
  await assert.rejects(store.transaction(async()=>{await store.ensureUser('rollback','Rollback','practice');rolledBack=await queue.schedule('example','rollback');throw Error('abort');}),/abort/);
  assert.equal(await store.user('rollback'),undefined);
  assert.equal(await queue.boss.getJobById('maintenance',rolledBack),null);
 }finally{if(queue)await queue.stop();await store.db.close();}
});

test('a queued job survives process restart and the worker retries a failed handler',async()=>{
 const store=await openStore(':memory:');let queue;
 try{
  queue=await createJobQueue(store,{pollingIntervalSeconds:.5,paymentPollingIntervalSeconds:.5});
  const id=await queue.boss.send('maintenance',{version:1,type:'example',id:'retry'},{retryLimit:1,retryDelay:0});
  await queue.stop();queue=await createJobQueue(store,{pollingIntervalSeconds:.5,paymentPollingIntervalSeconds:.5});
  let attempts=0;await queue.start({example:async()=>{if(++attempts===1)throw Error('temporary RPC outage');}});
  let completed;
  for(let i=0;i<80;i++){completed=await queue.boss.getJobById('maintenance',id);if(completed.state==='completed')break;await delay(50);}
  assert.equal(completed.state,'completed');assert.equal(attempts,2);
  assert(store.db.connectionStats().queries.total<=2);assert.equal(store.db.connectionStats().locks.total,0);
 }finally{if(queue)await queue.stop();await store.db.close();}
});
