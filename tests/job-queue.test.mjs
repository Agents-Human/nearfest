import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {openStore} from './helpers/store.mjs';
import {createJobQueue,roomDeadline} from '../server/job-queue.mjs';
import {createBoardRooms} from '../server/skill/rooms.mjs';
import {createArcadeRooms} from '../server/arcade/rooms.mjs';
import {startJobs} from '../server/jobs.mjs';

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


test('a room deadline is dispatched by ID and survives a restart',async()=>{
 const store=await openStore(':memory:');let queue;
 try{
  queue=await createJobQueue(store,{pollingIntervalSeconds:.5,paymentPollingIntervalSeconds:.5});
  const rooms=createBoardRooms(store),host=await store.ensureUser('host','Host','practice');
  const room=await rooms.create({game_id:'connect-four',entry:'0'},host,Date.now()-1800000+800);
  await queue.stop();queue=await createJobQueue(store,{pollingIntervalSeconds:.5,paymentPollingIntervalSeconds:.5});
  await queue.start({room:data=>rooms.expire(data.roomId)});
  let result;for(let i=0;i<60;i++){result=JSON.parse((await store.db.prepare('SELECT json FROM skill_rooms WHERE id=$1').get(room.id)).json);if(result.status==='cancelled')break;await delay(50);}
  assert.equal(result.status,'cancelled');
 }finally{if(queue)await queue.stop();await store.db.close();}
});

test('a slow payment handler does not delay the room deadline worker',async()=>{
 const store=await openStore(':memory:');let queue,release;
 try{
  queue=await createJobQueue(store,{pollingIntervalSeconds:.5,paymentPollingIntervalSeconds:.5});
  let began,deadline=false;const started=new Promise(resolve=>{began=resolve;}),gate=new Promise(resolve=>{release=resolve;});
  await queue.schedule('payment','one');
  await queue.start({payment:async()=>{began();await gate;},room:async()=>{deadline=true;}});
  await started;await queue.schedule('room','board:one',Date.now(),{kind:'board',roomId:'one'});
  for(let i=0;i<40&&!deadline;i++)await delay(25);
  assert(deadline,'An RPC must not block room deadlines');release();
 }finally{release?.();if(queue)await queue.stop();await store.db.close();}
});

test('live snapshots and physics frames do not read or checkpoint PostgreSQL',async()=>{
 const store=await openStore(':memory:');
 try{
  const rooms=await createArcadeRooms(store),host=await store.ensureUser('runner','Runner','practice');
  const room=await rooms.create({game_id:'pocket-racers',entry:'0',solo:true},host);
  let queries=0,frames=0;const query=store.db.query,prepare=store.db.prepare;
  store.db.query=(...args)=>{queries++;return query(...args);};store.db.prepare=(...args)=>{queries++;return prepare(...args);};
  const unsubscribe=await rooms.subscribe(room.id,host,null,()=>{frames++;});
  for(let i=1;i<=60;i++)await rooms.tick(room.starts_at+i*50);
  unsubscribe();assert(frames>20);assert.equal(queries,0);
  store.db.query=query;store.db.prepare=prepare;
  await rooms.action(room.id,host,{type:'resign'});
  const saved=await store.db.prepare('SELECT json FROM arcade_rooms WHERE id=$1').get(room.id);assert.equal(JSON.parse(saved.json).status,'cancelled');
 }finally{await store.db.close();}
});


test('the deadline worker drains a backlog in batches instead of one job per polling interval',async()=>{
 const store=await openStore(':memory:');let queue;
 try{
  queue=await createJobQueue(store);let completed=0;
  for(let i=0;i<25;i++)await queue.schedule('room','board:'+i,Date.now(),{kind:'board',roomId:String(i)});
  await queue.start({room:async()=>{completed++;}});
  for(let i=0;i<60&&completed<25;i++)await delay(25);
  assert.equal(completed,25);
 }finally{if(queue)await queue.stop();await store.db.close();}
});
